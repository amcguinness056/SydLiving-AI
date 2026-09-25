import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
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
  isDarkMode?: boolean;
  onDrawCreated?: (layer: any, type: string) => void;
  onDrawDeleted?: () => void;
  workplace?: { lat: number; lng: number } | null;
  isSettingWorkplace?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
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
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 400);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function DrawControl({ onDrawCreated, onDrawDeleted }: { onDrawCreated?: (layer: any, type: string) => void, onDrawDeleted?: () => void }) {
  const map = useMap();
  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // @ts-ignore
    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polyline: false,
        marker: false,
        circlemarker: false,
        circle: {
          shapeOptions: {
            color: '#6366f1',
            fillColor: '#6366f1',
            fillOpacity: 0.15,
            weight: 2
          }
        },
        rectangle: {
          shapeOptions: {
            color: '#6366f1',
            fillColor: '#6366f1',
            fillOpacity: 0.15,
            weight: 2
          }
        },
        polygon: {
          allowIntersection: false,
          shapeOptions: {
            color: '#6366f1',
            fillColor: '#6366f1',
            fillOpacity: 0.15,
            weight: 2
          }
        }
      },
      edit: {
        featureGroup: drawnItems,
        edit: false,
        remove: true
      }
    });

    map.addControl(drawControl);

    const handleCreated = (e: any) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      if (onDrawCreated) onDrawCreated(e.layer, e.layerType);
    };
    
    const handleDeleted = () => {
      if (onDrawDeleted) onDrawDeleted();
    };

    // @ts-ignore
    map.on(L.Draw.Event.CREATED, handleCreated);
    // @ts-ignore
    map.on(L.Draw.Event.DELETED, handleDeleted);
    
    return () => {
      map.removeControl(drawControl);
      // @ts-ignore
      map.off(L.Draw.Event.CREATED, handleCreated);
      // @ts-ignore
      map.off(L.Draw.Event.DELETED, handleDeleted);
      map.removeLayer(drawnItems);
    };
  }, [map, onDrawCreated, onDrawDeleted]);
  return null;
}

const createCustomPriceIcon = (rent: number, isActive: boolean, isDark: boolean = false) => L.divIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex items-center justify-center px-3 py-1.5 rounded-full font-bold text-xs shadow-lg transition-all duration-300 cursor-pointer ${
    isActive 
      ? 'bg-rose-500 text-white scale-110 z-[100] ring-4 ring-rose-300 dark:ring-rose-900 shadow-rose-500/40 animate-marker-pulse' 
      : isDark
        ? 'bg-slate-900/95 backdrop-blur-md text-white hover:bg-blue-600 hover:text-white hover:scale-105 border border-slate-700/80'
        : 'bg-slate-900/90 backdrop-blur-md text-white hover:bg-blue-600 hover:text-white hover:scale-105 border border-white/40'
  }">
          <span>$${rent}</span>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
            isActive ? 'bg-rose-500' : isDark ? 'bg-slate-900/95' : 'bg-slate-900/90'
          }"></div>
         </div>`,
  iconSize: [60, 30],
  iconAnchor: [30, 30],
  popupAnchor: [0, -30],
});

export function Map({ 
  properties, 
  selectedPropertyId, 
  onSelectProperty, 
  isMaximized, 
  onToggleMaximize,
  isDarkMode = false,
  onDrawCreated,
  onDrawDeleted,
  workplace,
  isSettingWorkplace,
  onMapClick
}: MapProps) {
  const defaultCenter: [number, number] = [-33.8688, 151.2093];

  return (
    <div className={`w-full h-full relative overflow-hidden bg-slate-200 dark:bg-slate-950 ${isSettingWorkplace ? 'cursor-crosshair' : ''}`}>
      <MapContainer 
        center={defaultCenter} 
        zoom={12} 
        scrollWheelZoom={true} 
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <DrawControl onDrawCreated={onDrawCreated} onDrawDeleted={onDrawDeleted} />
        {onMapClick && isSettingWorkplace && <MapEvents onMapClick={onMapClick} />}
        
        {workplace && (
          <Marker 
            position={[workplace.lat, workplace.lng]}
            icon={L.divIcon({
              className: 'bg-transparent',
              html: `<div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white shadow-lg border-2 border-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 32],
            })}
          >
            <Popup className="rounded-xl overflow-hidden shadow-lg border-0">
              <div className="font-semibold text-slate-800 text-base leading-tight">Workplace</div>
            </Popup>
          </Marker>
        )}

        <TileLayer
          key={isDarkMode ? 'dark-tiles' : 'light-tiles'}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Property Price Markers */}
        {properties.map(property => (
          <Marker 
            key={property.id} 
            position={[property.latitude, property.longitude]}
            icon={createCustomPriceIcon(property.weekly_rent, selectedPropertyId === property.id, isDarkMode)}
            eventHandlers={{ click: () => onSelectProperty && onSelectProperty(property.id) }}
          >
            <Popup className="rounded-2xl overflow-hidden shadow-xl border-0 p-0">
              <div className="p-3.5 font-sans bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">{property.title}</div>
                <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  {property.suburb} • {property.distance_to_beach_km.toFixed(1)} km to beach
                </div>
                
                <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">${property.weekly_rent}/wk</div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {property.bedrooms} Bed • {property.bathrooms} Bath
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapUpdater properties={properties} selectedId={selectedPropertyId} />
        <MapResizer />
      </MapContainer>

      {/* Enlarge / Restore Map Button */}
      {onToggleMaximize && (
        <button
          onClick={onToggleMaximize}
          className="absolute top-4 right-4 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 p-2.5 rounded-2xl shadow-xl border border-white/60 dark:border-slate-800 transition-all hover:scale-105 active:scale-95"
          title={isMaximized ? "Restore view" : "Enlarge map"}
        >
          {isMaximized ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
}
