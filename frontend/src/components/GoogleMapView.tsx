import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  APIProvider,
  Map as GMap,
  AdvancedMarker,
  InfoWindow,
  useMap
} from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { type Property, type User, type Place } from '../api/client';
import { Maximize, Minimize, Train, Trash2, Key, ExternalLink, Sparkles, Coffee, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { computeKaiMatch } from '../lib/kaiMatch';

export type MarkerMode = 'price' | 'score' | 'dots';

export interface GoogleMapViewProps {
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
  user?: User | null;
  recommendedPlaces?: Place[];
  selectedPlaceName?: string | null;
  onSelectPlace?: (placeName: string | null) => void;
  onClearRecommendedPlaces?: () => void;
}

// Controls camera transitions for selected properties, recommended venues, and bound adjustments
function CameraController({
  properties,
  selectedId,
  recommendedPlaces = [],
  selectedPlace = null
}: {
  properties: Property[];
  selectedId?: string | null;
  recommendedPlaces?: Place[];
  selectedPlace?: Place | null;
}) {
  const map = useMap();
  const prevSelectedIdRef = useRef<string | null | undefined>(undefined);
  const prevSelectedPlaceKeyRef = useRef<string>('');
  const prevPlacesKeyRef = useRef<string>('');
  const prevPropertyIdsKeyRef = useRef<string>('');

  useEffect(() => {
    if (!map) return;

    // Prioritize panning to explicitly selected recommended venue
    if (selectedPlace && selectedPlace.latitude && selectedPlace.longitude) {
      const placeKey = `${selectedPlace.name}-${selectedPlace.latitude}-${selectedPlace.longitude}`;
      if (placeKey !== prevSelectedPlaceKeyRef.current) {
        prevSelectedPlaceKeyRef.current = placeKey;
        map.panTo({ lat: selectedPlace.latitude, lng: selectedPlace.longitude });
        map.setZoom(16);
      }
      return;
    }
    prevSelectedPlaceKeyRef.current = '';

    // If both active listing and recommended venues exist, fit bounds to show both
    if (selectedId && recommendedPlaces.length > 0) {
      const placesKey = `${selectedId}-${recommendedPlaces.map(p => p.name).join(',')}`;
      if (placesKey !== prevPlacesKeyRef.current) {
        prevPlacesKeyRef.current = placesKey;
        const activeP = properties.find(x => x.id === selectedId);
        if (activeP) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: activeP.latitude, lng: activeP.longitude });
          recommendedPlaces.forEach(pl => {
            if (pl.latitude && pl.longitude) {
              bounds.extend({ lat: pl.latitude, lng: pl.longitude });
            }
          });
          map.fitBounds(bounds, { top: 90, right: 90, bottom: 90, left: 90 });
          return;
        }
      }
    }
    prevPlacesKeyRef.current = '';

    // Standard selected property pan
    if (selectedId) {
      if (selectedId !== prevSelectedIdRef.current) {
        prevSelectedIdRef.current = selectedId;
        const p = properties.find(x => x.id === selectedId);
        if (p) {
          map.panTo({ lat: p.latitude, lng: p.longitude });
          map.setZoom(15);
        }
      }
      return;
    }

    prevSelectedIdRef.current = null;

    if (properties.length > 0) {
      const currentKey = properties.map(p => p.id).sort().join(',');
      if (currentKey !== prevPropertyIdsKeyRef.current) {
        prevPropertyIdsKeyRef.current = currentKey;
        const bounds = new google.maps.LatLngBounds();
        properties.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude }));
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }
    } else {
      prevPropertyIdsKeyRef.current = '';
    }
  }, [map, properties, selectedId, recommendedPlaces, selectedPlace]);

  return null;
}

// Transit Layer Manager for Sydney Train & Light Rail visualization
function TransitLayerToggle({ showTransit }: { showTransit: boolean }) {
  const map = useMap();
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);

  useEffect(() => {
    if (!map) return;
    if (!transitLayerRef.current) {
      transitLayerRef.current = new google.maps.TransitLayer();
    }
    transitLayerRef.current.setMap(showTransit ? map : null);

    return () => {
      if (transitLayerRef.current) {
        transitLayerRef.current.setMap(null);
      }
    };
  }, [map, showTransit]);

  return null;
}

