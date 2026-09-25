import React from 'react';
import { GoogleMapView } from './GoogleMapView';
import { type Property } from '../api/client';

export interface MapProps {
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

export const Map = React.memo(function Map(props: MapProps) {
  return <GoogleMapView {...props} />;
});
