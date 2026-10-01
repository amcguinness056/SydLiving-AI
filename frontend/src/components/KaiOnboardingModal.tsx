import { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  MapPin, 
  DollarSign, 
  Clock, 
  PawPrint, 
  Car, 
  Heart, 
  Waves, 
  Coffee, 
  Trees, 
  UtensilsCrossed, 
  Dumbbell,
  Loader2
} from 'lucide-react';
import { api, type User, type UserProfileUpdate } from '../api/client';
import { cn } from '../lib/utils';

interface KaiOnboardingModalProps {
  isOpen: boolean;
  user: User;
  onComplete: (updatedUser: User) => void;
  onClose?: () => void;
}

const DESTINATION_HUBS = [
  { name: 'Martin Place', desc: 'CBD Finance & Metro M1' },
  { name: 'Barangaroo', desc: 'Waterfront, Tech & Ferries' },
  { name: 'Central', desc: 'Transport Interchange & Tech' },
  { name: 'Victoria Cross (North Sydney)', desc: 'North Shore & Metro M1' },
  { name: 'Macquarie Park', desc: 'North West Tech & Uni' },
  { name: 'Parramatta', desc: 'Western Sydney CBD' }
];

const BUDGET_PRESETS = [650, 850, 1000, 1300, 1750];
const COMMUTE_PRESETS = [30, 45, 60, 75];

const LIFESTYLE_CHIPS = [
  { id: 'Beach Lover', label: 'Beach Proximity', icon: Waves },
  { id: 'Great Coffee & Cafes', label: 'Cafes & Coffee', icon: Coffee },
  { id: 'Quiet & Leafy', label: 'Quiet & Leafy', icon: Trees },
  { id: 'Nightlife & Dining', label: 'Dining & Nightlife', icon: UtensilsCrossed },
  { id: 'Gyms & Coastal Walks', label: 'Gyms & Walks', icon: Dumbbell }
];

