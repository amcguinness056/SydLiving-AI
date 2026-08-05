import { X, BedDouble, Bath, MapPin, Waves, CalendarDays, Maximize, Minimize } from "lucide-react";
import { type Property } from "../api/client";

interface PropertyPanelProps {
  property: Property;
  onClose: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export function PropertyPanel({ property, onClose, isMaximized, onToggleMaximize }: PropertyPanelProps) {
  return (
    <div className="h-full w-full flex flex-col bg-white/60 backdrop-blur-2xl relative overflow-hidden animate-in slide-in-from-right-8 duration-300">
      
      {/* Header Image Placeholder */}
      <div className="w-full h-48 bg-gradient-to-br from-indigo-400 via-purple-400 to-blue-400 relative shrink-0">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {onToggleMaximize && (
            <button 
              onClick={onToggleMaximize}
              className="p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-full transition-colors"
              title={isMaximized ? "Restore view" : "Enlarge details"}
            >
              {isMaximized ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-full transition-colors"
            title="Close details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="absolute bottom-4 left-6 flex items-end gap-4">
          <div className="bg-white/90 backdrop-blur-md text-slate-800 px-4 py-2 rounded-2xl shadow-lg">
            <span className="text-2xl font-black">${property.weekly_rent}</span>
            <span className="text-sm font-semibold text-slate-500">/wk</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
        <h2 className="text-xl font-bold text-slate-800 mb-2">{property.title}</h2>
        <p className="text-slate-500 flex items-center gap-1.5 mb-6 text-sm">
          <MapPin className="w-4 h-4 text-indigo-400" />
          {property.address}
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/50 p-3 rounded-2xl border border-white/60 flex flex-col items-center justify-center gap-1 shadow-sm">
            <BedDouble className="w-5 h-5 text-indigo-500" />
            <span className="font-semibold text-slate-700 text-sm">{property.bedrooms} Beds</span>
          </div>
          <div className="bg-white/50 p-3 rounded-2xl border border-white/60 flex flex-col items-center justify-center gap-1 shadow-sm">
            <Bath className="w-5 h-5 text-indigo-500" />
            <span className="font-semibold text-slate-700 text-sm">{property.bathrooms} Baths</span>
          </div>
          <div className="bg-white/50 p-3 rounded-2xl border border-white/60 flex flex-col items-center justify-center gap-1 shadow-sm">
            <Waves className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-slate-700 text-sm">{property.distance_to_beach_km.toFixed(1)} km</span>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <h3 className="font-semibold text-slate-800">About this property</h3>
          <p className="text-slate-600 leading-relaxed text-sm">
            This beautiful {property.bedrooms} bedroom property in {property.suburb} offers an incredible lifestyle opportunity. 
            Situated just {property.distance_to_beach_km.toFixed(1)} km from the beach, it perfectly blends modern living with coastal charm. 
            Ask SydLiving AI in the chat to check commute times from {property.suburb} to your workplace!
          </p>
        </div>
        
        <div className="mt-auto pt-4 border-t border-slate-200/50 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays className="w-4 h-4" />
            Available Now
          </div>
          <button className="w-full xl:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-200 transition-colors">
            Apply Now
          </button>
        </div>
      </div>
    </div>
  );
}