// Interactive Spatial Radius Filter (Editable & Draggable)
function CircleSpatialFilter({
  isPlacingCircle,
  onCirclePlaced,
  onDrawCreated,
  activeCircleRef
}: {
  isPlacingCircle: boolean;
  onCirclePlaced: () => void;
  onDrawCreated?: (layer: any, type: string) => void;
  activeCircleRef: React.MutableRefObject<google.maps.Circle | null>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const clickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!isPlacingCircle || !e.latLng) return;

      if (activeCircleRef.current) {
        activeCircleRef.current.setMap(null);
      }

      const circle = new google.maps.Circle({
        center: e.latLng,
        radius: 3500, // 3.5 km default commute radius
        editable: true,
        draggable: true,
        strokeColor: '#2563eb',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.18,
        zIndex: 10,
        map
      });

      const notifyFilter = () => {
        const center = circle.getCenter();
        const radius = circle.getRadius();
        if (center && onDrawCreated) {
          onDrawCreated(
            {
              getLatLng: () => ({ lat: center.lat(), lng: center.lng() }),
              getRadius: () => radius
            },
            'circle'
          );
        }
      };

      circle.addListener('center_changed', notifyFilter);
      circle.addListener('radius_changed', notifyFilter);

      activeCircleRef.current = circle;
      notifyFilter();
      onCirclePlaced();
    });

    return () => {
      google.maps.event.removeListener(clickListener);
    };
  }, [map, isPlacingCircle, onCirclePlaced, onDrawCreated, activeCircleRef]);

  return null;
}

// Custom Marker DOM element factory
function createMarkerContent(
  property: Property,
  markerMode: MarkerMode,
  isActive: boolean,
  matchScore: number,
  isDarkMode: boolean
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'sydliving-marker-wrapper cursor-pointer select-none';

  if (isActive) {
    el.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 9999px;
        background: #f43f5e;
        color: #ffffff;
        font-weight: 800;
        font-size: 12px;
        box-shadow: 0 10px 25px -5px rgba(244, 63, 94, 0.6);
        outline: 3px solid rgba(254, 205, 211, 0.95);
        transform: scale(1.12);
        z-index: 9999;
      ">
        <span>$${property.weekly_rent}</span>
        <span style="font-size: 10px; opacity: 0.9; background: rgba(0,0,0,0.25); padding: 1px 4px; border-radius: 9999px;">${matchScore}%</span>
      </div>
    `;
    return el;
  }

  if (markerMode === 'dots') {
    let dotColor = '#64748b';
    let ringColor = 'rgba(148, 163, 184, 0.4)';
    if (matchScore >= 90) {
      dotColor = '#10b981';
      ringColor = 'rgba(16, 185, 129, 0.45)';
    } else if (matchScore >= 75) {
      dotColor = '#3b82f6';
      ringColor = 'rgba(59, 130, 246, 0.45)';
    }

    el.innerHTML = `
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        background: ${dotColor};
        box-shadow: 0 0 0 3px ${ringColor}, 0 2px 4px rgba(0,0,0,0.3);
        transition: transform 0.15s ease;
      "></div>
    `;
    return el;
  }

  if (markerMode === 'score') {
    let bg = '#334155';
    let ring = 'rgba(148, 163, 184, 0.3)';
    if (matchScore >= 90) {
      bg = '#059669';
      ring = 'rgba(16, 185, 129, 0.45)';
    } else if (matchScore >= 75) {
      bg = '#2563eb';
      ring = 'rgba(59, 130, 246, 0.45)';
    }

    el.innerHTML = `
      <div style="
        padding: 3px 8px;
        border-radius: 9999px;
        background: ${bg};
        color: #ffffff;
        font-weight: 800;
        font-size: 11px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        outline: 2px solid ${ring};
        transition: transform 0.15s ease;
      ">
        <span>${matchScore}%</span>
      </div>
    `;
    return el;
  }

  // Price mode (default): compact pill with halo ring indicating Kai Match score
  let ringStyle = 'outline: 1.5px solid rgba(100, 116, 139, 0.4);';
  if (matchScore >= 90) {
    ringStyle = 'outline: 2.5px solid #10b981; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);';
  } else if (matchScore >= 75) {
    ringStyle = 'outline: 2px solid #3b82f6; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);';
  }

  const bg = isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.92)';

  el.innerHTML = `
    <div style="
      padding: 3px 9px;
      border-radius: 9999px;
      background: ${bg};
      color: #ffffff;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: -0.01em;
      ${ringStyle}
      backdrop-filter: blur(4px);
      transition: transform 0.15s ease;
      display: flex;
      align-items: center;
      gap: 3px;
    ">
      <span>$${property.weekly_rent}</span>
    </div>
  `;
  return el;
}

// Cluster renderer for clean grouping of Sydney property pins
class SydneyClusterRenderer {
  render(cluster: any, _stats: any, _map: google.maps.Map): google.maps.marker.AdvancedMarkerElement {
    const count = cluster.count;
    const countLabel = count > 99 ? '99+' : `${count}`;
    const el = document.createElement('div');
    el.className = 'sydliving-cluster-badge cursor-pointer transform transition-transform duration-200 hover:scale-110 active:scale-95';

    const size = count > 50 ? 46 : count > 15 ? 40 : 34;
    const fontSize = count > 50 ? 13 : 11;

    el.innerHTML = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 9999px;
        background: linear-gradient(135deg, #1d4ed8, #2563eb);
        color: white;
        font-weight: 800;
        font-size: ${fontSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 16px -2px rgba(37, 99, 235, 0.45);
        outline: 3px solid rgba(255, 255, 255, 0.85);
        user-select: none;
      ">
        ${countLabel}
      </div>
    `;

    return new google.maps.marker.AdvancedMarkerElement({
      position: cluster.position,
      content: el,
      zIndex: 1000 + count,
      title: `${count} properties in this area. Click to zoom.`
    });
  }
}

