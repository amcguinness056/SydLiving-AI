import { useMemo } from 'react';
import { 
  Sparkles, 
  Train, 
  Clock, 
  ArrowRight, 
  Heart, 
  SlidersHorizontal, 
  MessageSquare,
  Coffee,
  Waves,
  Building2,
  CheckCircle2,
  Bed,
  Bath,
  ArrowLeft
} from 'lucide-react';
import { type Property, type User } from '../api/client';
import { computeKaiMatch } from '../lib/kaiMatch';
import { cn } from '../lib/utils';

export interface KaiConciergeHubProps {
  properties: Property[];
  user: User | null;
  shortlistedIds: string[];
  onToggleFavorite: (id: string) => void;
  onSelectProperty: (id: string) => void;
  onAskAgent: (prompt: string) => void;
  onOpenProfile: () => void;
  onBackToMap: () => void;
}

const SYDNEY_CORRIDORS = [
  {
    name: 'Sydney Metro M1 Corridor',
    tagline: 'Northwest to City & Sydenham',
    badge: 'Fastest Transit',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    icon: Train,
    commuteTime: '4 - 15 mins',
    vibe: 'Modern high-density towers, leafy village pockets, ultra-reliable 4-min frequency.',
    suburbs: ['Crows Nest', 'Victoria Cross', 'Chatswood', 'Barangaroo', 'Martin Place'],
    pros: 'Zero traffic anxiety, brand new stations, air-conditioned driverless trains.',
    cons: 'Higher rental prices, fewer classic heritage gardens.',
    rentMedian: '$880 - $1,250/wk'
  },
  {
    name: 'Eastern Suburbs Railway',
    tagline: 'Bondi Junction to City',
    badge: 'Coastal Balance',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    icon: Waves,
    commuteTime: '9 - 14 mins',
    vibe: 'Bustling beachside energy, surf culture, iconic cafes, high weekend foot traffic.',
    suburbs: ['Bondi Junction', 'Edgecliff', 'Paddington', 'Bondi Beach'],
    pros: 'Minutes to iconic Sydney beaches, excellent dining and coastal walks.',
    cons: 'High weekend congestion, older art-deco building stock, parking permits.',
    rentMedian: '$780 - $1,150/wk'
  },
  {
    name: 'Sydney Harbour Ferries & Inner West',
    tagline: 'Balmain & Manly to Circular Quay',
    badge: 'Iconic Scenic',
    badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    icon: Building2,
    commuteTime: '11 - 25 mins',
    vibe: 'Historic sandstone terraces, waterfront pub culture, relaxed community feel.',
    suburbs: ['Balmain', 'Birchgrove', 'Rozelle', 'Manly'],
    pros: 'Best commute views in the world across Sydney Harbour and the Bridge.',
    cons: 'Weather-dependent ferry timetable, tighter narrow streets.',
    rentMedian: '$850 - $1,200/wk'
  },
  {
    name: 'Inner South & Light Rail Hub',
    tagline: 'Surry Hills to Central',
    badge: 'Cafe Capital',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    icon: Coffee,
    commuteTime: '5 - 12 mins',
    vibe: 'Creative agencies, third-wave coffee, wine bars, leafy pocket parks.',
    suburbs: ['Surry Hills', 'Redfern', 'Chippendale', 'Alexandria'],
    pros: 'Unrivaled walkability to top-rated restaurants, bars, and Central Station.',
    cons: 'Street noise on weekends, compact apartment dimensions.',
    rentMedian: '$750 - $1,050/wk'
  }
];

