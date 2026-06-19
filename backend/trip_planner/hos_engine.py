"""
FMCSA HOS Engine - Property-carrying driver, 70hrs/8days cycle
Rules:
  - 11-hour driving limit after 10 consecutive hours off duty
  - 14-hour on-duty window (clock starts when driver goes on-duty)
  - 30-minute break required after 8 consecutive driving hours
  - 70-hour / 8-day cycle limit
  - Fueling every <= 1,000 miles (30 min stop)
  - 1 hour for pickup and dropoff each
  - Average driving speed: 55 mph
"""
from dataclasses import dataclass, field
from typing import List
import math

AVG_SPEED_MPH = 55.0
FUEL_STOP_INTERVAL_MILES = 950
FUEL_STOP_DURATION_HRS = 0.5
PICKUP_DROPOFF_DURATION_HRS = 1.0
PRE_TRIP_INSPECTION_HRS = 0.5

MAX_DRIVING_HRS = 11.0
MAX_WINDOW_HRS = 14.0
REQUIRED_OFF_DUTY_HRS = 10.0
BREAK_AFTER_DRIVING_HRS = 8.0
BREAK_DURATION_HRS = 0.5
MAX_CYCLE_HRS = 70.0


@dataclass
class DutySegment:
    """A single segment of duty status on the ELD log"""
    status: str
    start_hour: float
    duration: float
    location: str = ""
    note: str = ""

    @property
    def end_hour(self):
        return self.start_hour + self.duration

    @property
    def day(self):
        return int(self.start_hour // 24)

    @property
    def start_time_of_day(self):
        return self.start_hour % 24

    @property
    def end_time_of_day(self):
        return self.end_hour % 24


@dataclass
class LogDay:
    """Represents one 24-hour log sheet"""
    day_number: int
    date_offset_days: int
    segments: List[DutySegment] = field(default_factory=list)
    start_location: str = ""
    end_location: str = ""
    total_miles: float = 0.0
    carrier: str = "Spotter AI Logistics"
    driver_name: str = "Driver"
    truck_number: str = "TRK-001"
    trailer_number: str = "TRL-001"

    @property
    def total_driving_hrs(self):
        return sum(s.duration for s in self.segments if s.status == 'D')

    @property
    def total_on_duty_hrs(self):
        return sum(s.duration for s in self.segments if s.status in ('D', 'ON'))

    @property
    def total_off_duty_hrs(self):
        return sum(s.duration for s in self.segments if s.status == 'OFF')

    @property
    def total_sleeper_hrs(self):
        return sum(s.duration for s in self.segments if s.status == 'SB')


@dataclass
class RouteStop:
    name: str
    location: str
    miles_from_start: float
    arrival_hour: float
    departure_hour: float
    stop_type: str
    duration_hrs: float
    lat: float = 0.0
    lon: float = 0.0


@dataclass
class TripPlan:
    segments: List[DutySegment] = field(default_factory=list)
    log_days: List[LogDay] = field(default_factory=list)
    route_stops: List[RouteStop] = field(default_factory=list)
    total_distance_miles: float = 0.0
    total_trip_hrs: float = 0.0
    total_driving_hrs: float = 0.0
    warnings: List[str] = field(default_factory=list)


class HOSPlanner:
    """
    Plans a trip itinerary respecting all FMCSA HOS rules.
    Time is tracked in decimal hours from trip start (t=0).
    """

    def __init__(self, current_cycle_used_hrs: float = 0.0):
        self.current_cycle_used = current_cycle_used_hrs
        self.clock = 0.0
        self.miles_traveled = 0.0
        self.driving_today = 0.0
        self.window_started = 0.0
        self.window_open = False
        self.consecutive_driving = 0.0
        self.cycle_used = current_cycle_used_hrs
        self.segments: List[DutySegment] = []
        self.route_stops: List[RouteStop] = []
        self.warnings: List[str] = []
        self._trip_cycle_exhausted = False

    def _remaining_driving(self) -> float:
        return MAX_DRIVING_HRS - self.driving_today

    def _remaining_window(self) -> float:
        if not self.window_open:
            return MAX_WINDOW_HRS
        elapsed = self.clock - self.window_started
        return MAX_WINDOW_HRS - elapsed

    def _remaining_cycle(self) -> float:
        return max(0.0, MAX_CYCLE_HRS - self.cycle_used)

    def _can_drive(self) -> bool:
        return (self._remaining_driving() > 0 and
                self._remaining_window() > 0 and
                self._remaining_cycle() > 0)

    def _add_segment(self, status: str, duration: float, location: str = "", note: str = ""):
        if duration <= 0:
            return
        self.segments.append(DutySegment(
            status=status, start_hour=self.clock,
            duration=duration, location=location, note=note,
        ))

    def _add_route_stop(self, name: str, location: str, stop_type: str, duration_hrs: float):
        self.route_stops.append(RouteStop(
            name=name,
            location=location,
            miles_from_start=self.miles_traveled,
            arrival_hour=self.clock,
            departure_hour=self.clock + duration_hrs,
            stop_type=stop_type,
            duration_hrs=duration_hrs,
        ))

    def _open_window(self):
        if not self.window_open:
            self.window_open = True
            self.window_started = self.clock
            self.driving_today = 0.0
            self.consecutive_driving = 0.0

    def _take_10hr_rest(self, location: str = ""):
        """Take mandatory 10-hour off-duty rest, resetting daily limits"""
        self._add_segment('OFF', REQUIRED_OFF_DUTY_HRS, location, "Required 10-hr rest")
        self._add_route_stop("10-Hour Rest", location or "Rest stop", "rest", REQUIRED_OFF_DUTY_HRS)
        self.clock += REQUIRED_OFF_DUTY_HRS
        self.window_open = False
        self.driving_today = 0.0
        self.consecutive_driving = 0.0

    def _take_30min_break(self, location: str = ""):
        """Take mandatory 30-minute break (off-duty, resets consecutive driving)"""
        self._add_segment('OFF', BREAK_DURATION_HRS, location, "Mandatory 30-min break")
        self._add_route_stop("30-Min Break", location or "Break stop", "break", BREAK_DURATION_HRS)
        self.clock += BREAK_DURATION_HRS
        self.consecutive_driving = 0.0

    def _drive(self, miles: float, from_loc: str, to_loc: str) -> float:
        """
        Drive the given miles, respecting HOS limits.
        May insert mandatory breaks and rest periods.
        Returns actual hours driven.
        Sets self._drive_stopped_early = True if cycle was exhausted mid-trip.
        """
        # Early exit if cycle was already exhausted in a prior _drive call
        if self._trip_cycle_exhausted:
            return 0.0

        self._drive_stopped_early = False
        remaining_miles = miles
        total_time = 0.0

        while remaining_miles > 0.001:
            if not self._can_drive():
                # Cycle exhausted? Cannot continue — 34-hr restart required.
                if self._remaining_cycle() <= 0.01:
                    warn = (f"70-hr/8-day cycle limit reached ({self.cycle_used:.1f} hrs used). "
                            f"Driver requires a 34-hr restart. "
                            f"{remaining_miles:.0f} miles remain unscheduled.")
                    if not self.warnings or self.warnings[-1] != warn:
                        self.warnings.append(warn)
                    self._drive_stopped_early = True
                    self._trip_cycle_exhausted = True
                    break
                # Shift limit hit — take 10-hour rest, then resume
                self._take_10hr_rest(from_loc)
                self._open_window()
                self._add_segment('ON', PRE_TRIP_INSPECTION_HRS, from_loc, "Pre-trip inspection")
                self.clock += PRE_TRIP_INSPECTION_HRS
                self.cycle_used += PRE_TRIP_INSPECTION_HRS

            if not self.window_open:
                self._open_window()

            # 30-min break required after 8 consecutive driving hours
            if self.consecutive_driving >= BREAK_AFTER_DRIVING_HRS:
                self._take_30min_break(from_loc)
                if self._remaining_window() <= 0:
                    self._take_10hr_rest(from_loc)
                    self._open_window()
                    self._add_segment('ON', PRE_TRIP_INSPECTION_HRS, from_loc, "Pre-trip inspection")
                    self.clock += PRE_TRIP_INSPECTION_HRS
                    self.cycle_used += PRE_TRIP_INSPECTION_HRS

            drive_hrs_before_break = BREAK_AFTER_DRIVING_HRS - self.consecutive_driving
            avail_drive_hrs = min(
                self._remaining_driving(),
                self._remaining_window(),
                drive_hrs_before_break,
                self._remaining_cycle(),
            )
            avail_drive_hrs = max(0.0, avail_drive_hrs)

            if avail_drive_hrs <= 0:
                # Safety valve
                if self._remaining_cycle() <= 0.01:
                    warn = (f"70-hr cycle limit reached ({self.cycle_used:.1f} hrs). "
                            f"{remaining_miles:.0f} miles remain unscheduled.")
                    if not self.warnings or self.warnings[-1] != warn:
                        self.warnings.append(warn)
                    self._drive_stopped_early = True
                    self._trip_cycle_exhausted = True
                    break
                self._take_10hr_rest(from_loc)
                self._open_window()
                continue

            drive_miles = min(remaining_miles, avail_drive_hrs * AVG_SPEED_MPH)
            drive_hrs = drive_miles / AVG_SPEED_MPH

            if drive_hrs < 0.01:
                break

            self._add_segment('D', drive_hrs, f"{from_loc} -> {to_loc}", f"Driving {drive_miles:.0f} mi")
            self.clock += drive_hrs
            self.miles_traveled += drive_miles
            self.driving_today += drive_hrs
            self.consecutive_driving += drive_hrs
            self.cycle_used += drive_hrs
            total_time += drive_hrs
            remaining_miles -= drive_miles

        return total_time

    def _on_duty_stop(self, duration: float, location: str, note: str):
        """Record an on-duty (not driving) stop"""
        if not self.window_open:
            self._open_window()
        self._add_segment('ON', duration, location, note)
        self.clock += duration
        self.cycle_used += duration
        self.consecutive_driving = 0.0

    def plan(
        self,
        current_location: str,
        pickup_location: str,
        dropoff_location: str,
        distance_to_pickup: float,
        distance_pickup_to_dropoff: float,
    ) -> TripPlan:
        """Full trip planning with FMCSA HOS enforcement."""
        total_distance = distance_to_pickup + distance_pickup_to_dropoff
        miles_since_fuel = 0.0

        def finalize_plan():
            log_days = self._build_log_days(
                current_location, pickup_location, dropoff_location, total_distance
            )
            return TripPlan(
                segments=self.segments,
                log_days=log_days,
                route_stops=self.route_stops,
                total_distance_miles=self.miles_traveled,
                total_trip_hrs=self.clock,
                total_driving_hrs=sum(s.duration for s in self.segments if s.status == 'D'),
                warnings=self.warnings,
            )

        # Pre-trip inspection
        self._open_window()
        self._add_segment('ON', PRE_TRIP_INSPECTION_HRS, current_location, "Pre-trip inspection")
        self.clock += PRE_TRIP_INSPECTION_HRS
        self.cycle_used += PRE_TRIP_INSPECTION_HRS
        self.miles_traveled = 0.0

        # --- Leg 1: Origin -> Pickup ---
        remaining = distance_to_pickup
        driven_so_far = 0.0

        while remaining > 0.001:
            miles_to_fuel = FUEL_STOP_INTERVAL_MILES - miles_since_fuel
            if miles_to_fuel < remaining:
                seg_miles = min(miles_to_fuel, remaining)
                if seg_miles > 0:
                    self._drive(seg_miles, current_location, pickup_location)
                    driven_so_far += seg_miles
                    miles_since_fuel += seg_miles
                    remaining -= seg_miles
                if getattr(self, '_drive_stopped_early', False):
                    break
                if miles_since_fuel >= FUEL_STOP_INTERVAL_MILES - 1:
                    fuel_loc = f"Fuel stop after {driven_so_far:.0f} mi"
                    self._add_route_stop("Fuel Stop", fuel_loc, "fuel", FUEL_STOP_DURATION_HRS)
                    self._on_duty_stop(FUEL_STOP_DURATION_HRS, fuel_loc, "Fueling")
                    miles_since_fuel = 0.0
            else:
                self._drive(remaining, current_location, pickup_location)
                if getattr(self, '_drive_stopped_early', False):
                    break
                miles_since_fuel += remaining
                driven_so_far += remaining
                remaining = 0

        if remaining > 0.001:
            self.warnings.append(
                f"Trip could not reach pickup before the cycle limit. "
                f"{remaining:.0f} miles remain unscheduled."
            )
            return finalize_plan()

        # Pickup stop
        self._add_route_stop("Pickup", pickup_location, "pickup", PICKUP_DROPOFF_DURATION_HRS)
        self._on_duty_stop(PICKUP_DROPOFF_DURATION_HRS, pickup_location, "Loading / pickup")

        # --- Leg 2: Pickup -> Dropoff ---
        remaining = distance_pickup_to_dropoff
        miles_since_fuel_2 = miles_since_fuel

        while remaining > 0.001:
            miles_to_fuel = FUEL_STOP_INTERVAL_MILES - miles_since_fuel_2
            if miles_to_fuel < remaining:
                seg_miles = min(miles_to_fuel, remaining)
                if seg_miles > 0:
                    self._drive(seg_miles, pickup_location, dropoff_location)
                    miles_since_fuel_2 += seg_miles
                    remaining -= seg_miles
                if getattr(self, '_drive_stopped_early', False):
                    break
                if miles_since_fuel_2 >= FUEL_STOP_INTERVAL_MILES - 1:
                    fuel_loc = f"Fuel stop after {self.miles_traveled:.0f} mi"
                    self._add_route_stop("Fuel Stop", fuel_loc, "fuel", FUEL_STOP_DURATION_HRS)
                    self._on_duty_stop(FUEL_STOP_DURATION_HRS, fuel_loc, "Fueling")
                    miles_since_fuel_2 = 0.0
            else:
                self._drive(remaining, pickup_location, dropoff_location)
                if getattr(self, '_drive_stopped_early', False):
                    break
                miles_since_fuel_2 += remaining
                remaining = 0

        if remaining > 0.001:
            self.warnings.append(
                f"Trip could not reach dropoff before the cycle limit. "
                f"{remaining:.0f} miles remain unscheduled."
            )
            return finalize_plan()

        # Dropoff stop
        self._add_route_stop("Dropoff", dropoff_location, "dropoff", PICKUP_DROPOFF_DURATION_HRS)
        self._on_duty_stop(PICKUP_DROPOFF_DURATION_HRS, dropoff_location, "Unloading / dropoff")

        # End of trip
        self._add_segment('OFF', 1.0, dropoff_location, "Trip complete - off duty")
        self.clock += 1.0

        return finalize_plan()

    def _build_log_days(self, origin, pickup, dropoff, total_miles) -> List[LogDay]:
        """Split segments into per-day 24-hour log sheets"""
        if not self.segments:
            return []

        total_hours = max(s.end_hour for s in self.segments)
        num_days = math.ceil(total_hours / 24) + 1
        log_days = []

        for day_idx in range(num_days):
            day_start = day_idx * 24.0
            day_end = day_start + 24.0
            day_segments = []

            for seg in self.segments:
                cs = max(seg.start_hour, day_start)
                ce = min(seg.end_hour, day_end)
                if ce <= cs:
                    continue
                day_segments.append(DutySegment(
                    status=seg.status,
                    start_hour=cs - day_start,
                    duration=ce - cs,
                    location=seg.location,
                    note=seg.note,
                ))

            if not day_segments:
                continue

            day_miles = sum(s.duration * AVG_SPEED_MPH for s in day_segments if s.status == 'D')
            start_loc = origin if day_idx == 0 else next(
                (s.location for s in day_segments if s.location), "En Route"
            )
            end_loc = next(
                (s.location for s in reversed(day_segments) if s.location), "En Route"
            )

            log_days.append(LogDay(
                day_number=day_idx + 1,
                date_offset_days=day_idx,
                segments=day_segments,
                start_location=start_loc,
                end_location=end_loc,
                total_miles=day_miles,
            ))

        return log_days
