'use client';

import React, { useMemo, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle, Autocomplete } from '@react-google-maps/api';

const libraries: any = ["places"];

const containerStyle = {
  width: '100%',
  height: '100%',
  position: 'relative' as const
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }]
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }]
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }]
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }]
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }]
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }]
  }
];

export interface Lead {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  status: "DISCOVERED" | "ENRICHING" | "READY";
  score?: number;
  verified?: boolean;
  phone?: boolean | string;
  website?: boolean | string;
  rating?: number | null;
  missingAttributes?: string[];
  reasons?: string[];
}

interface MapComponentProps {
  center: { lat: number; lng: number };
  radius: number; // in meters
  leads: Lead[];
  onMapClick?: (lat: number, lng: number) => void;
}

export default function MapComponent({ center, radius, leads, onMapClick }: MapComponentProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const [autocomplete, setAutocomplete] = useState<any>(null);

  const options = useMemo(() => ({
    styles: darkMapStyle,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  }), []);

  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'ready': return '#10B981'; // Green
      case 'enriching': return '#F59E0B'; // Yellow
      case 'discovered': return '#4F6EF7'; // Blue
      default: return '#A0A0AB';
    }
  };

  const getMarkerIcon = (color: string) => {
    return {
      path: typeof google !== 'undefined' ? google.maps.SymbolPath.CIRCLE : 0,
      fillColor: color,
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#0A0A0F',
      scale: 8,
    };
  };

  const onLoadAutocomplete = (autocompleteInstance: any) => {
    setAutocomplete(autocompleteInstance);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry && onMapClick) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        onMapClick(lat, lng);
      }
    }
  };

  if (!isLoaded) return <div className="w-full h-full flex items-center justify-center text-gray-500">Loading Map...</div>;

  return (
    <div style={containerStyle}>
      <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: '80%', maxWidth: '400px' }}>
        <Autocomplete onLoad={onLoadAutocomplete} onPlaceChanged={onPlaceChanged} options={{ types: ['(regions)'] }}>
          <input
            type="text"
            placeholder="Search location (e.g. Nagpur, Maharashtra)"
            className="w-full px-4 py-3 rounded-lg shadow-lg text-sm"
            style={{ 
              backgroundColor: '#1E1E28', 
              color: '#E8E8EB', 
              border: '1px solid #2D2D3A',
              outline: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
            }}
          />
        </Autocomplete>
      </div>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={12}
        options={options}
        onClick={(e) => {
          if (e.latLng && onMapClick) {
            onMapClick(e.latLng.lat(), e.latLng.lng());
          }
        }}
      >
        {/* Search Center Marker */}
      <Marker 
        position={center} 
        icon={{
          path: typeof google !== 'undefined' ? google.maps.SymbolPath.CIRCLE : 0,
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#000000',
          scale: 6,
        }}
        title="Search Center"
      />

      {/* Search Radius */}
      <Circle
        center={center}
        radius={radius}

        options={{
          fillColor: '#4F6EF7',
          fillOpacity: 0.1,
          strokeColor: '#4F6EF7',
          strokeOpacity: 0.5,
          strokeWeight: 1,
          clickable: false,
          editable: false,
        }}
      />

      {/* Lead Markers */}
      {leads.map((lead) => (
        <Marker
          key={lead.id}
          position={{ lat: lead.lat, lng: lead.lng }}
          title={lead.name}
          icon={getMarkerIcon(getMarkerColor(lead.status))}
        />
      ))}
    </GoogleMap>
    </div>
  );
}