export function KaiConciergeHub({
  properties,
  user,
  shortlistedIds,
  onToggleFavorite,
  onSelectProperty,
  onAskAgent,
  onOpenProfile,
  onBackToMap
}: KaiConciergeHubProps) {
  const destinationHub = user?.workplace_hub || 'Martin Place';
  const targetRent = user?.max_weekly_rent || 950;
  const targetCommute = user?.max_commute_mins || 45;

  // Compute top 3 algorithmic matches
  const topMatches = useMemo(() => {
    return [...properties]
      .map(property => ({
        property,
        match: computeKaiMatch(property, user)
      }))
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 3);
  }, [properties, user]);

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white custom-scrollbar">
      {/* Top Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-sky-600 text-white px-4 sm:px-8 py-8 sm:py-12 border-b border-blue-500/30 shadow-lg">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
        
        <div className="relative max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <button 
                type="button"
                onClick={onBackToMap}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs backdrop-blur-md transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Live Map</span>
              </button>

              <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-md flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Sydney Commute & Lifestyle Intelligence</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight mb-2">
              Kai Concierge Command Center
            </h1>
            <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
              G'day! Here's your personalized Sydney relocation briefing. We've synthesized commute lines to <strong className="text-white font-bold">{destinationHub}</strong>, rent trade-offs, and neighbourhood vibes tailored to your preferences.
            </p>
          </div>

          {/* Quick Profile Summary Badge Card */}
          <div className="w-full md:w-auto bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 min-w-[280px]">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold tracking-wider text-blue-200">Active Profile</span>
              <button 
                type="button"
                onClick={onOpenProfile}
                className="text-xs text-white hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Adjust</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/20 rounded-xl p-2.5">
                <div className="text-blue-200 text-[10px] font-bold uppercase">Destination Hub</div>
                <div className="font-extrabold text-white truncate">{destinationHub}</div>
              </div>
              <div className="bg-black/20 rounded-xl p-2.5">
                <div className="text-blue-200 text-[10px] font-bold uppercase">Max Weekly Rent</div>
                <div className="font-extrabold text-white">${targetRent}/wk</div>
              </div>
              <div className="bg-black/20 rounded-xl p-2.5">
                <div className="text-blue-200 text-[10px] font-bold uppercase">Commute Cap</div>
                <div className="font-extrabold text-white">{targetCommute} mins</div>
              </div>
              <div className="bg-black/20 rounded-xl p-2.5">
                <div className="text-blue-200 text-[10px] font-bold uppercase">Pets / Parking</div>
                <div className="font-extrabold text-white">
                  {user?.has_pets ? '🐾 Pet' : 'No pets'} • {user?.needs_parking ? '🚗 Parking' : 'No park'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 flex flex-col gap-10">
        
        {/* Section 1: Top 3 Algorithmic Matches */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  Kai's Top 3 Algorithmic Matches
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                Ranked by commute convenience to {destinationHub}, weekly rent, and lifestyle alignment.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {topMatches.map(({ property, match }, idx) => {
              const isFav = shortlistedIds.includes(property.id);
              return (
                <div 
                  key={property.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 flex flex-col group"
                >
                  {/* Photo Header */}
                  <div className="relative h-44 w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                    <img 
                      src={property.photo_url || "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80"}
                      alt={property.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                    {/* Rank Badge */}
                    <div className="absolute top-3 left-3 bg-blue-600 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-md">
                      #{idx + 1} Best Pick
                    </div>

                    {/* Heart Button */}
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(property.id)}
                      className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer"
                      title={isFav ? "Remove from shortlist" : "Save to shortlist"}
                    >
                      <Heart className={cn("w-4 h-4", isFav ? "text-rose-500 fill-rose-500" : "text-slate-400")} />
                    </button>

                    {/* Rent & Commute Pill */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                      <span className="font-black text-base drop-shadow-sm">
                        ${property.weekly_rent}<span className="text-xs font-normal text-slate-200">/wk</span>
                      </span>
                      <span className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                        <Clock className="w-3 h-3 text-blue-300" />
                        <span>{property.commute_duration_minutes ? `${property.commute_duration_minutes}m to ${destinationHub}` : `${property.distance_to_beach_km.toFixed(1)}km to beach`}</span>
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      {/* Kai Score Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1",
                          match.score >= 90
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        )}>
                          <Sparkles className="w-3 h-3" />
                          <span>{match.score}% Kai Match</span>
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {property.suburb}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-sm sm:text-base leading-snug line-clamp-1 mb-1 text-slate-900 dark:text-white">
                        {property.title}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium mb-3">
                        <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5 text-slate-400" />{property.bedrooms} Bed</span>
                        <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-slate-400" />{property.bathrooms} Bath</span>
                        <span>{property.property_type}</span>
                      </div>

                      {/* Kai's Insider Verdict */}
                      <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-2xl p-3 text-xs">
                        <div className="font-extrabold text-blue-900 dark:text-blue-200 mb-1 flex items-center gap-1">
                          <span>🎯 Kai's Verdict</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                          {match.verdict}
                        </p>
                      </div>

                      {/* Reasons bullet chips */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {match.reasons.map((reason, rIdx) => (
                          <span 
                            key={rIdx}
                            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            <span>{reason}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectProperty(property.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onAskAgent(`Kai, give me the honest pros and cons of ${property.title} in ${property.suburb} for someone commuting to ${destinationHub}.`)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        title="Ask Kai about this listing"
                      >
                        <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Sydney Commute Trade-off Matrix */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Train className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Sydney Commute Corridor Matrix
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-4">
            Understanding transit speeds, frequency, and lifestyle trade-offs relative to {destinationHub}.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SYDNEY_CORRIDORS.map((corridor) => {
              const IconComp = corridor.icon;
              return (
                <div 
                  key={corridor.name}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                            {corridor.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {corridor.tagline}
                          </p>
                        </div>
                      </div>
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border", corridor.badgeColor)}>
                        {corridor.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                      {corridor.vibe}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Commute Window</div>
                        <div className="font-extrabold text-slate-900 dark:text-white">{corridor.commuteTime}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Median Weekly Rent</div>
                        <div className="font-extrabold text-slate-900 dark:text-white">{corridor.rentMedian}</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-start gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
                        <span className="font-bold shrink-0">👍 Advantage:</span>
                        <span>{corridor.pros}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-bold shrink-0">⚠️ Trade-off:</span>
                        <span>{corridor.cons}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {corridor.suburbs.slice(0, 3).map((sub, sIdx) => (
                        <span key={sIdx} className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {sub}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => onAskAgent(`Kai, tell me how living in the ${corridor.name} compares to other Sydney areas for a commute to ${destinationHub}.`)}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>Ask Kai</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: One-Click Deep AI Consultation Prompts */}
        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-blue-800/40">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Consult Kai on Sydney Real Estate
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mb-6 max-w-2xl">
            Have questions about bond regulations, local coffee spots, or school zones? Tap any prompt below to launch a deep multi-agent inquiry with Kai.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              `Kai, compare Crows Nest vs Surry Hills for someone commuting to ${destinationHub}.`,
              `Find me the best 1 or 2 bedroom rentals under $${targetRent}/wk near a Sydney Metro station.`,
              `What are the hidden traps and extra costs when signing a rental lease in Sydney?`,
              `Where in Sydney can I find great cafes, beach proximity, and a commute under ${targetCommute} mins?`
            ].map((prompt, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => onAskAgent(prompt)}
                className="text-left p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 transition-all text-xs sm:text-sm font-semibold text-slate-100 flex items-center justify-between gap-3 group cursor-pointer"
              >
                <span>"{prompt}"</span>
                <ArrowRight className="w-4 h-4 text-blue-300 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
