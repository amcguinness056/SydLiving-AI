import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { type Property } from '../api/client';

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
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13, { duration: 1.5 });
  }, [center, map]);
  return null;
}

export function Map({ properties, selectedPropertyId }: MapProps) {
  // Sydney coordinates
  const defaultCenter: [number, number] = [-33.8688, 151.2093];
  
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);
  const center = selectedProperty 
    ? [selectedProperty.latitude, selectedProperty.longitude] as [number, number]
    : defaultCenter;

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-white/20">
      <MapContainer 
        center={defaultCenter} 
        zoom={12} 
        scrollWheelZoom={true} 
        className="w-full h-full"
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
          >
            <Popup className="rounded-xl overflow-hidden">
              <div className="font-semibold text-slate-800">{property.title}</div>
              <div className="text-indigo-600 font-bold mt-1">${property.weekly_rent}/wk</div>
            </Popup>
          </Marker>
        ))}
        <MapUpdater center={center} />
      </MapContainer>
    </div>
  );
}
