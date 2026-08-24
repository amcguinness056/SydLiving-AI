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
        "bg-white/80 hover:bg-white backdrop-blur-md rounded-2xl p-4 shadow-sm hover:shadow-md border border-white/80 hover:border-indigo-200 transition-all duration-300 cursor-pointer flex flex-col shrink-0 group relative overflow-hidden",
        isActive && "ring-2 ring-indigo-500 bg-indigo-50/70 border-indigo-200 shadow-md shadow-indigo-100/50",
        className
      )}
    >
      {/* Photo */}
      <div className="w-full h-36 rounded-xl mb-3 overflow-hidden relative shadow-inner shrink-0 bg-slate-100">
        <img 
          src={property.photo_url || "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80"} 
          alt={property.title} 
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80";
          }}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
      </div>

      {/* Top row: Title and Rent Badge */}
      <div className="flex justify-between items-start gap-2 mb-2">
        <h3 className="font-bold text-slate-800 line-clamp-1 text-[15px]">
          {property.title}
        </h3>
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
          <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-black whitespace-nowrap shrink-0 shadow-xs">
            ${property.weekly_rent}<span className="text-[10px] font-normal text-indigo-100">/wk</span>
          </div>
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
