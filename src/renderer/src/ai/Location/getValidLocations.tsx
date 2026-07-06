import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ChatMessageProps, MapLocation, MapResult } from '../../types/MessageTypes';

const getValidLocations = (mapResults: MapResult[] | undefined): MapLocation[] => {
  console.log('Raw mapResults:', mapResults);

  if (!mapResults) return [];
  
  const filteredLocations = mapResults
    .filter((loc: MapResult) => {
      const hasValidCoords = Boolean(
        (loc.latitude && loc.longitude) || 
        (loc.gps_coordinates?.latitude && loc.gps_coordinates?.longitude)
      );
      console.log('Location:', loc.title, 'Has valid coords:', hasValidCoords);
      return hasValidCoords;
    })
    .map((loc): MapLocation => {
      const location = {
        title: loc.title,
        latitude: loc.latitude || loc.gps_coordinates!.latitude,
        longitude: loc.longitude || loc.gps_coordinates!.longitude,
        rating: loc.rating,
        reviews: loc.reviews,
        address: loc.address,
        website: loc.website,
        mapsUrl: loc.mapsUrl,
        hours: loc.hours
      };
      console.log('Mapped location:', location);
      return location;
    });

  console.log('Filtered and mapped locations:', filteredLocations);
  return filteredLocations;
};

export default getValidLocations;