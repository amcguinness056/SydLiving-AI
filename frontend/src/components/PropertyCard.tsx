import { BedDouble, Bath, MapPin, Waves, Heart } from "lucide-react";
import { type Property } from "../api/client";
import { cn } from "../lib/utils";

interface PropertyCardProps {
  property: Property;
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
  isSaved?: boolean;
  onToggleSave?: (id: string, isSaved: boolean) => void;
}

export function PropertyCard({ property, className, onClick, isActive, isSaved, onToggleSave }: PropertyCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer flex flex-col shrink-0",
        isActive && "ring-2 ring-indigo-500 bg-indigo-50/50",
        className
      )}
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <h3 className="font-semibold text-slate-800 line-clamp-1 text-[15px]">{property.title}</h3>
        <div className="flex items-center gap-2">
          {onToggleSave && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(property.id, !!isSaved);
              }}
              className="p-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <Heart className={cn("w-4 h-4", isSaved ? "fill-red-500 text-red-500" : "text-slate-400")} />
            </button>
          )}
          <div className="bg-indigo-600 text-white px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0 shadow-sm">
            ${property.weekly_rent}/wk
          </div>
        </div>
      </div>
      
      <p className="text-slate-500 text-xs flex items-center mb-4">
        <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
        <span className="truncate">{property.address}</span>
      </p>

      <div className="flex items-center gap-4 text-slate-600 text-xs font-medium mt-auto">
        <div className="flex items-center gap-1.5">
          <BedDouble className="w-4 h-4 text-indigo-400" />
          {property.bedrooms}
        </div>
        <div className="flex items-center gap-1.5">
          <Bath className="w-4 h-4 text-indigo-400" />
          {property.bathrooms}
        </div>
        <div className="flex items-center gap-1.5">
          <Waves className="w-4 h-4 text-blue-400" />
          {property.distance_to_beach_km.toFixed(1)} km
        </div>
      </div>
    </div>
  );
}
