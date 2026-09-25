import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  APIProvider,
  Map as GMap,
  AdvancedMarker,
  InfoWindow,
  useMap
} from '@vis.gl/react-google-maps';
import { type Property } from '../api/client';
import { Maximize, Minimize, Train, Trash2, Key, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

interface GoogleMapViewProps {
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

// Controls camera transitions for selected properties and bound adjustments
function CameraController({
  properties,
  selectedId
}: {
  properties: Property[];
  selectedId?: string | null;
}) {
  const map = useMap();
  const prevSelectedIdRef = useRef<string | null | undefined>(undefined);
  const prevPropertyIdsKeyRef = useRef<string>('');

  useEffect(() => {
    if (!map) return;

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
  }, [map, properties, selectedId]);

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
  onMapClick
}: GoogleMapViewProps) {
  const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [showTransit, setShowTransit] = useState(false);
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null);
  const [hasSpatialFilter, setHasSpatialFilter] = useState(false);
  const [isPlacingCircle, setIsPlacingCircle] = useState(false);
  const activeCircleRef = useRef<google.maps.Circle | null>(null);

  const selectedProperty = useMemo(
    () => properties.find(p => p.id === selectedPropertyId) || null,
    [properties, selectedPropertyId]
  );

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
        {/* Subtle Sydney grid background */}
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
            if (e.detail.latLng && onMapClick) {
              onMapClick(e.detail.latLng.lat, e.detail.latLng.lng);
            }
          }}
        >
          {/* Camera updates */}
          <CameraController
            properties={properties}
            selectedId={selectedPropertyId}
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

          {/* Property Markers */}
          {properties.map(property => {
            const isActive = selectedPropertyId === property.id;
            return (
              <AdvancedMarker
                key={property.id}
                position={{ lat: property.latitude, lng: property.longitude }}
                title={property.title}
                onClick={() => {
                  onSelectProperty?.(property.id);
                  setHoveredProperty(property);
                }}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-center px-3 py-1.5 rounded-full font-bold text-xs shadow-md transition-all duration-200 cursor-pointer select-none",
                    isActive
                      ? "bg-rose-500 text-white scale-110 z-50 ring-4 ring-rose-300 dark:ring-rose-900 shadow-rose-500/40 animate-marker-pulse"
                      : isDarkMode
                        ? "bg-slate-900 text-white hover:bg-blue-600 hover:text-white hover:scale-105 border border-slate-700/90"
                        : "bg-slate-900 text-white hover:bg-blue-600 hover:text-white hover:scale-105 border border-slate-800"
                  )}
                >
                  <span>${property.weekly_rent}</span>
                  <div
                    className={cn(
                      "absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45",
                      isActive ? "bg-rose-500" : "bg-slate-900"
                    )}
                  />
                </div>
              </AdvancedMarker>
            );
          })}

          {/* InfoWindow for selected or hovered property */}
          {(selectedProperty || hoveredProperty) && (
            <InfoWindow
              position={{
                lat: (selectedProperty || hoveredProperty)!.latitude,
                lng: (selectedProperty || hoveredProperty)!.longitude
              }}
              onCloseClick={() => setHoveredProperty(null)}
              pixelOffset={[0, -32]}
            >
              {(() => {
                const p = (selectedProperty || hoveredProperty)!;
                return (
                  <div className="p-1 max-w-[240px] font-sans text-slate-900 dark:text-white">
                    <img
                      src={p.photo_url || "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&auto=format&fit=crop&q=80"}
                      alt={p.title}
                      className="w-full h-24 object-cover rounded-xl mb-2.5 shadow-sm"
                      loading="lazy"
                    />
                    <div className="font-extrabold text-xs leading-snug line-clamp-1 text-slate-900 dark:text-white">{p.title}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 font-medium">
                      {p.suburb} • {p.distance_to_beach_km.toFixed(1)} km to beach
                    </div>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-blue-600 dark:text-blue-400 font-extrabold text-xs">
                        ${p.weekly_rent}/wk
                      </span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                        {p.bedrooms} Bed • {p.bathrooms} Bath
                      </span>
                    </div>
                  </div>
                );
              })()}
            </InfoWindow>
          )}
        </GMap>
      </APIProvider>

      {/* Floating Action Buttons */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        {/* Toggle Transit */}
        <button
          onClick={() => setShowTransit(!showTransit)}
          className={cn(
            "p-2.5 rounded-xl border shadow-md transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-bold",
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
            "p-2.5 rounded-xl border shadow-md transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-bold",
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
            className="p-2.5 rounded-xl bg-rose-600 text-white border border-rose-500 shadow-md hover:bg-rose-700 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-bold"
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
            className="p-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-md hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 hover:scale-105 active:scale-95"
            title={isMaximized ? "Restore view" : "Enlarge map"}
          >
            {isMaximized ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
