import { useMemo } from 'react'
import { STAGE_ORDER, STAGE_COLORS, THEMES } from '../constants'

// ── helpers ────────────────────────────────────────────────────────────────────
function fmtEV(v) {
  if (v >= 1000) return `€${(v / 1000).toFixed(1)}B`
  return `€${v.toFixed(0)}m`
}

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.round((Date.now() - new Date(dateStr)) / 86400000)
}

// ── Funnel chart ───────────────────────────────────────────────────────────────
function FunnelChart({ deals }) {
  const rows = STAGE_ORDER.map((stage, i) => {
    const count = deals.filter(d => d.stage === stage).length
    return { stage, count }
  })
  const maxCount = Math.max(...rows.map(r => r.count), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">Pipeline Funnel</div>
      <div className="funnel-rows">
        {rows.map((row, i) => {
          const prev    = i > 0 ? rows[i - 1].count : null
          const convPct = prev != null && prev > 0 ? Math.round((row.count / prev) * 100) : null
          const barW    = maxCount > 0 ? (row.count / maxCount) * 100 : 0
          const sc      = STAGE_COLORS[row.stage]
          return (
            <div key={row.stage} className="funnel-row">
              <span className="funnel-label">{row.stage}</span>
              <div className="funnel-bar-track">
                <div
                  className="funnel-bar-fill"
                  style={{ width: `${barW}%`, background: sc.bar }}
                />
              </div>
              <span className="funnel-count">{row.count}</span>
              {convPct !== null && (
                <span className={`funnel-conv${row.count === 0 ? ' zero' : ''}`}>
                  {convPct}%
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="chart-note">Conversion = deals in stage ÷ deals in previous stage</div>
    </div>
  )
}

// ── EV by theme bar chart ──────────────────────────────────────────────────────
function EVByThemeChart({ deals }) {
  const activeDeals = deals.filter(d => d.stage !== 'Lost' && d.ev != null)
  const rows = THEMES.map(t => ({
    theme: t.value,
    ev:    activeDeals.filter(d => d.theme === t.value).reduce((s, d) => s + d.ev, 0),
    color: t.dot,
    bg:    t.bg,
    count: activeDeals.filter(d => d.theme === t.value).length,
  }))
  const noTheme = activeDeals.filter(d => !d.theme).reduce((s, d) => s + d.ev, 0)
  if (noTheme > 0) rows.push({ theme: 'No theme', ev: noTheme, color: '#94a3b8', bg: '#f8fafc', count: activeDeals.filter(d => !d.theme).length })

  const maxEV = Math.max(...rows.map(r => r.ev), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">EV by DTE Theme</div>
      <div className="funnel-rows">
        {rows.map(row => (
          <div key={row.theme} className="funnel-row">
            <span className="funnel-label">{row.theme}</span>
            <div className="funnel-bar-track">
              <div
                className="funnel-bar-fill"
                style={{ width: `${(row.ev / maxEV) * 100}%`, background: row.color }}
              />
            </div>
            <span className="funnel-count">{fmtEV(row.ev)}</span>
            <span className="funnel-conv muted">{row.count}d</span>
          </div>
        ))}
      </div>
      {rows.every(r => r.ev === 0) && <p className="chart-empty">No EV data yet — add EV estimates to deals.</p>}
    </div>
  )
}

// ── Avg deal age by stage ──────────────────────────────────────────────────────
function AvgAgeChart({ deals }) {
  const rows = STAGE_ORDER.map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage && d.created_at)
    const avg = stageDeals.length > 0
      ? Math.round(stageDeals.reduce((s, d) => s + daysSince(d.created_at), 0) / stageDeals.length)
      : null
    return { stage, avg, count: stageDeals.length }
  }).filter(r => r.count > 0)

  const maxAvg = Math.max(...rows.map(r => r.avg ?? 0), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">Avg Deal Age by Stage</div>
      {rows.length === 0 ? (
        <p className="chart-empty">No data yet.</p>
      ) : (
        <div className="funnel-rows">
          {rows.map(row => (
            <div key={row.stage} className="funnel-row">
              <span className="funnel-label">{row.stage}</span>
              <div className="funnel-bar-track">
                <div
                  className="funnel-bar-fill"
                  style={{ width: `${((row.avg ?? 0) / maxAvg) * 100}%`, background: STAGE_COLORS[row.stage].bar }}
                />
              </div>
              <span className="funnel-count">{row.avg ?? '—'} d</span>
              <span className="funnel-conv muted">{row.count} deals</span>
            </div>
          ))}
        </div>
      )}
      <div className="chart-note">Days since deal was created (current deals only)</div>
    </div>
  )
}

// ── Monthly trend line chart ───────────────────────────────────────────────────
function MonthlyTrendChart({ deals }) {
  const months = useMemo(() => {
    const now    = new Date()
    const result = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push({
        key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        count: 0,
      })
    }
    deals.forEach(deal => {
      if (!deal.created_at) return
      const d   = new Date(deal.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const m   = result.find(r => r.key === key)
      if (m) m.count++
    })
    return result
  }, [deals])

  const maxCount = Math.max(...months.map(m => m.count), 1)
  const W = 460, H = 120, PAD = { t: 10, r: 10, b: 28, l: 24 }
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b

  const points = months.map((m, i) => ({
    x: PAD.l + (i / (months.length - 1)) * plotW,
    y: PAD.t + plotH - (m.count / maxCount) * plotH,
    ...m,
  }))

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')
  const area = `M${points[0].x},${PAD.t + plotH} ` +
    points.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${points[points.length - 1].x},${PAD.t + plotH} Z`

  return (
    <div className="chart-card chart-card--wide">
      <div className="chart-title">Deals Added per Month</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" preserveAspectRatio="xMidYMid meet">
        {/* Y gridlines */}
        {[0, 0.5, 1].map(frac => {
          const y = PAD.t + plotH - frac * plotH
          const val = Math.round(frac * maxCount)
          return (
            <g key={frac}>
              <line x1={PAD.l} y1={y} x2={PAD.l + plotW} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{val}</text>
            </g>
          )
        })}
        {/* Area fill */}
        <path d={area} fill="#4f46e510" />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#4f46e5" />
        ))}
        {/* X labels — every 3rd */}
        {points.map((p, i) => i % 3 === 0 && (
          <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{p.label}</text>
        ))}
      </svg>
      {deals.filter(d => d.created_at).length === 0 && (
        <p className="chart-empty">No deals with creation date data.</p>
      )}
    </div>
  )
}

// ── Lost breakdown ─────────────────────────────────────────────────────────────
function LostBreakdownChart({ deals }) {
  const lostDeals = deals.filter(d => d.stage === 'Lost')
  if (lostDeals.length === 0) return (
    <div className="chart-card">
      <div className="chart-title">Lost Reasons</div>
      <p className="chart-empty">No lost deals yet.</p>
    </div>
  )

  const counts = {}
  lostDeals.forEach(d => {
    const r = d.lost_reason || 'Unknown'
    counts[r] = (counts[r] || 0) + 1
  })
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const max  = Math.max(...rows.map(r => r[1]), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">Lost Reasons ({lostDeals.length} deals)</div>
      <div className="funnel-rows">
        {rows.map(([reason, count]) => (
          <div key={reason} className="funnel-row">
            <span className="funnel-label">{reason}</span>
            <div className="funnel-bar-track">
              <div className="funnel-bar-fill" style={{ width: `${(count / max) * 100}%`, background: '#94a3b8' }} />
            </div>
            <span className="funnel-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Summary KPIs ───────────────────────────────────────────────────────────────
function KPIRow({ deals }) {
  const active     = deals.filter(d => d.stage !== 'Lost')
  const totalEV    = active.reduce((s, d) => s + (d.ev || 0), 0)
  const closedDeals = deals.filter(d => d.stage === 'Closed')
  const closedEV   = closedDeals.reduce((s, d) => s + (d.ev || 0), 0)
  const lostCount  = deals.filter(d => d.stage === 'Lost').length
  const winRate    = (active.length + lostCount) > 0
    ? Math.round((closedDeals.length / (closedDeals.length + lostCount)) * 100)
    : 0

  const kpis = [
    { label: 'Active Deals',    value: active.length },
    { label: 'Pipeline EV',     value: fmtEV(totalEV) },
    { label: 'Closed EV',       value: fmtEV(closedEV) },
    { label: 'Win Rate',        value: `${winRate}%` },
    { label: 'Lost',            value: lostCount },
  ]

  return (
    <div className="analytics-kpis">
      {kpis.map(k => (
        <div key={k.label} className="analytics-kpi">
          <span className="analytics-kpi-value">{k.value}</span>
          <span className="analytics-kpi-label">{k.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function AnalyticsPage({ deals }) {
  return (
    <div className="analytics-page">
      <KPIRow deals={deals} />
      <div className="analytics-grid">
        <FunnelChart deals={deals} />
        <EVByThemeChart deals={deals} />
        <MonthlyTrendChart deals={deals} />
        <AvgAgeChart deals={deals} />
        <LostBreakdownChart deals={deals} />
      </div>
    </div>
  )
}
