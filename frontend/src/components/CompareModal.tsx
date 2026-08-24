import { X, BedDouble, Waves, Train, DollarSign, Trash2, Sparkles, ArrowRight } from 'lucide-react';
import { type Property } from '../api/client';


interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  shortlistedIds: string[];
  onRemoveFromShortlist: (id: string) => void;
  onSelectProperty: (id: string) => void;
  selectedHubName?: string;
}

export function CompareModal({
  isOpen,
  onClose,
  properties,
  shortlistedIds,
  onRemoveFromShortlist,
  onSelectProperty,
  selectedHubName = "CBD Hub"
}: CompareModalProps) {
  if (!isOpen) return null;

  const shortlistedProps = properties.filter(p => shortlistedIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Shortlist & Commute Comparison
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Comparing {shortlistedProps.length} selected {shortlistedProps.length === 1 ? 'property' : 'properties'} with transit metrics to {selectedHubName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {shortlistedProps.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">No properties in shortlist yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Click the heart icon on any property card or detail panel to save it for side-by-side comparison.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {shortlistedProps.map(property => {
                const monthlyRent = Math.round(property.weekly_rent * 4.333);
                const weeklyOpal = property.estimated_opal_fare ? (property.estimated_opal_fare * 10).toFixed(2) : "38.00";
                
                return (
                  <div 
                    key={property.id}
                    className="bg-white/80 dark:bg-slate-850 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    {/* Top title & remove */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-base leading-snug line-clamp-2">
                          {property.title}
                        </h4>
                        <button
                          onClick={() => onRemoveFromShortlist(property.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors shrink-0"
                          title="Remove from shortlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{property.suburb}</p>
                    </div>

                    {/* Price Matrix */}
                    <div className="bg-slate-50 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-center">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Weekly Rent</div>
                        <div className="text-base font-black text-indigo-600 dark:text-indigo-400">${property.weekly_rent}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Est. Monthly</div>
                        <div className="text-base font-black text-slate-700 dark:text-slate-200">${monthlyRent}</div>
                      </div>
                    </div>

                    {/* Commute Specs */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                          <Train className="w-3.5 h-3.5 text-indigo-500" /> Commute to {selectedHubName}
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {property.commute_duration_minutes !== undefined && property.commute_duration_minutes !== null 
                            ? `${property.commute_duration_minutes} mins` 
                            : 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">Transit Mode</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                          {property.transit_mode || "Public Transit"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">Transfers</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {property.transfers === 0 ? "Direct (0)" : `${property.transfers} transfer`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Weekly Opal (10 trips)
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">${weeklyOpal}</span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Waves className="w-3.5 h-3.5 text-blue-500" /> Beach Proximity
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{property.distance_to_beach_km.toFixed(1)} km</span>
                      </div>

                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <BedDouble className="w-3.5 h-3.5 text-indigo-500" /> Bed / Bath
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{property.bedrooms} Bed • {property.bathrooms} Bath</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => {
                        onSelectProperty(property.id);
                        onClose();
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 dark:shadow-indigo-950/40 transition-all"
                    >
                      <span>Highlight on Map</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {shortlistedProps.length} of 10 shortlist slots used
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
