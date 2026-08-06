import { BedDouble, Bath, MapPin, Waves, Navigation } from "lucide-react";
import { type Property } from "../api/client";
import { cn } from "../lib/utils";

interface PropertyCardProps {
  property: Property;
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
  index?: number;
}

export function PropertyCard({ property, className, onClick, isActive, index = 0 }: PropertyCardProps) {
  return (
    <div
      onClick={onClick}
      style={{ 
        animationDelay: `${index * 60}ms`,
        viewTransitionName: isActive ? 'property-drawer-hero' : undefined
      }}
      className={cn(
        "bg-white/80 hover:bg-white backdrop-blur-md rounded-2xl p-4 shadow-sm hover:shadow-md border border-white/80 hover:border-indigo-200 transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col shrink-0 group relative overflow-hidden animate-spring-entry",
        isActive && "ring-2 ring-indigo-500 bg-indigo-50/70 border-indigo-200 shadow-md shadow-indigo-100/50 -translate-y-1",
        className
      )}
    >
      {/* Top row: Title and Rent Badge */}
      <div className="flex justify-between items-start gap-2 mb-2">
        <h3 className="font-bold text-slate-800 line-clamp-1 text-[15px]">
          {property.title}
        </h3>
        <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-black whitespace-nowrap shrink-0 shadow-xs">
          ${property.weekly_rent}<span className="text-[10px] font-normal text-indigo-100">/wk</span>
        </div>
      </div>
      
      {/* Address */}
      <p className="text-slate-500 text-xs flex items-center mb-3 font-medium">
        <MapPin className="w-3.5 h-3.5 mr-1 text-indigo-400 shrink-0" />
        <span className="truncate">{property.address}</span>
      </p>

      {/* Metrics Row */}
      <div className="flex items-center justify-between text-slate-600 text-xs font-semibold mt-auto pt-2 border-t border-slate-100/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-slate-700">
            <BedDouble className="w-4 h-4 text-indigo-500" />
            <span>{property.bedrooms} Bed</span>
          </div>
          <div className="flex items-center gap-1 text-slate-700">
            <Bath className="w-4 h-4 text-indigo-500" />
            <span>{property.bathrooms} Bath</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-blue-600 bg-blue-50/80 border border-blue-100 px-2 py-0.5 rounded-md font-semibold text-[11px]">
          <Waves className="w-3.5 h-3.5 text-blue-500" />
          <span>{property.distance_to_beach_km.toFixed(1)} km</span>
        </div>
      </div>
    </div>
  );
}
