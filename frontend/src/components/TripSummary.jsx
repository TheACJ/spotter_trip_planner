import './TripSummary.css'

function fmtHrs(hrs) {
  const h = Math.floor(hrs)
  const m = Math.round((hrs - h) * 60)
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function fmtTime(offsetHrs) {
  const days = Math.floor(offsetHrs / 24)
  const h = Math.floor(offsetHrs % 24)
  const m = Math.round((offsetHrs % 1) * 60)
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return days > 0 ? `Day ${days + 1}, ${timeStr}` : timeStr
}

const STOP_ICONS = {
  pickup: { label: 'Pickup', color: '#5a8bbf', bg: 'rgba(90,139,191,0.12)' },
  dropoff: { label: 'Dropoff', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  fuel: { label: 'Fuel', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  rest: { label: 'Rest', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  break: { label: 'Break', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
}

export default function TripSummary({ data }) {
  const { route, trip_summary, route_stops } = data

  return (
    <div className="trip-summary">
      <div className="summary-header">Trip Summary</div>
      <div className="stats-grid">
        <Stat label="Total Distance" value={`${trip_summary.total_distance_miles.toLocaleString()} mi`} mono />
        <Stat label="Driving Time" value={fmtHrs(trip_summary.total_driving_hrs)} mono />
        <Stat label="Total Trip Time" value={fmtHrs(trip_summary.total_trip_hrs)} mono />
        <Stat label="Log Days" value={`${trip_summary.num_log_days}`} mono />
      </div>

      <div className="summary-section">
        <div className="section-label">Route</div>
        <div className="route-chain">
          <RoutePoint color="var(--amber)" label="Origin" name={route.origin.name} />
          <div className="chain-line"><span className="chain-dist mono">{route.distance_to_pickup_miles} mi</span></div>
          <RoutePoint color="var(--steel-light)" label="Pickup" name={route.pickup.name} />
          <div className="chain-line"><span className="chain-dist mono">{route.distance_pickup_to_dropoff_miles} mi</span></div>
          <RoutePoint color="var(--success)" label="Dropoff" name={route.dropoff.name} />
        </div>
      </div>

      <div className="summary-section">
        <div className="section-label">Stops & Schedule</div>
        <div className="stops-list">
          {route_stops.map((stop, i) => {
            const meta = STOP_ICONS[stop.stop_type] || STOP_ICONS.rest
            return (
              <div key={i} className="stop-item">
                <div className="stop-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</div>
                <div className="stop-info">
                  <div className="stop-name">{stop.location.length > 35 ? stop.location.slice(0, 35) + '...' : stop.location}</div>
                  <div className="stop-time mono">Arr {fmtTime(stop.arrival_hour)} · {fmtHrs(stop.duration_hrs)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {data.trip_summary.warnings?.length > 0 && (
        <div className="warnings-section">
          {data.trip_summary.warnings.map((w, i) => (
            <div key={i} className="warning-item">⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, mono }) {
  return (
    <div className="stat-cell">
      <div className={`stat-value${mono ? ' mono' : ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function RoutePoint({ color, label, name }) {
  return (
    <div className="route-point">
      <div className="route-dot" style={{ background: color }}/>
      <div>
        <div className="route-point-label">{label}</div>
        <div className="route-point-name">{name}</div>
      </div>
    </div>
  )
}
