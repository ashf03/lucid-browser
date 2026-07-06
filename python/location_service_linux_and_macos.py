import platform
import asyncio
import json
import os
import sys
import urllib.request
import urllib.parse

sysName: str = platform.system().lower()

if (sysName == "windows"):
  from winsdk.windows.devices import geolocation

elif (sysName == "darwin" or
      sysName == "linux"):
  import requests

else: # Unsupported OS
  print(f"Unsupported OS `{sysName}`, make sure you either have `Linux`, `macOS` or `Windows`")

  sys.exit(1)

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
            'latitude': lat, 'longitude': lon,
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

def get_ip() -> str:
  global requests

  return requests.get("https://api64.ipify.org?format=json").json()["ip"]

def get_ip_latlon(ip: str): # For macOS and Linux
  global requests

  ip_api_url = f"http://ip-api.com/json/{ip}"
  ip_data = requests.get(ip_api_url).json()

  if "lat" in ip_data and "lon" in ip_data:
      return ip_data["lat"], ip_data["lon"]

  return None, None

  url: str = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{ip}.json?access_token={MAPBOX_TOKEN}&types=place"
  data = requests.get(url).json()

  print(json.dumps(data, indent=2))

  if "features" in data and data["features"]:
    lon, lat = data["features"][0]["center"]

    return lat, lon

  return None, None

async def get_location(): # For Windows
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
  if (sysName == "windows"):
    result = asyncio.run(get_location())
    print(json.dumps(result))
    sys.stdout.flush()

  elif (sysName == "linux" or sysName == "darwin"):
    ipAddr = get_ip()
    lat, lon = get_ip_latlon(ipAddr)
    result = asyncio.run(get_address_from_coordinates(lat, lon))

    print(json.dumps(result))

    sys.stdout.flush()
