import { useState } from 'react'
import './TripForm.css'

const EXAMPLES = [
  { label: 'Chicago -> Dallas', current: 'Chicago, IL', pickup: 'St. Louis, MO', dropoff: 'Dallas, TX', cycle: 8 },
  { label: 'NYC -> Atlanta', current: 'New York, NY', pickup: 'Philadelphia, PA', dropoff: 'Atlanta, GA', cycle: 0 },
  { label: 'LA -> Seattle', current: 'Los Angeles, CA', pickup: 'San Francisco, CA', dropoff: 'Seattle, WA', cycle: 20 },
]

export default function TripForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
    current_cycle_used: '',
  })

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function loadExample(ex) {
    setForm({
      current_location: ex.current,
      pickup_location: ex.pickup,
      dropoff_location: ex.dropoff,
      current_cycle_used: String(ex.cycle),
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      current_location: form.current_location,
      pickup_location: form.pickup_location,
      dropoff_location: form.dropoff_location,
      current_cycle_used: parseFloat(form.current_cycle_used) || 0,
    })
  }

  const isValid = form.current_location && form.pickup_location && form.dropoff_location

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h3>Trip Details</h3>
        <span className="form-subtitle">Property-carrying · 70hr/8-day</span>
      </div>

      <div className="examples-row">
        <span className="examples-label">Try:</span>
        {EXAMPLES.map(ex => (
          <button key={ex.label} type="button" className="example-chip" onClick={() => loadExample(ex)}>
            {ex.label}
          </button>
        ))}
      </div>

      <div className="form-divider"/>

      <div className="form-fields">
        <FieldGroup label="Current Location" name="current_location" value={form.current_location}
          onChange={handleChange} placeholder="e.g. Chicago, IL" dot="amber" />
        <div className="route-connector"/>
        <FieldGroup label="Pickup Location" name="pickup_location" value={form.pickup_location}
          onChange={handleChange} placeholder="e.g. St. Louis, MO" dot="blue" />
        <div className="route-connector"/>
        <FieldGroup label="Dropoff Location" name="dropoff_location" value={form.dropoff_location}
          onChange={handleChange} placeholder="e.g. Dallas, TX" dot="green" />

        <div className="form-divider" style={{margin: '4px 0'}}/>

        <div className="field-group">
          <label className="field-label">
            Current Cycle Used
            <span className="field-hint">Hours on-duty this 8-day cycle (0-70)</span>
          </label>
          <div className="input-wrap">
            <input type="number" name="current_cycle_used" value={form.current_cycle_used}
              onChange={handleChange} placeholder="0" min="0" max="70" step="0.5"
              className="field-input mono" />
            <span className="input-suffix">hrs</span>
          </div>
        </div>
      </div>

      <div className="form-footer">
        <button type="submit" className="submit-btn" disabled={!isValid || loading}>
          {loading ? (
            <><span className="btn-spinner"/>Planning Route...</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>Plan Trip</>
          )}
        </button>
        <p className="form-footnote">Uses OpenStreetMap · OSRM routing</p>
      </div>
    </form>
  )
}

function FieldGroup({ label, name, value, onChange, placeholder, dot }) {
  return (
    <div className="field-group">
      <label className="field-label">
        <span className={`dot dot-${dot}`}/>
        {label}
      </label>
      <div className="input-wrap">
        <input type="text" name={name} value={value} onChange={onChange}
          placeholder={placeholder} className="field-input" required />
      </div>
    </div>
  )
}
