import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { type Property } from '../api/client';
import { Maximize, Minimize } from 'lucide-react';

// Fix Leaflet's default icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
  properties: Property[];
  selectedPropertyId?: string | null;
  onSelectProperty?: (id: string) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

function MapUpdater({ properties, selectedId }: { properties: Property[], selectedId?: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedId) {
      const p = properties.find(x => x.id === selectedId);
      if (p) {
        map.flyTo([p.latitude, p.longitude], 15, { duration: 1.5 });
      }
    } else if (properties.length > 0) {
      const bounds = L.latLngBounds(properties.map(p => [p.latitude, p.longitude]));
      map.flyToBounds(bounds, { duration: 1.5, padding: [50, 50], maxZoom: 14 });
    }
  }, [properties, selectedId, map]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

const createCustomPriceIcon = (rent: number, isActive: boolean) => L.divIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex items-center justify-center px-3 py-1.5 rounded-full font-bold text-xs shadow-lg transition-all duration-300 cursor-pointer ${
    isActive 
      ? 'bg-rose-500 text-white scale-110 z-[100] ring-4 ring-rose-200 shadow-rose-500/30 animate-marker-pulse' 
      : 'bg-slate-900/90 backdrop-blur-md text-white hover:bg-indigo-600 hover:scale-105 border border-white/40'
  }">
          <span>$${rent}</span>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
            isActive ? 'bg-rose-500' : 'bg-slate-900/90'
          }"></div>
         </div>`,
  iconSize: [60, 30],
  iconAnchor: [30, 30],
  popupAnchor: [0, -30],
});

export function Map({ properties, selectedPropertyId, onSelectProperty, isMaximized, onToggleMaximize }: MapProps) {
  const defaultCenter: [number, number] = [-33.8688, 151.2093];

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-200">
      <MapContainer 
        center={defaultCenter} 
        zoom={12} 
        scrollWheelZoom={true} 
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {properties.map(property => (
          <Marker 
            key={property.id} 
            position={[property.latitude, property.longitude]}
            icon={createCustomPriceIcon(property.weekly_rent, selectedPropertyId === property.id)}
            eventHandlers={{ click: () => onSelectProperty && onSelectProperty(property.id) }}
          >
            <Popup className="rounded-2xl overflow-hidden shadow-xl border-0 p-0">
              <div className="p-3 font-sans bg-white/95 backdrop-blur-md">
                <div className="font-bold text-slate-800 text-sm leading-snug">{property.title}</div>
                <div className="text-slate-500 text-xs mt-0.5">{property.suburb} • {property.distance_to_beach_km.toFixed(1)} km to beach</div>
                <div className="text-indigo-600 font-extrabold text-sm mt-1.5">${property.weekly_rent}/wk</div>
              </div>
            </Popup>
          </Marker>
        ))}
        <MapUpdater properties={properties} selectedId={selectedPropertyId} />
        <MapResizer />
      </MapContainer>

      {/* Glass Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-40 bg-white/80 backdrop-blur-md border border-white/60 px-3.5 py-2 rounded-2xl shadow-lg flex items-center gap-2 text-xs font-semibold text-slate-700 animate-float-subtle">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Sydney Coastal Transit Active</span>
      </div>

      {/* Floating UI overlays on map */}
      {onToggleMaximize && (
        <button
          onClick={onToggleMaximize}
          className="absolute top-4 right-4 z-50 bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 p-2.5 rounded-2xl shadow-lg border border-white/60 transition-all hover:scale-105 active:scale-95"
          title={isMaximized ? "Restore view" : "Enlarge map"}
        >
          {isMaximized ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
}
