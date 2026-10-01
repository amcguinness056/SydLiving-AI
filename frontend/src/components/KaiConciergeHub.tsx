import { useMemo } from 'react';
import { 
  Sparkles, 
  Clock, 
  ArrowRight, 
  Heart, 
  SlidersHorizontal, 
  MessageSquare,
  ArrowLeft,
  MapPin,
  DollarSign,
  Train,
  Lock,
  Compass,
  Waves,
  ShieldCheck,
  Bed,
  Bath
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
  onRequireAuth?: () => void;
}

export function KaiConciergeHub({
  properties,
  user,
  shortlistedIds,
  onToggleFavorite,
  onSelectProperty,
  onAskAgent,
  onOpenProfile,
  onBackToMap,
  onRequireAuth
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

  const topMatchSuburb = topMatches[0]?.property.suburb || 'Sydney';
  const firstName = user?.username ? user.username.split(' ')[0] : 'there';

  // Signed-out locked preview state
  if (!user) {
    return (
      <div className="w-full h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
          
          {/* Avatar Medallion with Live Pulse */}
          <div className="relative mb-5">
            <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25">
              <Sparkles className="w-8 h-8" />
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-4 ring-white dark:ring-slate-900 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold mb-3">
            <Lock className="w-3.5 h-3.5" />
            <span>Kai Concierge Relocation Dossier</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-3">
            Meet Kai — Your Sydney AI Concierge
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-8 max-w-md">
            Sign in to unlock personalized Sydney rental dossiers, door-to-door Transport for NSW commute intelligence, and multi-agent neighborhood advice.
          </p>

          {/* Value Highlights */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <Train className="w-4 h-4 text-blue-600 mb-1.5" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Transit Matrix</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                Exact peak travel times via Metro M1, trains & ferries.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <Sparkles className="w-4 h-4 text-emerald-600 mb-1.5" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Match Scoring</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                Ranked for your specific budget, pets & parking needs.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <ShieldCheck className="w-4 h-4 text-indigo-600 mb-1.5" />
              <div className="text-xs font-bold text-slate-900 dark:text-white">Insider Tips</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                Candid suburb trade-offs and street noise insights.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRequireAuth}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-102 active:scale-98"
            >
              <Sparkles className="w-4 h-4" />
              Sign In with Google to Meet Kai
            </button>

            <button
              type="button"
              onClick={onBackToMap}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm cursor-pointer transition-colors"
            >
              Explore Live Map First
            </button>
          </div>

        </div>
      </div>
    );
  }

  // Signed-in Conversational Relocation Dossier
  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-white custom-scrollbar">
      
      {/* Dossier Header Strip */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBackToMap}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>

            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                Kai Concierge Dossier
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Adjust Relocation Profile</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-8">
        
        {/* Personalized Kai Hero Briefing */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-lg shadow-blue-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-radial from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 relative">
            <div className="relative shrink-0">
              <div className="w-13 h-13 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 font-black text-lg">
                K
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60">
                  Kai's Executive Briefing
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Calibrated for {destinationHub}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                G'day {firstName}! Here's your tailored Sydney relocation game plan.
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                We've filtered Sydney's active rental market against your <strong className="text-slate-900 dark:text-white font-bold">{destinationHub}</strong> workplace hub, a <strong className="text-slate-900 dark:text-white font-bold">${targetRent}/wk</strong> budget, and a maximum commute cap of <strong className="text-slate-900 dark:text-white font-bold">{targetCommute} minutes</strong>. Here are your strongest contenders and candid local trade-offs.
              </p>
            </div>
          </div>

          {/* Active Relocation Vitals Bar */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Workplace Hub</div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{destinationHub}</div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
              <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Budget</div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">${targetRent}/week</div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Commute Cap</div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">Under {targetCommute}m</div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
              <Compass className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Essentials</div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  {user?.has_pets ? '🐾 Pets' : 'No pets'} • {user?.needs_parking ? '🚗 Parking' : 'No car'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Kai's Top 3 Tailored Matches */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Kai's Top 3 Algorithmic Matches
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Highest ranked for commute efficiency to {destinationHub} and lifestyle match.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topMatches.map(({ property, match }, idx) => {
              const isShortlisted = shortlistedIds.includes(property.id);
              const rankLabels = ['#1 Best Pick', '#2 Best Pick', '#3 Best Pick'];
              
              return (
                <div
                  key={property.id}
                  onClick={() => onSelectProperty(property.id)}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer flex flex-col group"
                >
                  {/* Image Container */}
                  <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img 
                      src={property.photo_url} 
                      alt={property.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white font-extrabold text-[10px] shadow-md shadow-blue-600/30">
                        {rankLabels[idx]}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(property.id);
                      }}
                      className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white backdrop-blur-md transition-colors"
                      title={isShortlisted ? "Remove from shortlist" : "Save to shortlist"}
                    >
                      <Heart className={cn("w-4 h-4", isShortlisted && "text-rose-500 fill-rose-500")} />
                    </button>

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white drop-shadow-md">
                      <span className="text-base font-black bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl">
                        ${property.weekly_rent}<span className="text-xs font-normal">/wk</span>
                      </span>

                      {property.distance_to_beach_km != null && (
                        <span className="text-[11px] font-bold bg-slate-950/70 backdrop-blur-md px-2 py-1 rounded-xl flex items-center gap-1">
                          <Waves className="w-3 h-3 text-cyan-400" />
                          {property.distance_to_beach_km}km to beach
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                          match.score >= 90
                            ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : "bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        )}>
                          {match.score}% Kai Match
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                          {property.suburb}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {property.title}
                      </h4>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Bed className="w-3.5 h-3.5" />
                          {property.bedrooms} Bed
                        </span>
                        <span className="flex items-center gap-1">
                          <Bath className="w-3.5 h-3.5" />
                          {property.bathrooms} Bath
                        </span>
                        {property.commute_duration_minutes && (
                          <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 ml-auto">
                            <Train className="w-3.5 h-3.5" />
                            {property.commute_duration_minutes}m to CBD
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Kai's Insider Verdict Quote */}
                    <div className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 text-[11px] leading-relaxed">
                      <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1 mb-1">
                        <span className="text-amber-500">🎯</span> Kai's Verdict
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 line-clamp-2">
                        {match.verdict}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section: Curated Deep Dive Consultations */}
        <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60 rounded-3xl p-5 sm:p-7 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                One-Click Consultations with Kai
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Launch deep multi-agent research on these suburbs tailored to your relocation profile.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onAskAgent(`Compare my top 3 matches on weekend walkability, cafe scene, and street noise.`)}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-800/80 hover:border-blue-500 text-left transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
            >
              <div>
                <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  Walkability & Noise Comparison
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Compare top 3 suburbs on vibe, dining, and quietness.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
            </button>

            <button
              type="button"
              onClick={() => onAskAgent(`What are the fastest transit commute alternatives to ${destinationHub} within a $${targetRent}/wk budget?`)}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-800/80 hover:border-blue-500 text-left transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
            >
              <div>
                <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  Fast Commute Alternatives
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Uncover high-frequency lines under {targetCommute} mins to {destinationHub}.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
            </button>

            <button
              type="button"
              onClick={() => onAskAgent(`Give me candid Sydney insider pros and cons of living in ${topMatchSuburb}.`)}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-800/80 hover:border-blue-500 text-left transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
            >
              <div>
                <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  Spotlight on {topMatchSuburb}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Local parking realities, supermarkets, and hidden perks.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
            </button>

            <button
              type="button"
              onClick={() => onAskAgent(`Show me rental options under $${targetRent}/wk with easy beach access and parking.`)}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-800/80 hover:border-blue-500 text-left transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
            >
              <div>
                <div className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  Beach & Lifestyle Sweet Spots
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Balance ocean proximity with your weekly rent limit.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
