import { X, BedDouble, Bath, MapPin, Waves, CalendarDays, Maximize, Minimize, Train, ShieldCheck, Heart, DollarSign, Repeat, Compass } from "lucide-react";
import { type Property } from "../api/client";
import { cn } from "../lib/utils";

interface PropertyPanelProps {
  property: Property;
  onClose: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  selectedHubName?: string;
}

export function PropertyPanel({ 
  property, 
  onClose, 
  isMaximized, 
  onToggleMaximize,
  isFavorite = false,
  onToggleFavorite,
  selectedHubName
}: PropertyPanelProps) {
  const hasCommuteData = property.commute_duration_minutes !== undefined && property.commute_duration_minutes !== null;
  const weeklyOpal = property.estimated_opal_fare ? (property.estimated_opal_fare * 10).toFixed(2) : "38.00";

  return (
    <div className="h-full w-full flex flex-col bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl relative overflow-hidden animate-in slide-in-from-right-8 duration-300 border-l border-white/60 dark:border-slate-800">
      
      {/* Header Banner */}
      <div className="w-full h-52 bg-slate-900 relative shrink-0 overflow-hidden">
        <img 
          src={property.photo_url || "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80"} 
          alt={property.title} 
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80";
          }}
          className="absolute inset-0 w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />
        
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {onToggleFavorite && (
            <button 
              onClick={() => onToggleFavorite(property.id)}
              className={cn(
                "p-2 rounded-full backdrop-blur-md transition-all hover:scale-105 active:scale-95",
                isFavorite 
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/30" 
                  : "bg-black/30 hover:bg-black/50 text-white"
              )}
              title={isFavorite ? "Remove from shortlist" : "Add to shortlist"}
            >
              <Heart className={cn("w-5 h-5", isFavorite && "fill-white text-white")} />
            </button>
          )}

          {onToggleMaximize && (
            <button 
              onClick={onToggleMaximize}
              className="p-2 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white rounded-full transition-all hover:scale-105 active:scale-95"
              title={isMaximized ? "Restore view" : "Enlarge details"}
            >
              {isMaximized ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white rounded-full transition-all hover:scale-105 active:scale-95"
            title="Close details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="absolute bottom-4 left-6 flex items-end justify-between right-6">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white px-4 py-2 rounded-2xl shadow-xl border border-white/60 dark:border-slate-700/60">
            <span className="text-2xl font-black">${property.weekly_rent}</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400"> / week</span>
          </div>

          <div className="bg-emerald-500/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Listing</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 text-slate-800 dark:text-slate-100">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight mb-1.5">{property.title}</h2>
          <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 text-xs font-medium">
            <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{property.address}</span>
          </p>
        </div>

        {/* 3-Pill Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/80 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1 shadow-sm">
            <BedDouble className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">{property.bedrooms} Beds</span>
          </div>
          <div className="bg-white/80 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1 shadow-sm">
            <Bath className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">{property.bathrooms} Baths</span>
          </div>
          <div className="bg-white/80 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 flex flex-col items-center justify-center gap-1 shadow-sm">
            <Waves className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">{property.distance_to_beach_km.toFixed(1)} km</span>
          </div>
        </div>

        {/* Enriched Commute Intelligence Card */}
        <div className="bg-gradient-to-br from-indigo-50/90 to-blue-50/60 dark:from-slate-900 dark:to-indigo-950/40 border border-indigo-100/90 dark:border-indigo-900/50 rounded-2xl p-4.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-bold text-sm">
              <Train className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
              <span>Transit to {selectedHubName || "CBD Hub"}</span>
            </div>
            {hasCommuteData && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-extrabold text-xs shadow-xs">
                {property.commute_duration_minutes} mins
              </span>
            )}
          </div>

          {hasCommuteData ? (
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-indigo-100/70 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-indigo-500" /> Primary Line
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{property.transit_mode || "Public Transit"}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-indigo-100/70 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 text-indigo-500" /> Route Transfers
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {property.transfers === 0 ? "Direct (0 transfers)" : `${property.transfers} transfer`}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-indigo-100/70 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Est. Weekly Opal (10 trips)
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">${weeklyOpal}/wk</span>
              </div>

              {property.route_summary && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 pt-1 leading-relaxed bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100/50 dark:border-slate-800">
                  <strong className="text-indigo-700 dark:text-indigo-300 font-semibold">Route: </strong>
                  {property.route_summary}
                </p>
              )}
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
              Select a destination hub above to view exact door-to-door transit schedules and weekly Opal costs.
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Property Overview</h3>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
            {property.description || `This exceptional ${property.bedrooms} bedroom residence in ${property.suburb} provides an authentic Sydney lifestyle. Located just ${property.distance_to_beach_km.toFixed(1)} km from the coastline with rapid access to local dining precincts, parks, and frequent public transit connections.`}
          </p>
        </div>
        
        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <CalendarDays className="w-4 h-4 text-emerald-500" />
            Available Now
          </div>
          <button className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 dark:shadow-indigo-950/50 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs">
            Submit Application
          </button>
        </div>
      </div>
    </div>
  );
}
