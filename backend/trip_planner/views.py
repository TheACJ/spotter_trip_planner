from rest_framework.decorators import api_view
from rest_framework.response import Response
from .hos_engine import HOSPlanner, DutySegment, LogDay, RouteStop
import traceback


def serialize_segment(seg):
    return {
        "status": seg.status,
        "start_hour": round(seg.start_hour, 4),
        "duration": round(seg.duration, 4),
        "end_hour": round(seg.end_hour, 4),
        "location": seg.location,
        "note": seg.note,
        "day": seg.day,
        "start_time_of_day": round(seg.start_time_of_day, 4),
        "end_time_of_day": round(seg.end_time_of_day, 4),
    }


def serialize_log_day(log):
    return {
        "day_number": log.day_number,
        "date_offset_days": log.date_offset_days,
        "segments": [serialize_segment(s) for s in log.segments],
        "start_location": log.start_location,
        "end_location": log.end_location,
        "total_miles": round(log.total_miles, 1),
        "total_driving_hrs": round(log.total_driving_hrs, 2),
        "total_on_duty_hrs": round(log.total_on_duty_hrs, 2),
        "total_off_duty_hrs": round(log.total_off_duty_hrs, 2),
        "total_sleeper_hrs": round(log.total_sleeper_hrs, 2),
        "carrier": log.carrier,
        "driver_name": log.driver_name,
        "truck_number": log.truck_number,
        "trailer_number": log.trailer_number,
    }


def serialize_stop(stop):
    return {
        "name": stop.name,
        "location": stop.location,
        "miles_from_start": round(stop.miles_from_start, 1),
        "arrival_hour": round(stop.arrival_hour, 3),
        "departure_hour": round(stop.departure_hour, 3),
        "stop_type": stop.stop_type,
        "duration_hrs": round(stop.duration_hrs, 2),
        "lat": stop.lat,
        "lon": stop.lon,
    }


@api_view(['POST'])
def plan_trip(request):
    """
    POST /api/plan-trip/
    Geocoding and routing are done client-side (browser).
    This endpoint receives pre-computed distances and coords,
    runs the HOS engine, and returns log days + route stops.
    """
    try:
        data = request.data
        current_location = data.get('current_location', '').strip()
        pickup_location = data.get('pickup_location', '').strip()
        dropoff_location = data.get('dropoff_location', '').strip()
        current_cycle_used = float(data.get('current_cycle_used', 0))
        dist_to_pickup = float(data.get('distance_to_pickup_miles', 0))
        dist_pickup_to_dropoff = float(data.get('distance_pickup_to_dropoff_miles', 0))
        origin_coords = data.get('origin_coords', {})
        pickup_coords = data.get('pickup_coords', {})
        dropoff_coords = data.get('dropoff_coords', {})
        geometry = data.get('geometry', [])

        if not all([current_location, pickup_location, dropoff_location]):
            return Response({"error": "All location fields are required."}, status=400)
        if not (0 <= current_cycle_used <= 70):
            return Response({"error": "Current cycle hours must be between 0 and 70."}, status=400)
        if dist_to_pickup <= 0 or dist_pickup_to_dropoff <= 0:
            return Response({"error": "Invalid route distances. Please try again."}, status=400)

        planner = HOSPlanner(current_cycle_used_hrs=current_cycle_used)
        plan = planner.plan(
            current_location=current_location,
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            distance_to_pickup=dist_to_pickup,
            distance_pickup_to_dropoff=dist_pickup_to_dropoff,
        )

        for stop in plan.route_stops:
            if stop.stop_type == 'pickup' and pickup_coords:
                stop.lat = pickup_coords.get('lat', 0)
                stop.lon = pickup_coords.get('lon', 0)
            elif stop.stop_type == 'dropoff' and dropoff_coords:
                stop.lat = dropoff_coords.get('lat', 0)
                stop.lon = dropoff_coords.get('lon', 0)

        return Response({
            "route": {
                "origin": {"name": current_location, "lat": origin_coords.get('lat', 0), "lon": origin_coords.get('lon', 0)},
                "pickup": {"name": pickup_location, "lat": pickup_coords.get('lat', 0), "lon": pickup_coords.get('lon', 0)},
                "dropoff": {"name": dropoff_location, "lat": dropoff_coords.get('lat', 0), "lon": dropoff_coords.get('lon', 0)},
                "distance_to_pickup_miles": round(dist_to_pickup, 1),
                "distance_pickup_to_dropoff_miles": round(dist_pickup_to_dropoff, 1),
                "total_distance_miles": round(dist_to_pickup + dist_pickup_to_dropoff, 1),
                "geometry": geometry,
            },
            "trip_summary": {
                "total_distance_miles": round(plan.total_distance_miles, 1),
                "total_trip_hrs": round(plan.total_trip_hrs, 2),
                "total_driving_hrs": round(plan.total_driving_hrs, 2),
                "num_log_days": len(plan.log_days),
                "warnings": plan.warnings,
            },
            "route_stops": [serialize_stop(s) for s in plan.route_stops],
            "log_days": [serialize_log_day(d) for d in plan.log_days],
            "all_segments": [serialize_segment(s) for s in plan.segments],
        })

    except ValueError as e:
        return Response({"error": str(e)}, status=400)
    except Exception as e:
        traceback.print_exc()
        return Response({"error": f"Trip planning failed: {str(e)}"}, status=500)


@api_view(['GET'])
def health_check(request):
    return Response({"status": "ok", "service": "Spotter AI Trip Planner"})
