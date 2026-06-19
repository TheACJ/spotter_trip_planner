import './ELDLogSheet.css'

const W = 860
const HEADER_H = 160
const GRID_H = 200
const REMARKS_H = 80
const TOTALS_H = 60
const TOTAL_H = HEADER_H + GRID_H + REMARKS_H + TOTALS_H + 20
const GRID_TOP = HEADER_H + 10
const LEFT_LABEL_W = 110
const GRID_LEFT = LEFT_LABEL_W
const GRID_W = W - LEFT_LABEL_W - 10
const ROW_H = GRID_H / 4

const ROWS = [
  { status: 'OFF', label: '1. Off Duty',             color: '#334155', y: 0 },
  { status: 'SB',  label: '2. Sleeper Berth',         color: '#1e40af', y: 1 },
  { status: 'D',   label: '3. Driving',               color: '#15803d', y: 2 },
  { status: 'ON',  label: '4. On Duty\n(Not Driving)', color: '#b45309', y: 3 },
]

function hrsToX(hrs) { return GRID_LEFT + (hrs / 24) * GRID_W }
function rowToY(i) { return GRID_TOP + i * ROW_H }
function fmtHour(h) {
  if (h === 0 || h === 24) return 'M'
  if (h === 12) return 'N'
  return h <= 12 ? `${h}` : `${h - 12}`
}
function fmtHrsTotal(hrs) {
  const h = Math.floor(hrs)
  const m = Math.round((hrs - h) * 60)
  return `${h}:${String(m).padStart(2, '0')}`
}
function getDateStr(dayOffset) {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

export default function ELDLogSheet({ day, dayIndex }) {
  const { segments, start_location, end_location, total_miles,
          total_driving_hrs, total_on_duty_hrs, total_off_duty_hrs, total_sleeper_hrs,
          carrier, driver_name, truck_number, trailer_number, day_number } = day
  const dateStr = getDateStr(dayIndex)
  const remarks = segments.filter(s => s.note && s.note.trim()).map(s => ({
    time: `${String(Math.floor(s.start_time_of_day)).padStart(2,'0')}:${String(Math.round((s.start_time_of_day % 1) * 60)).padStart(2,'0')}`,
    note: s.note, location: s.location,
  }))

  return (
    <div className="eld-log-sheet">
      <svg viewBox={`0 0 ${W} ${TOTAL_H}`} width="100%" style={{ display: 'block', background: '#f8f5ee', borderRadius: 8 }} xmlns="http://www.w3.org/2000/svg">
        <rect width={W} height={TOTAL_H} fill="#f8f5ee" />
        <HeaderSection dateStr={dateStr} carrier={carrier} driverName={driver_name}
          truckNumber={truck_number} trailerNumber={trailer_number}
          startLocation={start_location} endLocation={end_location}
          totalMiles={total_miles} dayNumber={day_number} />
        <GridSection segments={segments} />
        <RemarksSection remarks={remarks} />
        <TotalsSection driving={total_driving_hrs} onDuty={total_on_duty_hrs}
          offDuty={total_off_duty_hrs} sleeperBerth={total_sleeper_hrs} />
      </svg>
      <div className="log-legend">
        {ROWS.map(r => (
          <div key={r.status} className="log-legend-item">
            <div className="log-legend-swatch" style={{ background: r.color }}/>
            <span>{r.label.replace('\n', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HeaderSection({ dateStr, carrier, driverName, truckNumber, trailerNumber, startLocation, endLocation, totalMiles, dayNumber }) {
  const pad = 14
  return (
    <g>
      <rect x={pad} y={pad} width={W - pad*2} height={HEADER_H - pad} rx="2" fill="none" stroke="#1a2744" strokeWidth="1.5"/>
      <rect x={pad} y={pad} width={W - pad*2} height={28} fill="#1a2744" rx="2"/>
      <text x={W/2} y={pad+19} fill="#f8f5ee" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="Inter, sans-serif" letterSpacing="1">DRIVER'S DAILY LOG — 24 HOURS</text>
      <text x={W-pad-10} y={pad+19} fill="#F5A623" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono, monospace">Day {dayNumber}</text>
      <HeaderField x={pad+8}     y={pad+42} label="Date"               value={dateStr}                  w={160} />
      <HeaderField x={pad+8+170} y={pad+42} label="Driver Name"        value={driverName}               w={220} />
      <HeaderField x={pad+8+400} y={pad+42} label="Carrier"            value={carrier}                  w={230} />
      <HeaderField x={pad+8}     y={pad+82} label="From (Home Terminal)" value={startLocation}           w={260} />
      <HeaderField x={pad+8+270} y={pad+82} label="To"                 value={endLocation}              w={200} />
      <HeaderField x={pad+8+480} y={pad+82} label="Total Miles"        value={`${totalMiles.toFixed(0)} mi`} w={120} mono />
      <HeaderField x={pad+8}     y={pad+122} label="Truck/Tractor #"   value={truckNumber}              w={160} mono />
      <HeaderField x={pad+8+170} y={pad+122} label="Trailer #"         value={trailerNumber}            w={160} mono />
      <HeaderField x={pad+8+340} y={pad+122} label="Co-Driver"         value="N/A"                      w={140} />
      <HeaderField x={pad+8+490} y={pad+122} label="Shipping Doc #"    value="—"                        w={150} />
    </g>
  )
}

function HeaderField({ x, y, label, value, w, mono = false }) {
  return (
    <g>
      <text x={x} y={y} fill="#6b7280" fontSize="8" fontFamily="Inter, sans-serif" letterSpacing="0.3">{label.toUpperCase()}</text>
      <line x1={x} y1={y+3} x2={x+w} y2={y+3} stroke="#9ca3af" strokeWidth="0.7"/>
      <text x={x} y={y+16} fill="#1a2744" fontSize={mono ? "11" : "12"} fontFamily={mono ? "JetBrains Mono, monospace" : "Inter, sans-serif"} fontWeight="500">{value}</text>
    </g>
  )
}

function GridSection({ segments }) {
  const hourLines = []
  for (let h = 0; h <= 24; h++) {
    const x = hrsToX(h)
    const isMajor = h % 6 === 0
    hourLines.push(<line key={`h${h}`} x1={x} y1={GRID_TOP} x2={x} y2={GRID_TOP+GRID_H} stroke={isMajor ? "#9ca3af" : "#d1d5db"} strokeWidth={isMajor ? 1 : 0.5}/>)
  }
  for (let h = 0; h < 24; h++) {
    hourLines.push(<line key={`hh${h}`} x1={hrsToX(h+0.5)} y1={GRID_TOP} x2={hrsToX(h+0.5)} y2={GRID_TOP+GRID_H} stroke="#e5e7eb" strokeWidth="0.4"/>)
  }

  const rowLines = ROWS.map((r, i) => <line key={`row${i}`} x1={GRID_LEFT} y1={rowToY(i)} x2={W-10} y2={rowToY(i)} stroke="#9ca3af" strokeWidth="0.8"/>)
  const hourLabels = []
  for (let h = 0; h <= 24; h++) {
    hourLabels.push(<text key={`hl${h}`} x={hrsToX(h)} y={GRID_TOP-4} fill="#374151" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono, monospace">{fmtHour(h)}</text>)
  }

  const rowLabels = ROWS.map((r, i) => {
    const midY = rowToY(i) + ROW_H / 2
    const lines = r.label.split('\n')
    return (
      <g key={`rl${i}`}>
        <rect x={0} y={rowToY(i)} width={GRID_LEFT} height={ROW_H} fill={i % 2 === 0 ? '#f1f3f5' : '#e8ebee'}/>
        <text x={8} y={midY-(lines.length > 1 ? 5 : 0)} fill="#1a2744" fontSize="9.5" fontFamily="Inter, sans-serif" fontWeight="600">{lines[0]}</text>
        {lines[1] && <text x={8} y={midY+9} fill="#374151" fontSize={8} fontFamily="Inter, sans-serif">{lines[1]}</text>}
        <circle cx={GRID_LEFT-12} cy={midY} r="7" fill={r.color}/>
        <text x={GRID_LEFT-12} y={midY+3.5} fill="white" fontSize="8" textAnchor="middle" fontWeight="bold" fontFamily="Inter, sans-serif">{i+1}</text>
      </g>
    )
  })

  const statusBars = []
  segments.forEach((seg, idx) => {
    const rowDef = ROWS.find(r => r.status === seg.status)
    if (!rowDef) return
    const rowIdx = ROWS.indexOf(rowDef)
    const x1 = hrsToX(Math.min(seg.start_time_of_day, 24))
    const x2 = hrsToX(Math.min(seg.start_time_of_day + seg.duration, 24))
    const y = rowToY(rowIdx)
    const barW = Math.max(x2 - x1, 1)
    statusBars.push(
      <g key={`bar${idx}`}>
        <rect x={x1} y={y+1} width={barW} height={ROW_H-2} fill={rowDef.color} opacity="0.85" rx="1"/>
        <line x1={x1} y1={y+ROW_H/2} x2={x1+barW} y2={y+ROW_H/2} stroke="white" strokeWidth="1.5" opacity="0.5"/>
        {barW > 40 && <text x={x1+barW/2} y={y+ROW_H/2+4} fill="white" fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono, monospace" opacity="0.9">{fmtHrsTotal(seg.duration)}</text>}
        <line x1={x1} y1={rowToY(0)} x2={x1} y2={GRID_TOP+GRID_H} stroke={rowDef.color} strokeWidth="0.8" opacity="0.4" strokeDasharray="2 2"/>
      </g>
    )
  })

  return (
    <g>
      {rowLabels}
      {hourLines}
      {rowLines}
      <line x1={GRID_LEFT} y1={GRID_TOP+GRID_H} x2={W-10} y2={GRID_TOP+GRID_H} stroke="#9ca3af" strokeWidth="0.8"/>
      <text x={hrsToX(6)} y={GRID_TOP-14} fill="#6b7280" fontSize="7.5" textAnchor="middle" fontFamily="Inter,sans-serif">A.M.</text>
      <text x={hrsToX(18)} y={GRID_TOP-14} fill="#6b7280" fontSize="7.5" textAnchor="middle" fontFamily="Inter,sans-serif">P.M.</text>
      {hourLabels}
      {statusBars}
      <rect x={GRID_LEFT} y={GRID_TOP} width={GRID_W} height={GRID_H} fill="none" stroke="#9ca3af" strokeWidth="1"/>
      <rect x={0} y={GRID_TOP} width={GRID_LEFT} height={GRID_H} fill="none" stroke="#9ca3af" strokeWidth="1"/>
    </g>
  )
}

function RemarksSection({ remarks }) {
  const top = GRID_TOP + GRID_H + 10
  return (
    <g>
      <rect x={14} y={top} width={W-28} height={REMARKS_H} fill="white" stroke="#9ca3af" strokeWidth="0.8" rx="1"/>
      <text x={20} y={top+13} fill="#374151" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="600" letterSpacing="0.5">REMARKS / SHIPPING DOCUMENTS</text>
      <line x1={14} y1={top+17} x2={W-14} y2={top+17} stroke="#d1d5db" strokeWidth="0.6"/>
      {remarks.slice(0, 3).map((r, i) => (
        <g key={i}>
          <text x={22} y={top+31+i*16} fill="#1a2744" fontSize="9" fontFamily="JetBrains Mono, monospace">{r.time}</text>
          <text x={68} y={top+31+i*16} fill="#374151" fontSize="9.5" fontFamily="Inter, sans-serif">{r.note}{r.location ? ` — ${r.location.slice(0,55)}` : ''}</text>
        </g>
      ))}
    </g>
  )
}

function TotalsSection({ driving, onDuty, offDuty, sleeperBerth }) {
  const top = GRID_TOP + GRID_H + REMARKS_H + 16
  const colW = (W - 28) / 4
  const items = [
    { label: '1. Off Duty',              value: fmtHrsTotal(offDuty),           color: '#334155' },
    { label: '2. Sleeper Berth',         value: fmtHrsTotal(sleeperBerth),      color: '#1e40af' },
    { label: '3. Driving',               value: fmtHrsTotal(driving),           color: '#15803d' },
    { label: '4. On Duty (Not Driving)', value: fmtHrsTotal(onDuty - driving),  color: '#b45309' },
  ]
  return (
    <g>
      <rect x={14} y={top} width={W-28} height={TOTALS_H} fill="#f1f3f5" stroke="#9ca3af" strokeWidth="0.8" rx="1"/>
      <text x={20} y={top+13} fill="#374151" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="600" letterSpacing="0.5">TOTAL HOURS</text>
      {items.map((item, i) => (
        <g key={i}>
          <rect x={14+i*colW} y={top+18} width={colW} height={TOTALS_H-22} fill={i===2 ? 'rgba(21,128,61,0.08)' : 'none'} stroke="#d1d5db" strokeWidth="0.5"/>
          <circle cx={14+i*colW+10} cy={top+30} r="5" fill={item.color}/>
          <text x={14+i*colW+20} y={top+34} fill="#374151" fontSize="8.5" fontFamily="Inter, sans-serif">{item.label}</text>
          <text x={14+i*colW+colW/2} y={top+52} fill={item.color} fontSize="18" fontWeight="bold" textAnchor="middle" fontFamily="JetBrains Mono, monospace">{item.value}</text>
        </g>
      ))}
      <text x={W-20} y={top+34} fill="#374151" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">Total On-Duty:</text>
      <text x={W-20} y={top+52} fill="#1a2744" fontSize="16" fontWeight="bold" textAnchor="end" fontFamily="JetBrains Mono, monospace">{fmtHrsTotal(onDuty)} hrs</text>
    </g>
  )
}