// Clustered Property Markers Component
function ClusteredPropertyMarkers({
  properties,
  selectedPropertyId,
  onSelectProperty,
  setHoveredProperty,
  markerMode,
  isDarkMode,
  user
}: {
  properties: Property[];
  selectedPropertyId?: string | null;
  onSelectProperty?: (id: string) => void;
  setHoveredProperty: (property: Property | null) => void;
  markerMode: MarkerMode;
  isDarkMode: boolean;
  user?: User | null;
}) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);

  useEffect(() => {
    if (!map) return;

    const clusterer = new MarkerClusterer({
      map,
      renderer: new SydneyClusterRenderer(),
      onClusterClick: (_event, cluster, targetMap) => {
        if (cluster.bounds) {
          targetMap.fitBounds(cluster.bounds, { top: 70, right: 70, bottom: 70, left: 70 });
        }
      }
    });

    clustererRef.current = clusterer;

    return () => {
      clusterer.clearMarkers();
      clusterer.setMap(null);
      clustererRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!clusterer || !map) return;

    clusterer.clearMarkers();

    const markers: google.maps.marker.AdvancedMarkerElement[] = properties.map(property => {
      const isActive = selectedPropertyId === property.id;
      const match = computeKaiMatch(property, user);
      const content = createMarkerContent(property, markerMode, isActive, match.score, isDarkMode);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: property.latitude, lng: property.longitude },
        title: property.title,
        content,
        zIndex: isActive ? 9999 : 100
      });

      let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

      marker.addListener('gmp-click', () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        setHoveredProperty(null);
        onSelectProperty?.(property.id);
      });

      content.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hoverTimeout) clearTimeout(hoverTimeout);
        setHoveredProperty(null);
        onSelectProperty?.(property.id);
      });

      content.addEventListener('mouseenter', () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          setHoveredProperty(property);
        }, 60);
      });

      content.addEventListener('mouseleave', () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        setHoveredProperty(null);
      });

      return marker;
    });

    clusterer.addMarkers(markers);

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }
    };
  }, [map, properties, markerMode, selectedPropertyId, user, isDarkMode, onSelectProperty, setHoveredProperty]);

  return null;
}

