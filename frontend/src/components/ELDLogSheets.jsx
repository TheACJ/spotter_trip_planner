import { useState } from 'react'
import ELDLogSheet from './ELDLogSheet'
import './ELDLogSheets.css'

export default function ELDLogSheets({ data }) {
  const { log_days } = data
  const [currentDay, setCurrentDay] = useState(0)
  const day = log_days[currentDay]

  return (
    <div className="eld-container">
      {log_days.length > 1 && (
        <div className="day-selector">
          <span className="day-selector-label">Log Sheet:</span>
          {log_days.map((d, i) => (
            <button key={i} className={`day-btn${i === currentDay ? ' active' : ''}`} onClick={() => setCurrentDay(i)}>
              Day {d.day_number}
              <span className="day-btn-sub">{d.total_driving_hrs.toFixed(1)}h drv</span>
            </button>
          ))}
        </div>
      )}

      <div className="eld-scroll">
        <div className="eld-page-wrap">
          <ELDLogSheet day={day} dayIndex={currentDay} />
        </div>
      </div>

      {log_days.length > 1 && (
        <div className="day-nav">
          <button className="nav-btn" onClick={() => setCurrentDay(d => Math.max(0, d - 1))} disabled={currentDay === 0}>
            &larr; Prev Day
          </button>
          <span className="day-nav-counter">{currentDay + 1} / {log_days.length}</span>
          <button className="nav-btn" onClick={() => setCurrentDay(d => Math.min(log_days.length - 1, d + 1))} disabled={currentDay === log_days.length - 1}>
            Next Day &rarr;
          </button>
        </div>
      )}
    </div>
  )
}