export function KaiOnboardingModal({
  isOpen,
  user,
  onComplete,
  onClose
}: KaiOnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Form State
  const [workplaceHub, setWorkplaceHub] = useState(user.workplace_hub || 'Martin Place');
  const [customHub, setCustomHub] = useState('');
  const [isCustomHub, setIsCustomHub] = useState(false);

  const [maxWeeklyRent, setMaxWeeklyRent] = useState(user.max_weekly_rent || 950);
  const [maxCommuteMins, setMaxCommuteMins] = useState(user.max_commute_mins || 45);
  const [minBedrooms, setMinBedrooms] = useState(user.min_bedrooms || 1);

  const [hasPets, setHasPets] = useState(!!user.has_pets);
  const [needsParking, setNeedsParking] = useState(!!user.needs_parking);
  const [lifestyleVibes, setLifestyleVibes] = useState<string[]>(user.lifestyle_vibes || ['Great Coffee & Cafes']);

  if (!isOpen) return null;

  const firstName = user.username ? user.username.split(' ')[0] : 'there';

  const toggleLifestyle = (id: string) => {
    if (lifestyleVibes.includes(id)) {
      setLifestyleVibes(lifestyleVibes.filter(v => v !== id));
    } else {
      setLifestyleVibes([...lifestyleVibes, id]);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const selectedHub = isCustomHub && customHub.trim() ? customHub.trim() : workplaceHub;
      const payload: UserProfileUpdate = {
        workplace_hub: selectedHub,
        max_weekly_rent: maxWeeklyRent,
        max_commute_mins: maxCommuteMins,
        min_bedrooms: minBedrooms,
        has_pets: hasPets,
        needs_parking: needsParking,
        lifestyle_vibes: lifestyleVibes
      };

      const updated = await api.updateProfile(user.id, payload);
      localStorage.setItem('sydliving_onboarding_completed', 'true');
      onComplete(updated);
    } catch (err) {
      console.error('Failed to save onboarding profile', err);
      // Fallback update to allow user to continue
      localStorage.setItem('sydliving_onboarding_completed', 'true');
      onComplete({
        ...user,
        workplace_hub: isCustomHub && customHub.trim() ? customHub.trim() : workplaceHub,
        max_weekly_rent: maxWeeklyRent,
        max_commute_mins: maxCommuteMins,
        min_bedrooms: minBedrooms,
        has_pets: hasPets,
        needs_parking: needsParking,
        lifestyle_vibes: lifestyleVibes
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-labelledby="onboarding-heading"
      >
        {/* Top Header / Progress Pill */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="onboarding-heading" className="text-base font-extrabold text-slate-900 dark:text-white">
                    Setup Kai Concierge
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/90 px-2 py-0.5 rounded-full border border-blue-200/70 dark:border-blue-900/60">
                    Step {step} of 3
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Customizing your Sydney commute & rental intelligence
                </p>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium underline"
              >
                Skip for now
              </button>
            )}
          </div>

          {/* Stepper Bar */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  s <= step 
                    ? "bg-blue-600 dark:bg-blue-500" 
                    : "bg-slate-200 dark:bg-slate-800"
                )}
              />
            ))}
          </div>
        </div>

        {/* Conversational Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
          {/* Kai Speech Bubble */}
          <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
              K
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Kai's Note
              </span>
              <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                {step === 1 && `G'day ${firstName}! Let's dial in your daily commute. Where do you need to travel to for work, uni, or client meetings?`}
                {step === 2 && `Spot on! Now let's nail your weekly rent comfort zone and the maximum one-way commute time you're happy with.`}
                {step === 3 && `Almost done, mate! Any furry friends coming along, a dedicated car space required, or lifestyle vibes you love?`}
              </p>
            </div>
          </div>

          {/* Step 1: Destination Workplace Hub */}
          {step === 1 && (
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600" />
                Select Primary Destination Hub
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DESTINATION_HUBS.map((hub) => {
                  const isSelected = !isCustomHub && workplaceHub === hub.name;
                  return (
                    <button
                      key={hub.name}
                      type="button"
                      onClick={() => {
                        setIsCustomHub(false);
                        setWorkplaceHub(hub.name);
                      }}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between group",
                        isSelected
                          ? "bg-blue-50/80 dark:bg-blue-950/60 border-blue-600 dark:border-blue-500 shadow-sm ring-1 ring-blue-600"
                          : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-700"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "font-bold text-xs",
                          isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-900 dark:text-white"
                        )}>
                          {hub.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        {hub.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Hub Option */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsCustomHub(true)}
                  className={cn(
                    "text-xs font-semibold underline transition-colors",
                    isCustomHub ? "text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  )}
                >
                  Work somewhere else in Sydney? Enter a custom suburb or hub
                </button>
                {isCustomHub && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={customHub}
                      onChange={(e) => setCustomHub(e.target.value)}
                      placeholder="e.g. St Leonards, Mascot, Sydney Uni..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Budget & Commute Duration */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Weekly Rent */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Target Weekly Rent
                  </label>
                  <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    ${maxWeeklyRent}/week
                  </span>
                </div>

                <input
                  type="range"
                  min="400"
                  max="2500"
                  step="50"
                  value={maxWeeklyRent}
                  onChange={(e) => setMaxWeeklyRent(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />

                <div className="flex flex-wrap gap-2 pt-1">
                  {BUDGET_PRESETS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setMaxWeeklyRent(b)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                        maxWeeklyRent === b
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                      )}
                    >
                      ${b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Commute Cap */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Max One-Way Commute Tolerance
                  </label>
                  <span className="text-sm font-black font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-1 rounded-xl border border-blue-200 dark:border-blue-800">
                    {maxCommuteMins} mins
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {COMMUTE_PRESETS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setMaxCommuteMins(mins)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer border",
                        maxCommuteMins === mins
                          ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                      )}
                    >
                      {mins} mins
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Lifestyle Vibes & Household Essentials */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Household Essentials */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Household Essentials
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHasPets(!hasPets)}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between",
                      hasPets
                        ? "bg-amber-50 dark:bg-amber-950/60 border-amber-500 dark:border-amber-600 shadow-2xs text-amber-950 dark:text-amber-200"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-amber-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <PawPrint className={cn("w-4 h-4", hasPets ? "text-amber-600" : "text-slate-400")} />
                      <span className="text-xs font-bold">Pet Friendly</span>
                    </div>
                    {hasPets && <Check className="w-4 h-4 text-amber-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setNeedsParking(!needsParking)}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between",
                      needsParking
                        ? "bg-indigo-50 dark:bg-blue-950/60 border-blue-600 dark:border-blue-500 shadow-2xs text-blue-950 dark:text-blue-200"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Car className={cn("w-4 h-4", needsParking ? "text-blue-600" : "text-slate-400")} />
                      <span className="text-xs font-bold">Needs Parking</span>
                    </div>
                    {needsParking && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                </div>
              </div>

              {/* Bedrooms */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Minimum Bedrooms
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((bed) => (
                    <button
                      key={bed}
                      type="button"
                      onClick={() => setMinBedrooms(bed)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer border",
                        minBedrooms === bed
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      )}
                    >
                      {bed === 4 ? '4+ Beds' : `${bed} Bed${bed > 1 ? 's' : ''}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lifestyle Vibes */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  Preferred Neighborhood Vibes
                </label>
                <div className="flex flex-wrap gap-2">
                  {LIFESTYLE_CHIPS.map((chip) => {
                    const isSelected = lifestyleVibes.includes(chip.id);
                    const Icon = chip.icon;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => toggleLifestyle(chip.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5",
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{chip.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as any)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer transition-all hover:scale-102 active:scale-98"
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleFinish}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calibrating Kai...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Meet Kai & View My Dossier
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
