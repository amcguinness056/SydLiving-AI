import React from "react";
import { BedDouble, Bath, MapPin, Waves, Heart, Train } from "lucide-react";
import { type Property } from "../api/client";
import { cn } from "../lib/utils";


interface PropertyCardProps {
  property: Property;
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  selectedHubName?: string;
}

export function PropertyCard({ 
  property, 
  className, 
  onClick, 
  isActive,
  isFavorite,
  onToggleFavorite,
  selectedHubName
}: PropertyCardProps) {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(property.id);
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-850 backdrop-blur-md rounded-2xl p-4 shadow-sm hover:shadow-md border border-white/80 dark:border-slate-800/80 hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-all duration-300 cursor-pointer flex flex-col shrink-0 group relative overflow-hidden",
        isActive && "ring-2 ring-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-500/60 shadow-md shadow-indigo-100/50 dark:shadow-indigo-950/50",
        className
      )}
    >
      {/* Top row: Title, Favorite Heart & Rent Badge */}
      <div className="flex justify-between items-start gap-2 mb-1.5">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1 text-[15px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {property.title}
        </h3>
        
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleFavoriteClick}
            className={cn(
              "p-1.5 rounded-full transition-all hover:scale-110 active:scale-95",
              isFavorite 
                ? "text-rose-500 bg-rose-50 dark:bg-rose-950/50" 
                : "text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title={isFavorite ? "Remove from shortlist" : "Add to shortlist"}
          >
            <Heart className={cn("w-4 h-4", isFavorite && "fill-rose-500")} />
          </button>

          <div className="bg-indigo-600 dark:bg-indigo-500 text-white px-2.5 py-1 rounded-full text-xs font-black whitespace-nowrap shadow-xs">
            ${property.weekly_rent}<span className="text-[10px] font-normal text-indigo-100">/wk</span>
          </div>
        </div>
      </div>
      
      {/* Address */}
      <p className="text-slate-500 dark:text-slate-400 text-xs flex items-center mb-2.5 font-medium">
        <MapPin className="w-3.5 h-3.5 mr-1 text-indigo-400 shrink-0" />
        <span className="truncate">{property.address}</span>
      </p>

      {/* Commute Badge if available */}
      {property.commute_duration_minutes !== undefined && property.commute_duration_minutes !== null && (
        <div className="mb-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
          <Train className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">
            {property.commute_duration_minutes}m to {selectedHubName || "Hub"} {property.transit_mode ? `• ${property.transit_mode}` : ''}
          </span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-xs font-semibold mt-auto pt-2 border-t border-slate-100/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
            <BedDouble className="w-4 h-4 text-indigo-500" />
            <span>{property.bedrooms} Bed</span>
          </div>
          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
            <Bath className="w-4 h-4 text-indigo-500" />
            <span>{property.bathrooms} Bath</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/50 px-2 py-0.5 rounded-md font-semibold text-[11px]">
          <Waves className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          <span>{property.distance_to_beach_km.toFixed(1)} km</span>
        </div>
      </div>
    </div>
  );
}

