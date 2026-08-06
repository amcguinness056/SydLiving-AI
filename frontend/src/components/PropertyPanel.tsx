import { X, BedDouble, Bath, MapPin, Waves, CalendarDays, Maximize, Minimize, Train, Sparkles, ShieldCheck } from "lucide-react";
import { type Property } from "../api/client";

interface PropertyPanelProps {
  property: Property;
  onClose: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export function PropertyPanel({ property, onClose, isMaximized, onToggleMaximize }: PropertyPanelProps) {
  return (
    <div className="h-full w-full flex flex-col bg-white/70 backdrop-blur-2xl relative overflow-hidden animate-in slide-in-from-right-8 duration-300">
      
      {/* Header Banner */}
      <div 
        style={{ viewTransitionName: 'property-drawer-hero' }}
        className="w-full h-52 bg-slate-900 relative shrink-0 overflow-hidden"
      >
        {/* Subtle mesh background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(79,70,229,0.4),transparent)] pointer-events-none" />
        
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {onToggleMaximize && (
            <button 
              onClick={onToggleMaximize}
              className="p-2 bg-black/25 hover:bg-black/40 backdrop-blur-md text-white rounded-full transition-all hover:scale-105"
              title={isMaximized ? "Restore view" : "Enlarge details"}
            >
              {isMaximized ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2 bg-black/25 hover:bg-black/40 backdrop-blur-md text-white rounded-full transition-all hover:scale-105"
            title="Close details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="absolute bottom-4 left-6 flex items-end justify-between right-6">
          <div className="bg-white/95 backdrop-blur-md text-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-white/60">
            <span className="text-2xl font-black">${property.weekly_rent}</span>
            <span className="text-xs font-bold text-slate-500"> / week</span>
          </div>

          <div className="bg-emerald-500/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Listing</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 leading-tight mb-1.5">{property.title}</h2>
          <p className="text-slate-500 flex items-center gap-1.5 text-xs font-medium">
            <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{property.address}</span>
          </p>
        </div>

        {/* 3-Pill Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-1 shadow-sm">
            <BedDouble className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-800 text-xs">{property.bedrooms} Beds</span>
          </div>
          <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-1 shadow-sm">
            <Bath className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-800 text-xs">{property.bathrooms} Baths</span>
          </div>
          <div className="bg-white/80 p-3.5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-1 shadow-sm">
            <Waves className="w-5 h-5 text-blue-500" />
            <span className="font-bold text-slate-800 text-xs">{property.distance_to_beach_km.toFixed(1)} km</span>
          </div>
        </div>

        {/* Commute Intelligence Card */}
        <div className="bg-slate-100/90 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-slate-900 font-bold text-sm">
            <Train className="w-4 h-4 text-indigo-600" />
            <span>Commute to Sydney CBD</span>
          </div>
          <p className="text-slate-600 text-xs leading-relaxed">
            Direct door-to-door transit calculation available. Ask <strong className="text-indigo-700">SydLiving AI</strong> in the chat: <em className="text-slate-500 font-normal">"How long to commute from {property.suburb} to Wynyard?"</em>
          </p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 text-sm">Property Overview</h3>
          <p className="text-slate-600 leading-relaxed text-xs">
            This beautiful {property.bedrooms} bedroom residence in {property.suburb} provides an exceptional Sydney lifestyle. 
            Located just {property.distance_to_beach_km.toFixed(1)} km from the coastline with immediate access to local cafes, parks, and public transport hubs.
          </p>
        </div>
        
        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <CalendarDays className="w-4 h-4 text-emerald-500" />
            Available Now
          </div>
          <button className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs">
            Submit Application
          </button>
        </div>
      </div>
    </div>
  );
}
