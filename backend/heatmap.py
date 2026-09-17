from typing import Dict, Any, List
from pydantic import BaseModel
from tfnsw_client import tfnsw_client, SUBURB_STOPS
from domain_client import SUBURB_COORDS

class SuburbHeatmapPoint(BaseModel):
    suburb: str
    latitude: float
    longitude: float
    median_rent_weekly: float
    commute_minutes_to_cbd: int
    transit_mode: str
    destination_cbd_hub: str
    cost_per_commute_minute: float  # rent / commute
    efficiency_index: int  # 0 to 100
    tier: str  # "Top Value Sweet Spot", "Solid Balance", "Premium Lifestyle"
    tier_color: str  # "emerald", "blue", "amber"

# Benchmark median weekly rents across Sydney suburbs
SUBURB_MEDIAN_RENTS: Dict[str, float] = {
    "Surry Hills": 780.0,
    "Newtown": 680.0,
    "Marrickville": 640.0,
    "Waterloo": 720.0,
    "Paddington": 850.0,
    "Coogee": 820.0,
    "Bondi": 950.0,
    "Bondi Junction": 790.0,
    "Randwick": 750.0,
    "Balmain": 840.0,
    "Manly": 980.0,
    "Chatswood": 730.0,
    "North Sydney": 790.0,
    "Parramatta": 580.0
}

def generate_commute_cost_heatmap(destination_hub: str = "Martin Place") -> List[SuburbHeatmapPoint]:
    """Generates Sydney suburb commute-cost heatmap data comparing $/week rent vs minutes-to-CBD."""
    points: List[SuburbHeatmapPoint] = []

    # Calculate metrics for each suburb
    suburb_data = []
    for sub, coords in SUBURB_COORDS.items():
        median_rent = SUBURB_MEDIAN_RENTS.get(sub, 750.0)
        trip = tfnsw_client.trip_planner(sub, destination_hub)
        commute_mins = trip.get("duration_minutes", 28) if trip else 28
        mode = trip.get("transit_mode", "Train") if trip else "Train"

        suburb_data.append({
            "suburb": sub,
            "lat": coords["lat"],
            "lon": coords["lon"],
            "rent": median_rent,
            "commute": commute_mins,
            "mode": mode
        })

    # Normalized score calculation
    all_rents = [d["rent"] for d in suburb_data]
    all_commutes = [d["commute"] for d in suburb_data]

    min_rent, max_rent = min(all_rents), max(all_rents)
    min_commute, max_commute = min(all_commutes), max(all_commutes)

    for d in suburb_data:
        # Lower rent is better (1.0), lower commute is better (1.0)
        rent_score = 1.0 - ((d["rent"] - min_rent) / max(1, (max_rent - min_rent)))
        commute_score = 1.0 - ((d["commute"] - min_commute) / max(1, (max_commute - min_commute)))

        # Weight: 55% commute convenience, 45% rent affordability
        composite = (0.55 * commute_score) + (0.45 * rent_score)
        efficiency_index = int(round(composite * 100))

        cost_per_min = round(d["rent"] / max(1, d["commute"]), 1)

        if efficiency_index >= 70:
            tier = "Top Value Sweet Spot"
            color = "emerald"
        elif efficiency_index >= 45:
            tier = "Solid Balance"
            color = "blue"
        else:
            tier = "Premium Lifestyle"
            color = "amber"

        points.append(SuburbHeatmapPoint(
            suburb=d["suburb"],
            latitude=d["lat"],
            longitude=d["lon"],
            median_rent_weekly=d["rent"],
            commute_minutes_to_cbd=d["commute"],
            transit_mode=d["mode"],
            destination_cbd_hub=destination_hub,
            cost_per_commute_minute=cost_per_min,
            efficiency_index=efficiency_index,
            tier=tier,
            tier_color=color
        ))

    # Sort by efficiency index descending
    points.sort(key=lambda x: x.efficiency_index, reverse=True)
    return points
