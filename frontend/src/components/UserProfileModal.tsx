import { useState } from 'react';
import { X, Sparkles, Check, Briefcase, Clock, DollarSign, Bed, PawPrint, Car, Compass, Train } from 'lucide-react';
import { api, type User, type UserProfileUpdate } from '../api/client';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  onApplyToFilters?: (profile: UserProfileUpdate) => void;
}

const DESTINATION_HUBS = [
  'Martin Place',
  'Barangaroo',
  'Central',
  'Victoria Cross (North Sydney)',
  'Macquarie Park',
  'Parramatta'
];

const LIFESTYLE_OPTIONS = [
  { id: 'Beach Lover', label: '🏖️ Beach Proximity' },
  { id: 'Great Coffee & Cafes', label: '☕ Great Cafes & Coffee' },
  { id: 'Quiet & Leafy', label: '🌿 Quiet & Leafy' },
  { id: 'Nightlife & Dining', label: '🍸 Dining & Nightlife' },
  { id: 'Gyms & Coastal Walks', label: '🏃 Gyms & Coastal Walks' },
  { id: 'Family & Parks', label: '👨‍👩‍👧 Family & Parks' },
  { id: 'Harbor Views', label: '⛵ Harbor Views' }
];

const TRANSIT_OPTIONS = [
  { id: 'Sydney Metro M1', label: '🚇 Sydney Metro M1' },
  { id: 'Sydney Trains', label: '🚆 Sydney Trains' },
  { id: 'Sydney Ferries', label: '⛴️ Sydney Ferries' },
  { id: 'Light Rail', label: '🚊 Light Rail' },
  { id: 'Express Buses', label: '🚌 Express Buses' }
];

export function UserProfileModal({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onApplyToFilters
}: UserProfileModalProps) {
  const [workplaceHub, setWorkplaceHub] = useState(user.workplace_hub || 'Martin Place');
  const [maxCommuteMins, setMaxCommuteMins] = useState(user.max_commute_mins || 45);
  const [maxWeeklyRent, setMaxWeeklyRent] = useState(user.max_weekly_rent || 950);
  const [minBedrooms, setMinBedrooms] = useState(user.min_bedrooms || 1);
  const [hasPets, setHasPets] = useState(!!user.has_pets);
  const [needsParking, setNeedsParking] = useState(!!user.needs_parking);
  const [lifestyleVibes, setLifestyleVibes] = useState<string[]>(user.lifestyle_vibes || []);
  const [preferredTransit, setPreferredTransit] = useState<string[]>(user.preferred_transit_modes || []);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const toggleVibe = (vibe: string) => {
    if (lifestyleVibes.includes(vibe)) {
      setLifestyleVibes(lifestyleVibes.filter(v => v !== vibe));
    } else {
      setLifestyleVibes([...lifestyleVibes, vibe]);
    }
  };

  const toggleTransit = (mode: string) => {
    if (preferredTransit.includes(mode)) {
      setPreferredTransit(preferredTransit.filter(m => m !== mode));
    } else {
      setPreferredTransit([...preferredTransit, mode]);
    }
  };

  const handleSave = async (applyToFilters: boolean = false) => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const updatePayload: UserProfileUpdate = {
        workplace_hub: workplaceHub,
        max_commute_mins: maxCommuteMins,
        max_weekly_rent: maxWeeklyRent,
        min_bedrooms: minBedrooms,
        has_pets: hasPets,
        needs_parking: needsParking,
        lifestyle_vibes: lifestyleVibes,
        preferred_transit_modes: preferredTransit
      };

      const updated = await api.updateProfile(user.id, updatePayload);
      onUpdateUser(updated);
      setSavedSuccess(true);

      if (applyToFilters && onApplyToFilters) {
        onApplyToFilters(updatePayload);
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to save user profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.username} 
                className="w-10 h-10 rounded-full border-2 border-blue-500 shadow-xs" 
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Relocation & Commute Profile
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-[10px] font-bold border border-blue-100 dark:border-blue-900/40">
                  <Sparkles className="w-2.5 h-2.5" /> Powers Kai Concierge
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                Saved preferences for <span className="font-semibold text-slate-900 dark:text-slate-100">{user.username}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
          
          {/* Destination Hub & Commute */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Commute & Employment Hub
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Primary Workplace / Hub
                </label>
                <select 
                  value={workplaceHub} 
                  onChange={e => setWorkplaceHub(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {DESTINATION_HUBS.map(hub => (
                    <option key={hub} value={hub}>{hub}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Max Commute Tolerance
                  </label>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    ≤ {maxCommuteMins} mins
                  </span>
                </div>
                <input 
                  type="range" 
                  min={15} 
                  max={75} 
                  step={5}
                  value={maxCommuteMins}
                  onChange={e => setMaxCommuteMins(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>15m</span>
                  <span>35m (Avg)</span>
                  <span>75m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Budget & Bedrooms */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Budget & Housing Size
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Target Weekly Rent
                  </label>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ${maxWeeklyRent} / week
                  </span>
                </div>
                <input 
                  type="range" 
                  min={400} 
                  max={2500} 
                  step={50}
                  value={maxWeeklyRent}
                  onChange={e => setMaxWeeklyRent(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>$400</span>
                  <span>$1,200</span>
                  <span>$2,500+</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <Bed className="w-3 h-3 text-slate-400" /> Minimum Bedrooms
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMinBedrooms(num)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        minBedrooms === num
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {num === 4 ? '4+ Beds' : `${num} Bed`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Household Must-Haves */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Household Essentials
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label 
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  hasPets 
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30' 
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <PawPrint className={`w-4 h-4 ${hasPets ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-xs font-bold block text-slate-800 dark:text-slate-100">Pet-Friendly Home</span>
                    <span className="text-[10px] text-slate-700 dark:text-slate-300">Requires landlord pet approval</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={hasPets} 
                  onChange={e => setHasPets(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-md focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label 
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  needsParking 
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30' 
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Car className={`w-4 h-4 ${needsParking ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-xs font-bold block text-slate-800 dark:text-slate-100">Vehicle Parking</span>
                    <span className="text-[10px] text-slate-700 dark:text-slate-300">Requires 1+ parking spaces</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={needsParking} 
                  onChange={e => setNeedsParking(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-md focus:ring-blue-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Lifestyle Priorities */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Lifestyle Priorities
            </h3>

            <div className="flex flex-wrap gap-2">
              {LIFESTYLE_OPTIONS.map(opt => {
                const isSelected = lifestyleVibes.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleVibe(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Transit Modes */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Train className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Preferred Transit
            </h3>

            <div className="flex flex-wrap gap-2">
              {TRANSIT_OPTIONS.map(opt => {
                const isSelected = preferredTransit.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleTransit(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            {savedSuccess ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> Profile saved!
              </span>
            ) : (
              <span>Preferences automatically guide Kai's advice</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Save & Apply to Map</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
