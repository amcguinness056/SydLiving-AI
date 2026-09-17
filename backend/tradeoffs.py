from typing import List, Dict, Any, Optional
from models import Property, TradeoffOption
from tfnsw_client import tfnsw_client
from semantic_search import semantic_engine

def compute_tradeoffs(
    properties: List[Dict[str, Any]],
    destination_hub: str = "Martin Place",
    vibe_query: Optional[str] = None
) -> List[TradeoffOption]:
    """Evaluates candidate properties and synthesizes 2-3 distinct labelled trade-off options:
    - 🏷️ Cheapest
    - ⏱️ Fastest Commute
    - ⭐ Best Overall
    """
    if not properties:
        return []

    # If vibe_query provided, rank and score with semantic engine
    if vibe_query:
        candidates = semantic_engine.rank_properties_by_vibe(vibe_query, properties, top_k=min(20, len(properties)))
    else:
        candidates = [dict(p) for p in properties[:20]]

    # Compute commute for each unique suburb
    commute_cache: Dict[str, Dict[str, Any]] = {}
    for p in candidates:
        sub = p.get("suburb", "Sydney")
        if sub not in commute_cache:
            trip = tfnsw_client.trip_planner(sub, destination_hub)
            commute_cache[sub] = trip or {
                "duration_minutes": 30,
                "transit_mode": "Train",
                "origin": sub,
                "destination": destination_hub
            }

    # 1. Cheapest Candidate
    cheapest_prop = min(candidates, key=lambda x: x.get("weekly_rent", 99999))
    cheapest_commute = commute_cache.get(cheapest_prop.get("suburb", "Sydney"), {})
    cheapest_dur = cheapest_commute.get("duration_minutes", 30)
    cheapest_mode = cheapest_commute.get("transit_mode", "Transit")

    cheapest_option = TradeoffOption(
        label="Cheapest",
        property=Property(**cheapest_prop),
        commute_minutes=cheapest_dur,
        transit_mode=cheapest_mode,
        reasoning=f"${int(cheapest_prop.get('weekly_rent', 0))}/week in {cheapest_prop.get('suburb')}. Maximum budget savings with a {cheapest_dur}-min {cheapest_mode} ride to {destination_hub}.",
        badge_color="emerald"
    )

    # 2. Fastest Commute Candidate
    fastest_prop = min(candidates, key=lambda x: commute_cache.get(x.get("suburb", "Sydney"), {}).get("duration_minutes", 999))
    fastest_commute = commute_cache.get(fastest_prop.get("suburb", "Sydney"), {})
    fastest_dur = fastest_commute.get("duration_minutes", 30)
    fastest_mode = fastest_commute.get("transit_mode", "Transit")

    fastest_option = TradeoffOption(
        label="Fastest Commute",
        property=Property(**fastest_prop),
        commute_minutes=fastest_dur,
        transit_mode=fastest_mode,
        reasoning=f"Door-to-door in just {fastest_dur} mins from {fastest_prop.get('suburb')} to {destination_hub} via {fastest_mode}.",
        badge_color="blue"
    )

    # 3. Best Overall Candidate (Composite score)
    # Normalize price, duration, vibe score
    rents = [p.get("weekly_rent", 800) for p in candidates]
    min_rent, max_rent = min(rents), max(max(rents), min(rents) + 1)
    
    durs = [commute_cache.get(p.get("suburb", "Sydney"), {}).get("duration_minutes", 30) for p in candidates]
    min_dur, max_dur = min(durs), max(max(durs), min(durs) + 1)

    def score_prop(p: Dict[str, Any]) -> float:
        rent = p.get("weekly_rent", 800)
        dur = commute_cache.get(p.get("suburb", "Sydney"), {}).get("duration_minutes", 30)
        vibe = p.get("vibe_score", 0.5)

        # Higher is better: inverted price and duration
        price_norm = 1.0 - ((rent - min_rent) / (max_rent - min_rent))
        dur_norm = 1.0 - ((dur - min_dur) / (max_dur - min_dur))
        
        return (0.4 * dur_norm) + (0.35 * price_norm) + (0.25 * vibe)

    best_prop = max(candidates, key=score_prop)
    best_commute = commute_cache.get(best_prop.get("suburb", "Sydney"), {})
    best_dur = best_commute.get("duration_minutes", 30)
    best_mode = best_commute.get("transit_mode", "Transit")

    best_option = TradeoffOption(
        label="Best Overall",
        property=Property(**best_prop),
        commute_minutes=best_dur,
        transit_mode=best_mode,
        reasoning=f"Optimal sweet spot: authentic {best_prop.get('suburb')} vibe, reasonable ${int(best_prop.get('weekly_rent', 0))}/wk rent, and effortless {best_dur}-min {best_mode} transit.",
        badge_color="amber"
    )

    options = [cheapest_option, fastest_option, best_option]
    
    # Deduplicate by property ID while preserving unique labels if overlapping
    unique_options = []
    seen_ids = set()
    for opt in options:
        if opt.property.id not in seen_ids:
            seen_ids.add(opt.property.id)
            unique_options.append(opt)
        elif len(candidates) > len(unique_options):
            # Pick next candidate to provide 2-3 distinct property choices
            for alt in candidates:
                if alt["id"] not in seen_ids:
                    seen_ids.add(alt["id"])
                    alt_commute = commute_cache.get(alt.get("suburb", "Sydney"), {})
                    unique_options.append(
                        TradeoffOption(
                            label=opt.label,
                            property=Property(**alt),
                            commute_minutes=alt_commute.get("duration_minutes", 30),
                            transit_mode=alt_commute.get("transit_mode", "Transit"),
                            reasoning=f"Strong alternative for {opt.label}: ${int(alt.get('weekly_rent', 0))}/wk in {alt.get('suburb')}.",
                            badge_color=opt.badge_color
                        )
                    )
                    break

    return unique_options[:3]
