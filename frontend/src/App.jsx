import { useState } from 'react'
import TripForm from './components/TripForm'
import RouteMap from './components/RouteMap'
import ELDLogSheets from './components/ELDLogSheets'
import TripSummary from './components/TripSummary'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

// --- Geocoding via Nominatim (runs in browser, no CORS restriction) ---
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(`Geocoding failed for: ${query}`)
  const data = await res.json()
  if (!data.length) throw new Error(`Location not found: "${query}". Try a more specific city/state.`)
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
}

// --- OSRM routing (runs in browser) ---
async function getRoute(coords) {
  const coordStr = coords.map(c => `${c.lon},${c.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Routing service unavailable')
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Could not calculate route between locations')
  const route = data.routes[0]
  return {
    distance_miles: route.distance / 1609.34,
    geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    legs: route.legs.map(l => ({ distance_miles: l.distance / 1609.34 }))
  }
}

export default function App() {
  const [tripData, setTripData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('map')

  async function handlePlanTrip(formValues) {
    setLoading(true)
    setError(null)
    setTripData(null)

    try {
      setLoadingStep('Geocoding locations...')
      const [originCoords, pickupCoords, dropoffCoords] = await Promise.all([
        geocode(formValues.current_location),
        geocode(formValues.pickup_location),
        geocode(formValues.dropoff_location),
      ])

      setLoadingStep('Calculating road distances...')
      const [routeLeg1, routeLeg2] = await Promise.all([
        getRoute([originCoords, pickupCoords]),
        getRoute([pickupCoords, dropoffCoords]),
      ])

      const fullRoute = await getRoute([originCoords, pickupCoords, dropoffCoords])

      setLoadingStep('Building HOS schedule & ELD logs...')
      const payload = {
        ...formValues,
        distance_to_pickup_miles: routeLeg1.distance_miles,
        distance_pickup_to_dropoff_miles: routeLeg2.distance_miles,
        origin_coords: originCoords,
        pickup_coords: pickupCoords,
        dropoff_coords: dropoffCoords,
        geometry: fullRoute.geometry,
      }

      const res = await fetch(`${API_BASE}/api/plan-trip/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to plan trip.')
      }

      setTripData(data)
      setActiveTab('map')
    } catch (err) {
      setError(err.message || 'Failed to plan trip.')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-brand">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="9" fill="#F5A623"/>
            <path d="M5 25h2v-9l4.5-4.5H24L28.5 16v9h2v2H5v-2z" fill="#080f1c"/>
            <circle cx="11" cy="25" r="3" fill="#080f1c" stroke="#F5A623" strokeWidth="1.2"/>
            <circle cx="24" cy="25" r="3" fill="#080f1c" stroke="#F5A623" strokeWidth="1.2"/>
            <rect x="9" y="18" width="7" height="5" rx="0.5" fill="#F5A623" opacity="0.7"/>
            <rect x="17" y="18" width="9" height="5" rx="0.5" fill="#F5A623" opacity="0.3"/>
          </svg>
          <div>
            <div className="brand-name">Spotter AI</div>
            <div className="brand-sub">ELD Trip Planner</div>
          </div>
        </div>
        <div className="header-badge">FMCSA HOS · 70hr/8-day Cycle</div>
      </header>

      <main className="app-main">
        <aside className="left-panel">
          <TripForm onSubmit={handlePlanTrip} loading={loading} />
          {error && (
            <div className="error-banner">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#ef4444" strokeWidth="1.5"/><path d="M8 5v4M8 11v.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
              {error}
            </div>
          )}
          {tripData && <TripSummary data={tripData} />}
        </aside>

        <section className="right-panel">
          {!tripData && !loading && (
            <div className="empty-state">
              <svg width="130" height="90" viewBox="0 0 130 90" fill="none">
                <rect x="8" y="28" width="85" height="34" rx="5" fill="#0f2040" stroke="#1e3a5f" strokeWidth="1.5"/>
                <rect x="14" y="34" width="28" height="20" rx="2" fill="#152a52"/>
                <circle cx="28" cy="65" r="8" fill="#0f2040" stroke="#2a4f7a" strokeWidth="2"/>
                <circle cx="75" cy="65" r="8" fill="#0f2040" stroke="#2a4f7a" strokeWidth="2"/>
                <path d="M93 46l22-6v16H93V46z" fill="#0f2040" stroke="#1e3a5f" strokeWidth="1.5"/>
                <circle cx="105" cy="65" r="8" fill="#0f2040" stroke="#2a4f7a" strokeWidth="2"/>
                <path d="M22 50h65" stroke="#F5A623" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.7"/>
                <circle cx="22" cy="50" r="3" fill="#F5A623"/>
                <circle cx="87" cy="50" r="3" fill="#22c55e"/>
              </svg>
              <h2>Plan your route</h2>
              <p>Enter origin, pickup, and dropoff locations to generate<br/>a fully compliant FMCSA HOS trip plan with ELD logs.</p>
              <div className="empty-rules">
                <span>11-hr drive limit</span>
                <span>14-hr window</span>
                <span>30-min break</span>
                <span>70-hr/8-day cycle</span>
              </div>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner"/>
              <p>Planning your trip...</p>
              <span>{loadingStep}</span>
            </div>
          )}

          {tripData && (
            <>
              <div className="tab-bar">
                <button className={`tab-btn${activeTab === 'map' ? ' active' : ''}`} onClick={() => setActiveTab('map')}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 11l3.5-8 3.5 3 3.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Route Map
                </button>
                <button className={`tab-btn${activeTab === 'logs' ? ' active' : ''}`} onClick={() => setActiveTab('logs')}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 5h4M5 7.5h4M5 10h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  ELD Logs ({tripData.log_days.length} {tripData.log_days.length === 1 ? 'day' : 'days'})
                </button>
              </div>
              <div className="tab-content">
                {activeTab === 'map' && <RouteMap data={tripData} />}
                {activeTab === 'logs' && <ELDLogSheets data={tripData} />}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
