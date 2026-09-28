import { type Property, type User } from '../api/client';

export interface KaiMatchResult {
  score: number; // 0 to 100
  isKaiPick: boolean;
  headline: string;
  reasons: string[];
  verdict: string;
}

export function computeKaiMatch(property: Property, user?: User | null): KaiMatchResult {
  let score = 86;
  const reasons: string[] = [];

  const targetRent = user?.max_weekly_rent || 1000;
  const targetCommute = user?.max_commute_mins || 45;
  const targetBedrooms = user?.min_bedrooms || 1;
  const destinationHub = user?.workplace_hub || 'Martin Place';

  // 1. Budget Match
  if (property.weekly_rent <= targetRent) {
    const diff = Math.round(targetRent - property.weekly_rent);
    if (diff > 50) {
      score += 6;
      reasons.push(`$${diff}/wk under your $${targetRent} budget`);
    } else {
      score += 3;
      reasons.push(`Within your $${targetRent}/wk budget`);
    }
  } else if (property.weekly_rent <= targetRent * 1.1) {
    score -= 8;
    reasons.push(`Slightly over target budget (+$${Math.round(property.weekly_rent - targetRent)}/wk)`);
  } else {
    score -= 18;
    reasons.push(`Above target budget of $${targetRent}/wk`);
  }

  // 2. Bedrooms Match
  if (property.bedrooms >= targetBedrooms) {
    score += 3;
  } else {
    score -= 15;
    reasons.push(`Fewer bedrooms than target (${property.bedrooms} vs ${targetBedrooms})`);
  }

  // 3. Commute Match
  if (property.commute_duration_minutes) {
    if (property.commute_duration_minutes <= targetCommute) {
      score += 6;
      reasons.push(`${property.commute_duration_minutes}m to ${destinationHub} (within ${targetCommute}m goal)`);
    } else {
      score -= 12;
      reasons.push(`${property.commute_duration_minutes}m to ${destinationHub} (exceeds ${targetCommute}m)`);
    }
  } else if (property.route_summary) {
    reasons.push(`Transit line: ${property.route_summary}`);
  }

  // 4. Pet Match
  if (user?.has_pets) {
    if (property.pet_friendly) {
      score += 5;
      reasons.push('Pet-friendly approved home');
    } else {
      score -= 15;
      reasons.push('Requires landlord pet check');
    }
  }

  // 5. Parking Match
  if (user?.needs_parking) {
    if (property.parking_spaces && property.parking_spaces > 0) {
      score += 4;
      reasons.push(`${property.parking_spaces} dedicated car space(s)`);
    } else {
      score -= 12;
      reasons.push('Street parking only');
    }
  }

  // 6. Coastal / Beach Proximity
  if (property.distance_to_beach_km <= 2.0) {
    score += 4;
    reasons.push(`${property.distance_to_beach_km.toFixed(1)} km to Sydney coastline`);
  }

  // Clamp score
  const finalScore = Math.min(Math.max(score, 45), 98);
  const isKaiPick = finalScore >= 85;

  let verdict = '';
  if (finalScore >= 90) {
    verdict = `Standout match for your Sydney relocation. Fits your budget and commute sweet spot effortlessly.`;
  } else if (finalScore >= 80) {
    verdict = `Solid contender offering authentic ${property.suburb} living with reliable transit convenience.`;
  } else {
    verdict = `Decent option, but review the commute and pricing trade-offs before locking in an inspection.`;
  }

  return {
    score: finalScore,
    isKaiPick,
    headline: `${finalScore}% Lifestyle & Commute Match`,
    reasons: reasons.slice(0, 3),
    verdict
  };
}
