import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { type Property, type DestinationHub, type IsochroneResponse } from '../api/client';
import { Maximize, Minimize, Clock, Navigation } from 'lucide-react';


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
  hubs: DestinationHub[];
  activeHubName: string;
  onSelectHub: (hubName: string) => void;
  maxCommuteMins: number;
  onChangeMaxCommute: (mins: number) => void;
  isochroneData?: IsochroneResponse | null;
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

const createCustomPriceIcon = (rent: number, isActive: boolean, isDark: boolean = false) => L.divIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex items-center justify-center px-3 py-1.5 rounded-full font-bold text-xs shadow-lg transition-all duration-300 cursor-pointer ${
    isActive 
      ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white scale-110 z-[100] ring-4 ring-rose-300 dark:ring-rose-900 shadow-rose-500/40' 
      : isDark
        ? 'bg-slate-900/95 backdrop-blur-md text-slate-100 hover:bg-indigo-600 hover:scale-105 border border-slate-700/80'
        : 'bg-slate-900/90 backdrop-blur-md text-white hover:bg-indigo-600 hover:scale-105 border border-white/40'
  }">
          <span>$${rent}</span>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
            isActive ? 'bg-amber-500' : isDark ? 'bg-slate-900/95' : 'bg-slate-900/90'
          }"></div>
         </div>`,
  iconSize: [60, 30],
  iconAnchor: [30, 30],
  popupAnchor: [0, -30],
});

const createHubIcon = (hubName: string) => L.divIcon({
  className: 'bg-transparent',
  html: `<div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <div class="absolute w-10 h-10 rounded-full bg-indigo-500/30 animate-ping"></div>
          <div class="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white font-black text-xs shadow-xl border-2 border-white dark:border-slate-900">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>${hubName}</span>
          </div>
        </div>`,
  iconSize: [120, 35],
  iconAnchor: [60, 18],
});

export function Map({ 
  properties, 
  selectedPropertyId, 
  onSelectProperty, 
  isMaximized, 
  onToggleMaximize,
  isDarkMode = false,
  hubs,
  activeHubName,
  onSelectHub,
  maxCommuteMins,
  onChangeMaxCommute,
  isochroneData: _isochroneData
}: MapProps) {

  const defaultCenter: [number, number] = [-33.8688, 151.2093];
  
  const activeHub = hubs.find(h => h.name === activeHubName) || hubs[0] || {
    id: "barangaroo",
    name: "Barangaroo",
    latitude: -33.8617,
    longitude: 151.2014,
    hub_type: "Waterfront Commercial Hub"
  };

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  // Determine transit line color based on mode
  const getPolylineColor = (mode?: string | null) => {
    if (!mode) return '#6366f1';
    if (mode.includes('Metro')) return '#06b6d4'; // Cyan for Metro M1
    if (mode.includes('Ferry')) return '#10b981'; // Emerald for Ferries
    if (mode.includes('Light Rail')) return '#f59e0b'; // Amber for Light Rail
    if (mode.includes('Bus')) return '#ec4899'; // Pink for Buses
    return '#6366f1'; // Indigo for Trains
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-200 dark:bg-slate-950">
      
      {/* Top Bar Controls Overlay */}
      <div className="absolute top-4 left-4 right-16 z-40 flex flex-wrap items-center gap-3 pointer-events-none">
        
        {/* Hub Selector */}
        <div className="pointer-events-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
          <Navigation className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-slate-400 dark:text-slate-500 font-normal">Hub:</span>
          <select
            value={activeHubName}
            onChange={(e) => onSelectHub(e.target.value)}
            className="bg-transparent font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer pr-1"
          >
            {hubs.map(hub => (
              <option key={hub.id} value={hub.name} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                {hub.name}
              </option>
            ))}
          </select>
        </div>

        {/* Reachability Slider */}
        <div className="pointer-events-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-semibold text-slate-800 dark:text-slate-100">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span className="text-slate-400 dark:text-slate-500 font-normal">Max:</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 w-12 text-left">{maxCommuteMins} min</span>
          </div>
          <input
            type="range"
            min="15"
            max="60"
            step="5"
            value={maxCommuteMins}
            onChange={(e) => onChangeMaxCommute(Number(e.target.value))}
            className="w-24 sm:w-32 accent-emerald-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
          />
        </div>
      </div>

      {/* Map Container */}
      <MapContainer 
        center={defaultCenter} 
        zoom={12} 
        scrollWheelZoom={true} 
        className="w-full h-full z-0"
        zoomControl={false}
      >
        {/* Dynamic Dark / Light CartoDB TileLayer */}
        <TileLayer
          key={isDarkMode ? 'dark-tiles' : 'light-tiles'}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url={
            isDarkMode
              ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          }
        />

        {/* Dynamic Isochrone Reach Rings centered on active Hub */}
        {activeHub && (
          <>
            {/* 15 min ring */}
            {maxCommuteMins >= 15 && (
              <Circle
                center={[activeHub.latitude, activeHub.longitude]}
                radius={4000}
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  fillOpacity: isDarkMode ? 0.12 : 0.08,
                  weight: 1.5,
                  dashArray: '4, 6'
                }}
              />
            )}

            {/* 30 min ring */}
            {maxCommuteMins >= 30 && (
              <Circle
                center={[activeHub.latitude, activeHub.longitude]}
                radius={9000}
                pathOptions={{
                  color: '#6366f1',
                  fillColor: '#6366f1',
                  fillOpacity: isDarkMode ? 0.08 : 0.05,
                  weight: 1.5,
                  dashArray: '5, 8'
                }}
              />
            )}

            {/* 45 min ring */}
            {maxCommuteMins >= 45 && (
              <Circle
                center={[activeHub.latitude, activeHub.longitude]}
                radius={16000}
                pathOptions={{
                  color: '#8b5cf6',
                  fillColor: '#8b5cf6',
                  fillOpacity: isDarkMode ? 0.05 : 0.03,
                  weight: 1,
                  dashArray: '6, 10'
                }}
              />
            )}

            {/* 60 min ring */}
            {maxCommuteMins >= 60 && (
              <Circle
                center={[activeHub.latitude, activeHub.longitude]}
                radius={25000}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#f59e0b',
                  fillOpacity: isDarkMode ? 0.04 : 0.02,
                  weight: 1,
                  dashArray: '6, 12'
                }}
              />
            )}

            {/* Destination Hub Pin */}
            <Marker
              position={[activeHub.latitude, activeHub.longitude]}
              icon={createHubIcon(activeHub.name)}
            >
              <Popup>
                <div className="p-2 font-sans">
                  <div className="font-extrabold text-indigo-600 text-sm">{activeHub.name}</div>
                  <div className="text-slate-500 text-xs">{activeHub.hub_type}</div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Transit Route Polyline to Selected Property */}
        {selectedProperty && activeHub && (
          <Polyline
            positions={[
              [selectedProperty.latitude, selectedProperty.longitude],
              [activeHub.latitude, activeHub.longitude]
            ]}
            pathOptions={{
              color: getPolylineColor(selectedProperty.transit_mode),
              weight: 4,
              dashArray: '8, 8',
              opacity: 0.9
            }}
          />
        )}

        {/* Property Price Markers */}
        {properties.map(property => (
          <Marker 
            key={property.id} 
            position={[property.latitude, property.longitude]}
            icon={createCustomPriceIcon(property.weekly_rent, selectedPropertyId === property.id, isDarkMode)}
            eventHandlers={{ click: () => onSelectProperty && onSelectProperty(property.id) }}
          >
            <Popup className="rounded-2xl overflow-hidden shadow-xl border-0 p-0">
              <div className="p-3 font-sans bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug">{property.title}</div>
                <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{property.suburb} • {property.distance_to_beach_km.toFixed(1)} km to beach</div>
                
                {property.commute_duration_minutes !== undefined && property.commute_duration_minutes !== null && (
                  <div className="text-emerald-600 dark:text-emerald-400 text-xs font-bold mt-1">
                    ⚡ {property.commute_duration_minutes}m to {activeHubName}
                  </div>
                )}
                
                <div className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm mt-1">${property.weekly_rent}/wk</div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapUpdater properties={properties} selectedId={selectedPropertyId} />
        <MapResizer />
      </MapContainer>

      {/* Isochrone Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-40 bg-white/85 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800 px-3.5 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>&le;15m</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          <span>&le;30m</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span>
          <span>&le;45m</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>&le;60m</span>
        </div>
      </div>

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

