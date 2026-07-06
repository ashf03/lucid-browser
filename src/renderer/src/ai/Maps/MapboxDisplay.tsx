/** Interactive Mapbox GL map for local search / places results in the AI chat. */
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Star, Clock, ExternalLink } from 'lucide-react';

// Token from VITE_MAPBOX_ACCESS_TOKEN in .env
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

interface MapLocation {
  title: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviews?: number;
  address?: string;
  website?: string;
  mapsUrl?: string;
  hours?: string;
}

interface MapboxDisplayProps {
  locations: MapLocation[];
  darkMode?: boolean;
}

// LocationPopup Component
const LocationPopup = ({ location, darkMode = false }: { location: MapLocation; darkMode?: boolean }) => {
  const handleClick = () => {
    if (location.website) {
      window.open(location.website, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden w-64 transition-all duration-200 ${location.website ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className="p-4">
        <div className="flex justify-between items-start">
          <h3 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-800'} mb-2 flex-1`}>
            {location.title}
          </h3>
          {location.website && (
            <ExternalLink className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'} flex-shrink-0`} />
          )}
        </div>
        
        {location.rating && (
          <div className="flex items-center mb-2">
            <Star className="w-4 h-4 text-yellow-500 mr-1" fill="#F59E0B" />
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {location.rating}/5
            </span>
            {location.reviews && (
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} ml-1`}>
                ({location.reviews} reviews)
              </span>
            )}
          </div>
        )}
        
        {location.address && (
          <div className="flex items-start mb-2">
            <MapPin className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mr-2 mt-0.5 flex-shrink-0`} />
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{location.address}</span>
          </div>
        )}
        
        {location.hours && (
          <div className="flex items-start mb-2">
            <Clock className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mr-2 mt-0.5 flex-shrink-0`} />
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{location.hours}</span>
          </div>
        )}
        
        <div className={`mt-3 pt-3 ${darkMode ? 'border-gray-700' : 'border-gray-100'} border-t flex gap-2`}>
          {location.website && (
            <span 
              className={`text-sm font-medium ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
            >
              Visit website
            </span>
          )}
          {location.mapsUrl && (
            <a 
              href={location.mapsUrl} 
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`text-sm font-medium ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
            >
              Directions
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const MapboxDisplay: React.FC<MapboxDisplayProps> = ({ locations, darkMode = false }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const popupNodes = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!mapContainer.current || !locations.length) return;

    // Initialize map
    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [locations[0].longitude, locations[0].latitude],
      zoom: 13
    });

    map.current = newMap;

    // Add navigation controls
    newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Fit bounds to all markers if there are multiple locations
    if (locations.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      locations.forEach((location: MapLocation) => {
        bounds.extend([location.longitude, location.latitude]);
      });
      newMap.fitBounds(bounds, { padding: 50 });
    }

    // Clear any existing popup nodes
    popupNodes.current.forEach(node => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
    popupNodes.current = [];

    // Add markers for each location
    locations.forEach((location: MapLocation) => {
      // Create container for React popup
      const popupNode = document.createElement('div');
      popupNodes.current.push(popupNode);
      
      // Render React component to DOM element
      ReactDOM.render(<LocationPopup location={location} darkMode={darkMode} />, popupNode);

      // Create popup
      const popup = new mapboxgl.Popup({ 
        offset: 25,
        maxWidth: '320px',
        className: 'mapbox-custom-popup'
      }).setDOMContent(popupNode);

      // Create marker
      const marker = new mapboxgl.Marker()
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(newMap);

      markers.current.push(marker);
    });

    // Add CSS for popup (optional)
    const style = document.createElement('style');
    style.innerHTML = `
      .mapbox-custom-popup .mapboxgl-popup-content {
        padding: 0;
        overflow: hidden;
        border-radius: 0.5rem;
      }
      
      .mapbox-custom-popup .mapboxgl-popup-tip {
        border-top-color: ${darkMode ? '#1f2937' : '#ffffff'};
        border-bottom-color: ${darkMode ? '#1f2937' : '#ffffff'};
      }
      
      .mapbox-custom-popup .mapboxgl-popup-close-button {
        color: ${darkMode ? '#9ca3af' : '#6b7280'};
      }
      
      .mapbox-custom-popup .mapboxgl-popup-close-button:hover {
        background-color: transparent;
        color: ${darkMode ? '#f9fafb' : '#111827'};
      }
    `;
    document.head.appendChild(style);

    // Cleanup
    return () => {
      markers.current.forEach(marker => marker.remove());
      popupNodes.current.forEach(node => {
        ReactDOM.unmountComponentAtNode(node);
      });
      document.head.removeChild(style);
      if (map.current) {
        map.current.remove();
      }
    };
  }, [locations]);

  return (
    <div className={`w-full rounded-lg overflow-hidden shadow-lg ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <div ref={mapContainer} className="w-full h-96" />
    </div>
  );
};

export default MapboxDisplay;