"""
Geocoding and routing using free APIs:
- Nominatim (OpenStreetMap) for geocoding (called browser-side)
- OSRM for road distance/routing (called browser-side)

NOTE: In the refactored architecture, geocoding and routing are done
client-side in the React frontend (browser fetch, no CORS issues).
This module is kept for reference / server-side fallback use.
"""
import requests
import time
from typing import Optional, Tuple, Dict, Any

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
HEADERS = {"User-Agent": "SpotterAI-TripPlanner/1.0 (assessment@spotter.ai)"}


def geocode(location: str) -> Optional[Tuple[float, float]]:
    """Return (lat, lon) for a location string, or None if not found."""
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": location, "format": "json", "limit": 1, "countrycodes": "us"},
            headers=HEADERS, timeout=10,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as e:
        print(f"Geocoding error for '{location}': {e}")
    return None


def get_route(origin_coords, waypoints, destination_coords):
    """Get route info using OSRM."""
    coords_list = [origin_coords] + waypoints + [destination_coords]
    coord_str = ";".join(f"{lon},{lat}" for lat, lon in coords_list)
    try:
        resp = requests.get(
            f"{OSRM_URL}/{coord_str}",
            params={"overview": "full", "geometries": "geojson", "steps": "false"},
            headers=HEADERS, timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            return None
        route = data["routes"][0]
        latlons = [[c[1], c[0]] for c in route["geometry"]["coordinates"]]
        legs = [{"distance_miles": l["distance"] / 1609.34} for l in route.get("legs", [])]
        return {
            "distance_miles": route["distance"] / 1609.34,
            "geometry": latlons,
            "legs": legs,
        }
    except Exception as e:
        print(f"Routing error: {e}")
        return None


def get_trip_distances(current_location, pickup_location, dropoff_location):
    """Geocode and route all three points. Used as server-side fallback."""
    origin_coords = geocode(current_location)
    time.sleep(0.5)
    pickup_coords = geocode(pickup_location)
    time.sleep(0.5)
    dropoff_coords = geocode(dropoff_location)

    if not origin_coords:
        raise ValueError(f"Could not geocode current location: '{current_location}'")
    if not pickup_coords:
        raise ValueError(f"Could not geocode pickup location: '{pickup_location}'")
    if not dropoff_coords:
        raise ValueError(f"Could not geocode dropoff location: '{dropoff_location}'")

    route_full = get_route(origin_coords, [pickup_coords], dropoff_coords)
    route_leg1 = get_route(origin_coords, [], pickup_coords)
    time.sleep(0.2)
    route_leg2 = get_route(pickup_coords, [], dropoff_coords)

    if not route_full:
        raise ValueError("Could not calculate route.")

    if route_leg1 and route_leg2:
        dist_to_pickup = route_leg1["distance_miles"]
        dist_pickup_to_dropoff = route_leg2["distance_miles"]
    else:
        total = route_full["distance_miles"]
        dist_to_pickup = total * 0.4
        dist_pickup_to_dropoff = total * 0.6

    return {
        "origin": {"name": current_location, "lat": origin_coords[0], "lon": origin_coords[1]},
        "pickup": {"name": pickup_location, "lat": pickup_coords[0], "lon": pickup_coords[1]},
        "dropoff": {"name": dropoff_location, "lat": dropoff_coords[0], "lon": dropoff_coords[1]},
        "distance_to_pickup_miles": dist_to_pickup,
        "distance_pickup_to_dropoff_miles": dist_pickup_to_dropoff,
        "total_distance_miles": dist_to_pickup + dist_pickup_to_dropoff,
        "geometry_full": route_full["geometry"],
    }
