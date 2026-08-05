import { X, BedDouble, Bath, MapPin, Waves, CalendarDays } from "lucide-react";
import { type Property } from "../api/client";
import { useEffect } from "react";

interface PropertyModalProps {
  property: Property;
  onClose: () => void;
}

export function PropertyModal({ property, onClose }: PropertyModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Image Placeholder */}
        <div className="w-full h-48 bg-gradient-to-br from-indigo-400 via-purple-400 to-blue-400 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="absolute bottom-4 left-6 flex items-end gap-4">
            <div className="bg-white/90 backdrop-blur-md text-slate-800 px-4 py-2 rounded-2xl shadow-lg">
              <span className="text-2xl font-black">${property.weekly_rent}</span>
              <span className="text-sm font-semibold text-slate-500">/wk</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{property.title}</h2>
          <p className="text-slate-500 flex items-center gap-1.5 mb-8">
            <MapPin className="w-4 h-4 text-indigo-400" />
            {property.address}
          </p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white/50 p-4 rounded-2xl border border-white/60 flex flex-col items-center justify-center gap-2 shadow-sm">
              <BedDouble className="w-6 h-6 text-indigo-500" />
              <span className="font-semibold text-slate-700">{property.bedrooms} Beds</span>
            </div>
            <div className="bg-white/50 p-4 rounded-2xl border border-white/60 flex flex-col items-center justify-center gap-2 shadow-sm">
              <Bath className="w-6 h-6 text-indigo-500" />
              <span className="font-semibold text-slate-700">{property.bathrooms} Baths</span>
            </div>
            <div className="bg-white/50 p-4 rounded-2xl border border-white/60 flex flex-col items-center justify-center gap-2 shadow-sm">
              <Waves className="w-6 h-6 text-blue-500" />
              <span className="font-semibold text-slate-700">{property.distance_to_beach_km.toFixed(1)} km</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800 text-lg">About this property</h3>
            <p className="text-slate-600 leading-relaxed">
              This beautiful {property.bedrooms} bedroom property in {property.suburb} offers an incredible lifestyle opportunity. 
              Situated just {property.distance_to_beach_km.toFixed(1)} km from the beach, it perfectly blends modern living with coastal charm. 
              Ask SydLiving AI in the chat to check commute times from {property.suburb} to your workplace!
            </p>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-200/50 flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="w-4 h-4" />
              Available Now
            </div>
            <button className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-200 transition-colors">
              Apply Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
