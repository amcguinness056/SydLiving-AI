import { BedDouble, Bath, MapPin, Waves } from "lucide-react";
import { type Property } from "../api/client";
import { cn } from "../lib/utils";

interface PropertyCardProps {
  property: Property;
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export function PropertyCard({ property, className, onClick, isActive }: PropertyCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/20 p-4 transition-all duration-300",
        "bg-white/40 backdrop-blur-md hover:bg-white/60 hover:shadow-xl cursor-pointer hover:-translate-y-1",
        isActive && "ring-2 ring-indigo-500 bg-white/70 shadow-lg",
        className
      )}
    >
      <div className="flex flex-col gap-1 mb-2">
        <h3 className="text-lg font-semibold text-slate-800 line-clamp-2 leading-tight">{property.title}</h3>
        <div className="self-start bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm">
          ${property.weekly_rent}/wk
        </div>
      </div>
      
      <p className="text-slate-600 text-sm flex items-start mb-4 leading-snug">
        <MapPin className="w-4 h-4 mr-1 mt-0.5 text-slate-400 flex-shrink-0" />
        <span className="line-clamp-2">{property.address}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2 text-slate-700 text-sm font-medium">
        <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-lg">
          <BedDouble className="w-4 h-4 text-indigo-500" />
          {property.bedrooms} Bed
        </div>
        <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-lg">
          <Bath className="w-4 h-4 text-indigo-500" />
          {property.bathrooms} Bath
        </div>
        <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-lg">
          <Waves className="w-4 h-4 text-blue-500" />
          {property.distance_to_beach_km.toFixed(1)} km
        </div>
      </div>
      
      {/* Decorative gradient blob */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-400/10 rounded-full blur-2xl pointer-events-none" />
    </div>
  );
}
