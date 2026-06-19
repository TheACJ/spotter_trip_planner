# Spotter AI — ELD Trip Planner

Full-stack FMCSA Hours of Service trip planning app built with **Django + React**.

## What it does

Enter a current location, pickup, and dropoff city — the app:
1. Geocodes all locations via Nominatim (OpenStreetMap)
2. Calculates real road distances via OSRM routing
3. Runs a complete HOS compliance engine (Django backend)
4. Outputs a route map with all stops marked
5. Generates authentic ELD daily log sheets (SVG) for each day of the trip

## HOS Rules enforced

- 11-hour driving limit per shift
- 14-hour on-duty window
- 10-hour mandatory off-duty rest before new shift
- 30-minute break after 8 consecutive driving hours
- 70-hour / 8-day cycle limit
- Fueling every ≤ 950 miles (30-min stop)
- 1 hour each for pickup and dropoff
- Pre-trip inspection (30 min) at start of each shift
- Property-carrying driver, no adverse conditions assumed

## Stack

| Layer | Tech |
|-------|------|
| Backend | Django 5 + Django REST Framework |
| Frontend | React 18 + Vite |
| Map | Leaflet + OpenStreetMap (CartoDB dark tiles) |
| Geocoding | Nominatim (browser-side fetch) |
| Routing | OSRM (browser-side fetch) |
| ELD Charts | Pure SVG, rendered in React |

## Local development

### Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173` — Vite proxies `/api/*` to Django on port 8000.

## Deployment

### Backend (Railway / Render / Fly.io)

```bash
cd backend
gunicorn spotter.wsgi:application --bind 0.0.0.0:$PORT
```

Set environment variable: `ALLOWED_HOSTS=your-backend-domain.com`

### Frontend (Vercel)

```bash
cd frontend
# Set env var: VITE_API_URL=https://your-backend-domain.com
npm run build
# Deploy dist/ to Vercel
```

In `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

## API

### `POST /api/plan-trip/`

```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "St. Louis, MO",
  "dropoff_location": "Dallas, TX",
  "current_cycle_used": 8.0,
  "distance_to_pickup_miles": 297.4,
  "distance_pickup_to_dropoff_miles": 630.2,
  "origin_coords": { "lat": 41.8781, "lon": -87.6298 },
  "pickup_coords": { "lat": 38.6270, "lon": -90.1994 },
  "dropoff_coords": { "lat": 32.7767, "lon": -96.7970 },
  "geometry": [[41.87, -87.62], ...]
}
```

Returns: route info, trip summary, route stops schedule, and per-day ELD log data.
