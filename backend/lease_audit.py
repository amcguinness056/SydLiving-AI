import os
import re
import io
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

class RedFlag(BaseModel):
    severity: str  # "HIGH", "MEDIUM", "WARNING"
    category: str
    title: str
    clause_excerpt: str
    nsw_legislation_reference: str
    recommended_action: str

class LeaseAuditResult(BaseModel):
    risk_level: str  # "LOW", "MEDIUM", "HIGH"
    risk_score: int  # 0 to 100 (higher = more dangerous)
    weekly_rent: Optional[float] = None
    bond_amount: Optional[float] = None
    bond_weeks_ratio: Optional[float] = None
    lease_term_months: Optional[int] = None
    red_flags: List[RedFlag] = []
    extracted_clauses_summary: List[str] = []
    is_aws_analyzed: bool = False

class LeaseAuditor:
    """Audits NSW residential tenancy agreements and inspection reports using AWS Textract, Comprehend, and NSW statutory compliance rules."""

    def __init__(self):
        self.has_aws = bool(os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY"))

    def extract_document_text(self, file_bytes: bytes, filename: str = "lease.pdf") -> str:
        """Extracts text from PDF or text bytes using AWS Textract with pypdf/text fallback."""
        if self.has_aws:
            try:
                import boto3
                textract = boto3.client("textract", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
                response = textract.detect_document_text(Document={"Bytes": file_bytes})
                lines = [
                    item["Text"]
                    for item in response.get("Blocks", [])
                    if item["BlockType"] == "LINE"
                ]
                if lines:
                    return "\n".join(lines)
            except Exception as e:
                print(f"[LeaseAuditor] Textract API error, falling back: {e}")

        # Fallback using pypdf if it's a PDF
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    pages_text.append(t)
            if pages_text:
                return "\n".join(pages_text)
        except Exception:
            pass

        # Direct text decode fallback
        try:
            return file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    def run_comprehend_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extracts named entities and key phrases using AWS Comprehend."""
        if self.has_aws and text:
            try:
                import boto3
                comprehend = boto3.client("comprehend", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
                truncated = text[:4900]
                resp = comprehend.detect_entities(Text=truncated, LanguageCode="en")
                return resp.get("Entities", [])
            except Exception as e:
                print(f"[LeaseAuditor] Comprehend API error: {e}")
        return []

    def audit_lease(self, text: str) -> LeaseAuditResult:
        """Runs the NSW Tenancy Red Flag Rule Engine against extracted text."""
        red_flags: List[RedFlag] = []
        clean_text = text.replace("\r", " ")

        # 1. Rent and Bond Extraction
        rent_match = re.search(r'(?:rent|weekly\s+rent|rental\s+rate)[^\d\n]*\$?\s*(\d{3,4})', clean_text, re.IGNORECASE)
        weekly_rent = float(rent_match.group(1)) if rent_match else None

        bond_match = re.search(r'(?:rental\s+bond|bond\s+amount|security\s+deposit)[^\d\n]*\$?\s*(\d{3,5})', clean_text, re.IGNORECASE)
        bond_amount = float(bond_match.group(1)) if bond_match else None

        bond_ratio = None
        if weekly_rent and bond_amount:
            bond_ratio = round(bond_amount / weekly_rent, 2)
            # Section 159 of Residential Tenancies Act 2010 (NSW): Max bond is 4 weeks rent
            if bond_ratio > 4.0:
                red_flags.append(RedFlag(
                    severity="HIGH",
                    category="Rental Bond",
                    title="Excessive Rental Bond Demanded",
                    clause_excerpt=f"Bond of ${bond_amount:.0f} exceeds 4 weeks of rent (${weekly_rent:.0f}/wk = {bond_ratio} weeks).",
                    nsw_legislation_reference="NSW Residential Tenancies Act 2010, Section 159 (Maximum amount of rental bond)",
                    recommended_action="Notify landlord/agent that NSW law strictly caps residential bonds at 4 weeks' rent regardless of furnished status."
                ))

        # 2. Rental Bonds Online (RBO) Check
        if "rental bonds online" not in clean_text.lower() and "rbo" not in clean_text.lower():
            red_flags.append(RedFlag(
                severity="HIGH",
                category="Bond Lodgement",
                title="Missing Rental Bonds Online (RBO) Clause",
                clause_excerpt="No clause providing for direct lodgement via NSW Fair Trading Rental Bonds Online.",
                nsw_legislation_reference="NSW Fair Trading Standard Tenancy Agreement Clause 12 & Section 157",
                recommended_action="Insist on paying your bond directly via NSW Fair Trading's Rental Bonds Online portal. Never pay cash bond directly to a private landlord."
            ))

        # 3. Illegal Break-Lease Penalties Check
        lower_text = clean_text.lower()
        is_break_lease_flagged = False
        excerpt = "Tenant liable for rent until relet or custom penalties"
        
        if "break lease" in lower_text or "early termination" in lower_text or "terminates this agreement" in lower_text:
            if any(cue in lower_text for cue in ["liable for the rent until", "responsible for rent until", "until a new tenant", "marketing fee", "advertising and letting"]):
                is_break_lease_flagged = True
                # Extract surrounding sentence
                for line in clean_text.splitlines():
                    if any(cue in line.lower() for cue in ["break lease", "terminates", "liable", "new tenant", "fee"]):
                        excerpt = line.strip()
                        break

        if is_break_lease_flagged:
            red_flags.append(RedFlag(
                severity="HIGH",
                category="Break Lease",
                title="Unlawful Break Lease Penalty Schedule",
                clause_excerpt=excerpt,
                nsw_legislation_reference="NSW Residential Tenancies Act 2010, Section 107 (Fixed break lease fee caps)",
                recommended_action="NSW law caps break lease compensation for standard fixed-term agreements to 4/3/2/1 weeks rent depending on the quarter expired. Custom penalty fees or open-ended rent liability are invalid."
            ))

        # 4. Rent Increase Frequency Check (< 12 months)
        six_month_increase = re.search(r'(?:increase|review)[^\.\n]*?(?:every\s+6\s+months|semi-annually|six\s+months)', clean_text, re.IGNORECASE)
        if six_month_increase:
            red_flags.append(RedFlag(
                severity="MEDIUM",
                category="Rent Increases",
                title="Rent Increase Frequency Under 12 Months",
                clause_excerpt=six_month_increase.group(0),
                nsw_legislation_reference="NSW Residential Tenancies Act 2010, Section 42 (Frequency of rent increases)",
                recommended_action="Rent in NSW cannot be increased more than once in any 12-month period. Request removal of 6-month review terms."
            ))

        # 5. Blanket Pet Ban Check
        pet_ban_match = re.search(r'(?:no\s+pets|pets\s+strictly\s+prohibited|no\s+animals\s+allowed)[^\.\n]*', clean_text, re.IGNORECASE)
        if pet_ban_match:
            red_flags.append(RedFlag(
                severity="WARNING",
                category="Pet Ownership",
                title="Blanket Pet Prohibition Clause",
                clause_excerpt=pet_ban_match.group(0),
                nsw_legislation_reference="NSW Residential Tenancies Amendment (Tenants' Rights) 2024 & Strata Schemes Management Act",
                recommended_action="NSW legislation prohibits unreasonable blanket pet bans. Landlords must seek NCAT approval to refuse a pet request without valid statutory grounds."
            ))

        # 6. Tenant Maintenance Shifting Check
        maintenance_shift_match = re.search(
            r'(?:tenant\s+responsible\s+for|tenant\s+must\s+maintain)[^\.\n]*?(?:appliances|structural|mold|mould|plumbing|smoke\s+alarm)',
            clean_text,
            re.IGNORECASE
        )
        if maintenance_shift_match:
            red_flags.append(RedFlag(
                severity="HIGH",
                category="Maintenance & Repairs",
                title="Unlawful Shifting of Landlord Repair Obligations",
                clause_excerpt=maintenance_shift_match.group(0),
                nsw_legislation_reference="NSW Residential Tenancies Act 2010, Section 63 (Landlord's general obligation for urgent and general repairs)",
                recommended_action="Landlords have a non-delegable duty to maintain premises in reasonable repair and conduct urgent repairs. Clauses making tenants liable for preexisting defects or appliance repairs are unenforceable."
            ))

        # Lease Term
        term_match = re.search(r'(\d+)\s*(?:month|months)\s*(?:fixed\s+term|lease|agreement)', clean_text, re.IGNORECASE)
        lease_term = int(term_match.group(1)) if term_match else None

        # Summary of clauses
        extracted_clauses = []
        if weekly_rent:
            extracted_clauses.append(f"Agreed Rent: ${weekly_rent:.0f}/week")
        if bond_amount:
            extracted_clauses.append(f"Stated Bond: ${bond_amount:.0f}")
        if lease_term:
            extracted_clauses.append(f"Lease Duration: {lease_term} Months")

        # Compute risk score (0 - 100)
        risk_score = 0
        for f in red_flags:
            if f.severity == "HIGH":
                risk_score += 35
            elif f.severity == "MEDIUM":
                risk_score += 20
            else:
                risk_score += 10
        risk_score = min(100, risk_score)

        if risk_score >= 50:
            risk_level = "HIGH"
        elif risk_score >= 20:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return LeaseAuditResult(
            risk_level=risk_level,
            risk_score=risk_score,
            weekly_rent=weekly_rent,
            bond_amount=bond_amount,
            bond_weeks_ratio=bond_ratio,
            lease_term_months=lease_term,
            red_flags=red_flags,
            extracted_clauses_summary=extracted_clauses,
            is_aws_analyzed=self.has_aws
        )

lease_auditor = LeaseAuditor()
