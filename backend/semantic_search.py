import os
import math
import re
from typing import List, Dict, Any, Optional

# Suburb vibe metadata dictionary representing Sydney neighborhoods
SUBURB_VIBES: Dict[str, str] = {
    "Coogee": "laid-back coastal beachside lifestyle ocean breeze morning swim coastal walk cafes relaxed family friendly",
    "Bondi": "iconic world famous beach vibrant energetic surf ocean views trendy cafes dining coastal walk active nightlife",
    "Bondi Junction": "bustling commercial transit hub shopping Westfield easy rail commute near beaches urban convenience",
    "Surry Hills": "leafy hipster boutique dining artisan bakeries specialty coffee world class restaurants vibrant arts creative agencies",
    "Newtown": "eclectic bohemian live music craft beer indie bookstores vegan dining leafy vintage culture alternative youthful",
    "Paddington": "leafy heritage Victorian terraces quiet tree-lined streets boutique art galleries high-end fashion quiet village feel",
    "Manly": "scenic ferry commute seaside beachside haven surf pine trees ocean promenade relaxed harbor village lifestyle",
    "Balmain": "historic harbor village historic pubs waterfront parks quiet leafy boutique streets village atmosphere ferry commute",
    "Randwick": "leafy university hospital precinct direct light rail quiet residential parks close to Coogee beach",
    "Chatswood": "thriving North Shore commercial hub Asian dining mega shopping centers ultra fast Metro express to CBD",
    "Parramatta": "second CBD Western Sydney hub fast rivercat and express rail multicultural dining extensive shopping",
    "Marrickville": "creative industrial craft breweries Vietnamese bakeries live music diverse leafy multicultural arts scene",
    "North Sydney": "harbor views high-tech business center Victoria Cross Metro quick rail into CBD quiet weekends",
    "Waterloo": "modern high-rise apartments brand new Metro station leafy community parks gourmet eateries inner-city"
}

def _tokenize(text: str) -> List[str]:
    """Tokenizes and normalizes text into lowercase words."""
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    stop_words = {"the", "and", "for", "with", "this", "that", "from", "near", "are", "have", "room", "apartment", "house"}
    return [w for w in words if w not in stop_words]

def _vectorize(tokens: List[str]) -> Dict[str, float]:
    """Calculates term frequency vector."""
    vec: Dict[str, float] = {}
    for t in tokens:
        vec[t] = vec.get(t, 0.0) + 1.0
    # Normalize length
    norm = math.sqrt(sum(v * v for v in vec.values()))
    if norm > 0:
        for k in vec:
            vec[k] /= norm
    return vec

def _cosine_similarity(vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
    """Computes cosine similarity between two normalized sparse vectors."""
    dot_product = sum(val * vec_b.get(term, 0.0) for term, val in vec_a.items())
    return max(0.0, min(1.0, dot_product))

class SemanticSearchEngine:
    """Semantic vector search engine for property listings and suburb vibes."""

    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")

    def compute_similarity(self, query: str, document_text: str) -> float:
        """Computes semantic similarity between query and document text."""
        query_vec = _vectorize(_tokenize(query))
        doc_vec = _vectorize(_tokenize(document_text))
        return _cosine_similarity(query_vec, doc_vec)

    def rank_properties_by_vibe(
        self,
        query: str,
        properties: List[Dict[str, Any]],
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """Ranks a list of properties according to semantic vibe similarity to query."""
        if not query or not properties:
            return properties[:top_k]

        query_tokens = _tokenize(query)
        query_vec = _vectorize(query_tokens)

        scored: List[tuple[float, Dict[str, Any]]] = []
        for prop in properties:
            suburb = prop.get("suburb", "")
            title = prop.get("title", "")
            desc = prop.get("description", "")
            suburb_vibe = SUBURB_VIBES.get(suburb, f"Sydney {suburb} neighborhood residential")

            combined_doc = f"{suburb} {suburb_vibe} {title} {desc}"
            doc_vec = _vectorize(_tokenize(combined_doc))
            sim_score = _cosine_similarity(query_vec, doc_vec)

            # Enrich property copy with similarity score
            enriched_prop = dict(prop)
            enriched_prop["vibe_score"] = round(sim_score, 3)
            scored.append((sim_score, enriched_prop))

        # Sort descending by vibe score
        scored.sort(key=lambda x: x[0], reverse=True)
        return [p for _, p in scored[:top_k]]

semantic_engine = SemanticSearchEngine()
