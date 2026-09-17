import os
import json
from typing import Dict, Any, Optional
from domain_client import domain_client
from tfnsw_client import tfnsw_client
from semantic_search import semantic_engine
from tradeoffs import compute_tradeoffs
from models import TradeoffOption

class PropertySearchOrchestrator:
    """Step Functions orchestrator for property search -> commute -> lifestyle -> trade-offs pipeline."""

    def __init__(self):
        self.state_machine_arn = os.environ.get("PROPERTY_ORCHESTRATOR_SFN_ARN")
        self.has_aws = bool(os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY") and self.state_machine_arn)

    def execute_workflow(
        self,
        suburb: Optional[str] = None,
        max_rent: Optional[float] = None,
        min_bedrooms: Optional[int] = None,
        destination_hub: str = "Martin Place",
        vibe_query: Optional[str] = None
    ) -> Dict[str, Any]:
        """Executes the 4-step orchestration pipeline:
        Step 1: Search Listings (Domain)
        Step 2: Calculate Commutes (TfNSW)
        Step 3: Score Lifestyle & Vibe (Semantic Engine)
        Step 4: Synthesize Trade-offs (Tradeoff Engine)
        """
        if self.has_aws and self.state_machine_arn:
            try:
                import boto3
                sfn = boto3.client("stepfunctions", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
                execution_input = {
                    "suburb": suburb or "",
                    "max_rent": max_rent or 99999.0,
                    "min_bedrooms": min_bedrooms or 0,
                    "destination_hub": destination_hub,
                    "vibe_query": vibe_query or ""
                }
                response = sfn.start_sync_execution(
                    stateMachineArn=self.state_machine_arn,
                    input=json.dumps(execution_input)
                )
                if response.get("status") == "SUCCEEDED":
                    output = json.loads(response.get("output", "{}"))
                    return {
                        "status": "SUCCEEDED",
                        "execution_type": "AWS_STEP_FUNCTIONS",
                        "tradeoffs": output.get("tradeoffs", []),
                        "destination_hub": destination_hub
                    }
            except Exception as e:
                print(f"[Orchestrator] AWS Step Functions execution error: {e}")

        # Local Step Functions Pipeline Execution Simulation
        # Step 1: Search Listings
        listings = domain_client.search_listings(suburb=suburb, max_rent=max_rent, min_bedrooms=min_bedrooms)

        # Step 2: Calculate Commutes
        origin_suburb = suburb or (listings[0]["suburb"] if listings else "Coogee")
        commute = tfnsw_client.trip_planner(origin_suburb, destination_hub)

        # Step 3: Score Lifestyle & Vibe
        if vibe_query:
            scored_listings = semantic_engine.rank_properties_by_vibe(vibe_query, listings)
        else:
            scored_listings = listings

        # Step 4: Synthesize Trade-offs
        tradeoffs = compute_tradeoffs(
            properties=scored_listings,
            destination_hub=destination_hub,
            vibe_query=vibe_query
        )

        return {
            "status": "SUCCEEDED",
            "execution_type": "LOCAL_STEP_ENGINE",
            "tradeoffs": [opt.model_dump() for opt in tradeoffs],
            "commute_summary": commute,
            "total_listings_evaluated": len(listings),
            "destination_hub": destination_hub
        }

orchestrator = PropertySearchOrchestrator()
