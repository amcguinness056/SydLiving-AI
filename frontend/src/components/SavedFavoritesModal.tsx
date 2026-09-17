import { X, Heart, BedDouble, Bath, MapPin, ExternalLink, Trash2 } from 'lucide-react';
import { type Property } from '../api/client';

interface SavedFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: Property[];
  onRemoveFavorite: (id: string) => void;
  onSelectProperty: (id: string) => void;
}

export function SavedFavoritesModal({
  isOpen,
  onClose,
  favorites,
  onRemoveFavorite,
  onSelectProperty
}: SavedFavoritesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/60 max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-rose-50/50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500 flex items-center justify-center text-white shadow-xs">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">
                Saved Listings ({favorites.length})
              </h2>
              <p className="text-xs text-slate-500">Your shortlisted Sydney rental properties</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-rose-50 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-700 text-sm">No saved listings yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Click the heart icon on any property card or detail panel to save it to your shortlist!
              </p>
            </div>
          ) : (
            favorites.map((prop) => (
              <div 
                key={prop.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 transition-all flex items-center justify-between gap-4 shadow-xs hover:shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-extrabold text-indigo-600 text-sm">
                      ${prop.weekly_rent} <span className="text-[11px] text-slate-400 font-normal">/wk</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {prop.suburb}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-800 truncate mb-1">
                    {prop.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <BedDouble className="w-3 h-3 text-slate-400" /> {prop.bedrooms} bed
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="w-3 h-3 text-slate-400" /> {prop.bathrooms} bath
                    </span>
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-slate-400" /> {prop.address}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      onSelectProperty(prop.id);
                      onClose();
                    }}
                    className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                    title="View on map"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRemoveFavorite(prop.id)}
                    className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Remove from saved"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
