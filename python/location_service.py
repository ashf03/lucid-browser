"""
Windows location service for Lucid Browser.

Spawned by the main process (`get-location` IPC). Reads GPS via winsdk,
reverse-geocodes with Mapbox, and prints a single JSON object to stdout.

Environment: VITE_MAPBOX_ACCESS_TOKEN or MAPBOX_ACCESS_TOKEN
Status codes: success | partial | denied | unavailable | error
"""
import asyncio
import json
import os
import sys
import urllib.request
import urllib.parse
from winsdk.windows.devices import geolocation

MAPBOX_TOKEN = os.environ.get('VITE_MAPBOX_ACCESS_TOKEN') or os.environ.get('MAPBOX_ACCESS_TOKEN', '')

async def get_address_from_coordinates(lat, lon):
    try:
        # Mapbox Geocoding v6 API endpoint for reverse geocoding
        url = f"https://api.mapbox.com/search/geocode/v6/reverse?longitude={lon}&latitude={lat}&access_token={MAPBOX_TOKEN}"
        
        headers = {
            'User-Agent': 'ElectronLocationApp/1.0'
        }
        
        req = urllib.request.Request(url, headers=headers)
        response = urllib.request.urlopen(req)
        data = json.loads(response.read().decode())
        
        if not data.get('features'):
            return None
            
        # Get the first feature which contains the most relevant result
        feature = data['features'][0]
        properties = feature.get('properties', {})
        context = properties.get('context', {})
        
        return {
            'street': context.get('street', {}).get('name', 'Not available'),
            'locality': context.get('locality', {}).get('name', 'Not available'),
            'place': context.get('place', {}).get('name', 'Not available'),
            'district': context.get('district', {}).get('name', 'Not available'),
            'region': context.get('region', {}).get('name', 'Not available'),
            'postcode': context.get('postcode', {}).get('name', 'Not available'),
            'country': context.get('country', {}).get('name', 'Not available'),
            'full_address': properties.get('full_address', 'Not available')
        }
        
    except Exception as e:
        print(f"Geocoding error: {str(e)}", file=sys.stderr)
        return None

async def get_location():
    try:
        # Initialize location service
        geolocator = geolocation.Geolocator()
        status = await geolocation.Geolocator.request_access_async()
        
        if status == geolocation.GeolocationAccessStatus.ALLOWED:
            # Get position
            position = await geolocator.get_geoposition_async()
            
            # Extract coordinates
            lat = float(position.coordinate.latitude)
            lon = float(position.coordinate.longitude)
            
            # Get address information from Mapbox
            address_info = await get_address_from_coordinates(lat, lon)
            
            if address_info:
                result = {
                    "latitude": lat,
                    "longitude": lon,
                    "street": address_info['street'],
                    "locality": address_info['locality'],
                    "place": address_info['place'],
                    "district": address_info['district'],
                    "region": address_info['region'],
                    "postcode": address_info['postcode'],
                    "country": address_info['country'],
                    "full_address": address_info['full_address'],
                    "status": "success"
                }
            else:
                result = {
                    "latitude": lat,
                    "longitude": lon,
                    "street": "Not available",
                    "locality": "Not available",
                    "place": "Not available",
                    "district": "Not available",
                    "region": "Not available",
                    "postcode": "Not available",
                    "country": "Not available",
                    "full_address": "Not available",
                    "status": "partial"
                }
            
        elif status == geolocation.GeolocationAccessStatus.DENIED:
            result = {
                "error": "Location access denied. Please enable location services in Windows settings.",
                "status": "denied"
            }
        else:
            result = {
                "error": "Location services are not available on this device.",
                "status": "unavailable"
            }
            
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        result = {
            "error": str(e),
            "status": "error"
        }
    
    return result

if __name__ == "__main__":
    result = asyncio.run(get_location())
    print(json.dumps(result))
    sys.stdout.flush()