export function GoogleMapView({
  properties,
  selectedPropertyId,
  onSelectProperty,
  isMaximized,
  onToggleMaximize,
  isDarkMode = false,
  onDrawCreated,
  onDrawDeleted,
  workplace,
  onMapClick,
  user,
  recommendedPlaces = [],
  selectedPlaceName = null,
  onSelectPlace,
  onClearRecommendedPlaces
}: GoogleMapViewProps) {
  const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [showTransit, setShowTransit] = useState(false);
  const [markerMode, setMarkerMode] = useState<MarkerMode>('price');
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [hasSpatialFilter, setHasSpatialFilter] = useState(false);
  const [isPlacingCircle, setIsPlacingCircle] = useState(false);
  const activeCircleRef = useRef<google.maps.Circle | null>(null);

  // Sync selectedPlaceName with recommendedPlaces
  useEffect(() => {
    if (selectedPlaceName && recommendedPlaces.length > 0) {
      const q = selectedPlaceName.toLowerCase().trim();
      const match = recommendedPlaces.find(p => 
        p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase())
      );
      if (match) {
        setSelectedPlace(match);
      }
    } else if (!selectedPlaceName) {
      setSelectedPlace(null);
    }
  }, [selectedPlaceName, recommendedPlaces]);

  const handleClearDrawing = useCallback(() => {
    if (activeCircleRef.current) {
      activeCircleRef.current.setMap(null);
      activeCircleRef.current = null;
    }
    setHasSpatialFilter(false);
    setIsPlacingCircle(false);
    onDrawDeleted?.();
  }, [onDrawDeleted]);

  // If no API key is provided, display setup banner with clear instructions
  if (!apiKey) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-8 overflow-hidden">
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]" />

        <div className="relative z-10 max-w-lg w-full bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4 text-blue-400">
            <Key className="w-7 h-7" />
          </div>

          <h3 className="text-xl font-black text-white mb-2">
            Google Maps Platform Ready
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            To view high-detail Sydney vector maps with 3D tilt, Street View, transit lines, and hardware-accelerated 60 FPS rendering, add your API key to <code className="px-2 py-0.5 rounded bg-slate-950 text-blue-300 font-mono text-xs">frontend/.env</code>:
          </p>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-left font-mono text-xs text-blue-400 mb-6 select-all">
            VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_git_agentskills_v1"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all"
            >
              <span>Get Free Demo Key</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href="https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_git_agentskills_v1"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition-all"
            >
              <span>Terms of Service</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
      <APIProvider
        apiKey={apiKey}
        libraries={['geometry', 'places', 'marker']}
      >
        <GMap
          id="sydliving-google-map"
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: -33.8688, lng: 151.2093 }}
          defaultZoom={12}
          internalUsageAttributionIds={['gmp_git_agentskills_v1']}
          colorScheme={isDarkMode ? 'DARK' : 'LIGHT'}
          gestureHandling="greedy"
          disableDefaultUI={false}
          fullscreenControl={false}
          streetViewControl={true}
          mapTypeControl={true}
          zoomControl={true}
          className="w-full h-full"
          onClick={(e) => {
            setHoveredProperty(null);
            if (e.detail.latLng && onMapClick) {
              onMapClick(e.detail.latLng.lat, e.detail.latLng.lng);
            }
          }}
        >
          {/* Camera updates */}
          <CameraController
            properties={properties}
            selectedId={selectedPropertyId}
            recommendedPlaces={recommendedPlaces}
            selectedPlace={selectedPlace}
          />

          {/* Transit Layer */}
          <TransitLayerToggle showTransit={showTransit} />

          {/* Interactive Spatial Radius Filter */}
          <CircleSpatialFilter
            isPlacingCircle={isPlacingCircle}
            onCirclePlaced={() => {
              setIsPlacingCircle(false);
              setHasSpatialFilter(true);
            }}
            onDrawCreated={onDrawCreated}
            activeCircleRef={activeCircleRef}
          />

          {/* Workplace Marker if set */}
          {workplace && (
            <AdvancedMarker
              position={workplace}
              title="Workplace Location"
            >
              <div className="flex items-center justify-center p-2 rounded-full bg-rose-600 text-white shadow-lg ring-4 ring-rose-300">
                <span className="text-xs font-black">🏢 Work</span>
              </div>
            </AdvancedMarker>
          )}

          {/* Clustered Property Markers with Dynamic Styles */}
          <ClusteredPropertyMarkers
            properties={properties}
            selectedPropertyId={selectedPropertyId}
            onSelectProperty={onSelectProperty}
            setHoveredProperty={setHoveredProperty}
            markerMode={markerMode}
            isDarkMode={isDarkMode}
            user={user}
          />

          {/* Highlighted Local Recommendations Markers (Cafes, Dining, Bakeries) */}
          {recommendedPlaces.map((place, idx) => {
            if (!place.latitude || !place.longitude) return null;
            const isSelected = selectedPlace?.name === place.name || Boolean(
              selectedPlaceName && (
                selectedPlaceName.toLowerCase().includes(place.name.toLowerCase()) ||
                place.name.toLowerCase().includes(selectedPlaceName.toLowerCase())
              )
            );

            return (
              <AdvancedMarker
                key={place.place_id || place.name || idx}
                position={{ lat: place.latitude, lng: place.longitude }}
                title={`${place.name} • ${place.rating || ''}★ (${place.user_ratings_total || 0} reviews)`}
                onClick={() => {
                  setSelectedPlace(place);
                  onSelectPlace?.(place.name);
                }}
                zIndex={isSelected ? 9999 : 600}
              >
                <div 
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-xs shadow-md transition-all transform cursor-pointer border select-none",
                    isSelected
                      ? "bg-amber-500 text-white scale-110 ring-4 ring-amber-300 dark:ring-amber-500/60 shadow-amber-500/50 border-amber-400"
                      : "bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700/80 hover:scale-105 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                  )}
                >
                  <Coffee className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-white" : "text-amber-600 dark:text-amber-400")} />
                  <span className="truncate max-w-[130px]">{place.name}</span>
                  {place.rating && (
                    <span className={cn(
                      "flex items-center text-[10px] font-extrabold px-1 py-0.2 rounded ml-0.5",
                      isSelected ? "bg-amber-600/80 text-white" : "bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200"
                    )}>
                      ★{place.rating}
                    </span>
                  )}
                </div>
              </AdvancedMarker>
            );
          })}

          {/* InfoWindow for Selected Local Recommendation */}
          {selectedPlace && selectedPlace.latitude && selectedPlace.longitude && (
            <InfoWindow
              position={{
                lat: selectedPlace.latitude,
                lng: selectedPlace.longitude
              }}
              onCloseClick={() => {
                setSelectedPlace(null);
                onSelectPlace?.(null);
              }}
              pixelOffset={[0, -24]}
            >
              <div className="p-2 max-w-[250px] font-sans text-slate-900 dark:text-white">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Coffee className="w-3 h-3" />
                    Local Recommendation
                  </span>
                  {selectedPlace.price_level && (
                    <span className="text-[11px] font-bold text-slate-500">
                      {'$'.repeat(selectedPlace.price_level)}
                    </span>
                  )}
                </div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight mb-1">
                  {selectedPlace.name}
                </h4>
                {selectedPlace.address && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 truncate">
                    {selectedPlace.address}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs mb-2.5">
                  {selectedPlace.rating && (
                    <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                      ★ {selectedPlace.rating}
                      {selectedPlace.user_ratings_total && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({selectedPlace.user_ratings_total.toLocaleString()})
                        </span>
                      )}
                    </span>
                  )}
                  {selectedPlace.walking_minutes && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      🚶 {selectedPlace.walking_minutes}m walk
                    </span>
                  )}
                </div>
                <a
                  href={selectedPlace.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlace.name + ' ' + (selectedPlace.address || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </InfoWindow>
          )}

          {/* Sleek Micro-Card Tooltip on Marker Hover (Suppressed when full detail drawer is open) */}
          {hoveredProperty && !selectedPropertyId && (
            <InfoWindow
              position={{
                lat: hoveredProperty.latitude,
                lng: hoveredProperty.longitude
              }}
              onCloseClick={() => setHoveredProperty(null)}
              pixelOffset={[0, -22]}
              disableAutoPan={true}
              headerDisabled={true}
            >
              {(() => {
                const p = hoveredProperty;
                const match = computeKaiMatch(p, user);
                return (
                  <div className="p-1 max-w-[230px] font-sans text-slate-900 dark:text-white select-none pointer-events-none">
                    <div className="relative rounded-xl overflow-hidden mb-2 shadow-xs">
                      <img
                        src={p.photo_url || "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80"}
                        alt={p.title}
                        className="w-full h-24 object-cover"
                        loading="lazy"
                      />
                      <div className="absolute top-1.5 right-1.5 bg-slate-950/85 text-white px-2 py-0.5 rounded-full font-black text-[11px] shadow-sm backdrop-blur-xs">
                        ${p.weekly_rent}<span className="text-[9px] font-normal text-slate-300">/wk</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn(
                        "text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-1",
                        match.score >= 90
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : match.score >= 75
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      )}>
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{match.score}% Kai Match</span>
                      </span>
                    </div>

                    <div className="font-bold text-xs leading-snug line-clamp-1 text-slate-900 dark:text-white mb-0.5">
                      {p.title}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                      {p.suburb} • {p.bedrooms} Bed • {p.bathrooms} Bath
                    </div>

                    <div className="mt-1.5 pt-1 border-t border-slate-200 dark:border-slate-800 text-[10px] text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-between">
                      <span>
                        {p.commute_duration_minutes ? `${p.commute_duration_minutes}m to hub` : `${p.distance_to_beach_km.toFixed(1)}km to beach`}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">Click to view →</span>
                    </div>
                  </div>
                );
              })()}
            </InfoWindow>
          )}
        </GMap>
      </APIProvider>

      {/* Floating Marker Display Mode Switcher (Top Left) */}
      <div className="absolute top-4 left-4 z-20 flex items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-1 shadow-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMarkerMode('price')}
          className={cn(
            "px-2.5 sm:px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer text-xs",
            markerMode === 'price'
              ? "bg-blue-600 text-white font-bold shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          )}
          title="Display weekly rent ($/wk) on pins"
        >
          <span>$ Price</span>
        </button>
        <button
          type="button"
          onClick={() => setMarkerMode('score')}
          className={cn(
            "px-2.5 sm:px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer text-xs",
            markerMode === 'score'
              ? "bg-blue-600 text-white font-bold shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          )}
          title="Display Kai Commute & Lifestyle Match score (%)"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>% Match</span>
        </button>
        <button
          type="button"
          onClick={() => setMarkerMode('dots')}
          className={cn(
            "px-2.5 sm:px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer text-xs",
            markerMode === 'dots'
              ? "bg-blue-600 text-white font-bold shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          )}
          title="Display minimal dots to reduce visual clutter"
        >
          <span className="text-base leading-none">•</span>
          <span>Dots</span>
        </button>
      </div>

      {/* Recommended Local Venues Active Indicator (Top Left) */}
      {recommendedPlaces.length > 0 && (
        <div className="absolute top-4 left-[242px] z-20 hidden md:flex items-center gap-1.5 bg-amber-500 text-white font-bold text-xs px-3 py-1.5 rounded-2xl shadow-xl shadow-amber-500/20 animate-in fade-in">
          <Coffee className="w-3.5 h-3.5" />
          <span>{recommendedPlaces.length} Local Spots Highlighted</span>
          {onClearRecommendedPlaces && (
            <button
              type="button"
              onClick={onClearRecommendedPlaces}
              className="ml-1 p-0.5 hover:bg-amber-600 rounded-full transition-colors cursor-pointer"
              title="Dismiss local recommendations"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Floating Action Buttons (Top Right) */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        {/* Toggle Transit */}
        <button
          onClick={() => setShowTransit(!showTransit)}
          className={cn(
            "p-2.5 rounded-xl border shadow-md transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer",
            showTransit
              ? "bg-blue-600 text-white border-blue-500 shadow-blue-500/30"
              : "bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
          )}
          title={showTransit ? "Hide Sydney Transit Network" : "Show Sydney Train & Ferry Lines"}
        >
          <Train className="w-4 h-4" />
          <span className="hidden sm:inline">Transit</span>
        </button>

        {/* Spatial Radius Filter */}
        <button
          onClick={() => setIsPlacingCircle(!isPlacingCircle)}
          className={cn(
            "p-2.5 rounded-xl border shadow-md transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer",
            isPlacingCircle
              ? "bg-rose-600 text-white border-rose-500 shadow-rose-500/30 animate-pulse"
              : "bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
          )}
          title={isPlacingCircle ? "Click anywhere on map to drop search radius" : "Filter properties by radius"}
        >
          <span>⭕</span>
          <span className="hidden sm:inline">{isPlacingCircle ? "Click Map..." : "Radius Filter"}</span>
        </button>

        {/* Clear Drawing if spatial filter active */}
        {hasSpatialFilter && (
          <button
            onClick={handleClearDrawing}
            className="p-2.5 rounded-xl bg-rose-600 text-white border border-rose-500 shadow-md hover:bg-rose-700 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Clear spatial filter shape"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear Shape</span>
          </button>
        )}

        {/* Maximize / Restore */}
        {onToggleMaximize && (
          <button
            onClick={onToggleMaximize}
            className="p-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-md hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            title={isMaximized ? "Restore view" : "Enlarge map"}
          >
            {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
