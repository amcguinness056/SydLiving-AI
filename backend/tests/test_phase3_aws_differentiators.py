import os
import json
import pytest
from fastapi.testclient import TestClient
from main import app
from lease_audit import lease_auditor, LeaseAuditor
from orchestrator import orchestrator

client = TestClient(app)

SAMPLE_NON_COMPLIANT_LEASE = """
RESIDENTIAL TENANCY AGREEMENT - NSW
Premises: 42 Ocean Street, Coogee NSW 2034
Rent: The tenant agrees to pay a weekly rent of $800.
Rental Bond: A security deposit bond of $4800 is payable in cash directly to the landlord.
Term: 12 months fixed term lease.

Special Conditions:
1. Break Lease: If the tenant terminates this agreement prior to the end of the term, the tenant remains fully liable for the rent until a new tenant is found, plus a $1500 marketing fee.
2. Rent Review: Rent shall be reviewed and increased every 6 months by a minimum of 10%.
3. Pets: No pets or animals allowed under any circumstances.
4. Repairs: Tenant is responsible for mold remediation, appliance repairs, and general plumbing maintenance.
"""

SAMPLE_COMPLIANT_NSW_LEASE = """
STANDARD RESIDENTIAL TENANCY AGREEMENT (NSW FAIR TRADING)
Premises: 15 High Street, Newtown NSW 2042
Rent: $700 per week.
Rental Bond: $2800 payable via NSW Fair Trading Rental Bonds Online (RBO).
Term: 12 months fixed term agreement.
Break lease compensation is strictly in accordance with Section 107 of the NSW Residential Tenancies Act 2010.
Repairs and maintenance are the statutory obligation of the landlord under Section 63.
"""

def test_non_compliant_lease_red_flags():
    result = lease_auditor.audit_lease(SAMPLE_NON_COMPLIANT_LEASE)
    assert result.risk_level == "HIGH"
    assert result.risk_score >= 50
    assert result.weekly_rent == 800.0
    assert result.bond_amount == 4800.0
    assert result.bond_weeks_ratio == 6.0  # 6 weeks bond!

    categories = [rf.category for rf in result.red_flags]
    assert "Rental Bond" in categories
    assert "Bond Lodgement" in categories
    assert "Break Lease" in categories
    assert "Rent Increases" in categories

    # Verify NSW statutory citations
    bond_rf = next(rf for rf in result.red_flags if rf.category == "Rental Bond")
    assert "Section 159" in bond_rf.nsw_legislation_reference

def test_compliant_lease_low_risk():
    result = lease_auditor.audit_lease(SAMPLE_COMPLIANT_NSW_LEASE)
    assert result.weekly_rent == 700.0
    assert result.bond_amount == 2800.0
    assert result.bond_weeks_ratio == 4.0
    # No high-severity bond or break-lease flags
    assert not any(rf.category == "Rental Bond" for rf in result.red_flags)
    assert not any(rf.category == "Bond Lodgement" for rf in result.red_flags)
    assert result.risk_level in ["LOW", "MEDIUM"]

def test_lease_audit_api_endpoint():
    resp = client.post("/api/lease/audit", data={"lease_text": SAMPLE_NON_COMPLIANT_LEASE})
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_level"] == "HIGH"
    assert len(data["red_flags"]) >= 3
    assert data["weekly_rent"] == 800.0

def test_step_functions_orchestrator_execution():
    result = orchestrator.execute_workflow(
        suburb="Coogee",
        max_rent=1000.0,
        min_bedrooms=2,
        destination_hub="Barangaroo",
        vibe_query="beach cafes"
    )
    assert result["status"] == "SUCCEEDED"
    assert "tradeoffs" in result
    assert len(result["tradeoffs"]) >= 2
    assert result["destination_hub"] == "Barangaroo"

def test_step_functions_asl_json_validity():
    asl_path = os.path.join(os.path.dirname(__file__), "..", "statemachine", "property_orchestrator.asl.json")
    assert os.path.exists(asl_path)
    with open(asl_path, "r") as f:
        data = json.load(f)
    assert "StartAt" in data
    assert "States" in data
    assert "SearchListingsTask" in data["States"]
    assert "CalculateCommutesTask" in data["States"]
    assert "ScoreLifestyleAndVibeTask" in data["States"]
    assert "SynthesizeTradeoffsTask" in data["States"]
