import { useEffect, useRef } from 'react'
import './RouteMap.css'

function fmtHrs(hrs) {
  const h = Math.floor(hrs)
  const m = Math.round((hrs - h) * 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const STOP_META = {
  fuel: { label: 'Fuel Stop', color: '#f59e0b' },
  rest: { label: 'Rest Stop', color: '#a78bfa' },
  break: { label: 'Break', color: '#6b7280' },
}

export default function RouteMap({ data }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  const { route, route_stops } = data

  useEffect(() => {
    import('leaflet').then(L => {
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!mapRef.current) return

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true })
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      if (route.geometry && route.geometry.length > 1) {
        L.polyline(route.geometry, {
          color: '#F5A623',
          weight: 4,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map)
      }

      createCircleMarker(L, [route.origin.lat, route.origin.lon], '#F5A623', 10)
        .addTo(map).bindPopup(popupHTML('Origin', route.origin.name, '#F5A623'))
      createCircleMarker(L, [route.pickup.lat, route.pickup.lon], '#5a8bbf', 10)
        .addTo(map).bindPopup(popupHTML('Pickup', route.pickup.name, '#5a8bbf'))
      createCircleMarker(L, [route.dropoff.lat, route.dropoff.lon], '#22c55e', 12)
        .addTo(map).bindPopup(popupHTML('Dropoff', route.dropoff.name, '#22c55e'))

      route_stops.filter(s => ['fuel', 'rest', 'break'].includes(s.stop_type)).forEach(stop => {
        const idx = Math.floor((stop.miles_from_start / route.total_distance_miles) * route.geometry.length)
        const coords = route.geometry[Math.min(idx, route.geometry.length - 1)]
        if (coords) {
          const meta = STOP_META[stop.stop_type] || STOP_META.rest
          createCircleMarker(L, coords, meta.color, 7, 0.7)
            .addTo(map)
            .bindPopup(popupHTML(meta.label, `${stop.miles_from_start.toFixed(0)} mi · ${fmtHrs(stop.duration_hrs)}`, meta.color))
        }
      })

      const bounds = L.latLngBounds([
        [route.origin.lat, route.origin.lon],
        [route.pickup.lat, route.pickup.lon],
        [route.dropoff.lat, route.dropoff.lon],
      ])
      map.fitBounds(bounds, { padding: [48, 48] })
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [data])

  return (
    <div className="route-map-container">
      <div className="map-wrapper" ref={mapRef} />
      <div className="map-legend">
        <LegendItem color="#F5A623" label="Origin" />
        <LegendItem color="#5a8bbf" label="Pickup" />
        <LegendItem color="#22c55e" label="Dropoff" />
        <LegendItem color="#f59e0b" label="Fuel Stop" size={7} />
        <LegendItem color="#a78bfa" label="Rest Stop" size={7} />
        <LegendItem color="#6b7280" label="Break" size={7} />
      </div>
      <div className="map-stats-overlay">
        <div className="map-stat">
          <span className="map-stat-label">Total</span>
          <span className="map-stat-value mono">{data.route.total_distance_miles.toLocaleString()} mi</span>
        </div>
        <div className="map-divider" />
        <div className="map-stat">
          <span className="map-stat-label">To Pickup</span>
          <span className="map-stat-value mono">{data.route.distance_to_pickup_miles} mi</span>
        </div>
        <div className="map-divider" />
        <div className="map-stat">
          <span className="map-stat-label">To Dropoff</span>
          <span className="map-stat-value mono">{data.route.distance_pickup_to_dropoff_miles} mi</span>
        </div>
      </div>
    </div>
  )
}

function createCircleMarker(L, latlng, color, radius = 8, opacity = 1) {
  return L.circleMarker(latlng, {
    radius,
    fillColor: color,
    color: '#080f1c',
    weight: 2,
    opacity: 1,
    fillOpacity: opacity,
  })
}

function popupHTML(type, content, color) {
  return `<div style="font-family:'Inter',sans-serif;min-width:160px"><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:${color};margin-bottom:4px">${type}</div><div style="font-size:13px;color:#f0f4f8;line-height:1.4">${content}</div></div>`
}

function LegendItem({ color, label, size = 9 }) {
  return (
    <div className="legend-item">
      <div className="legend-dot" style={{ background: color, width: size, height: size }} />
      <span>{label}</span>
    </div>
  )
}
