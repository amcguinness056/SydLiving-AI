import React from 'react';
import { GoogleMapView, type GoogleMapViewProps } from './GoogleMapView';

export interface MapProps extends GoogleMapViewProps {}

export const Map = React.memo(function Map(props: MapProps) {
  return <GoogleMapView {...props} />;
});
