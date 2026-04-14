import { useState, useEffect, useMemo } from 'react'
import { api } from '../api'
import { STAGE_ORDER, STAGE_COLORS, THEMES, SOURCING_OPTIONS, OWNER_COLORS, CRITERIA } from '../constants'

// ── helpers ────────────────────────────────────────────────────────────────────
function fmtEV(v) {
  if (!v || v === 0) return '€0'
  if (v >= 1000) return `€${(v / 1000).toFixed(1)}B`
  return `€${v.toFixed(0)}m`
}

// ── Funnel chart ───────────────────────────────────────────────────────────────
function FunnelChart({ data }) {
  if (!data) return null
  const maxCount = Math.max(...data.map(r => r.count), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">Pipeline Funnel</div>
      <div className="funnel-rows">
        {data.map((row, i) => {
          const prev    = i > 0 ? data[i - 1].count : null
          const convPct = prev != null && prev > 0 ? Math.round((row.count / prev) * 100) : null
          const barW    = (row.count / maxCount) * 100
          const sc      = STAGE_COLORS[row.stage] || STAGE_COLORS.Lost
          return (
            <div key={row.stage} className="funnel-row">
              <span className="funnel-label">{row.stage}</span>
              <div className="funnel-bar-track">
                <div className="funnel-bar-fill" style={{ width: `${barW}%`, background: sc.bar }} />
              </div>
              <span className="funnel-count">{row.count}</span>
              {convPct !== null && (
                <span className={`funnel-conv${row.count === 0 ? ' zero' : ''}`}>{convPct}%</span>
              )}
            </div>
          )
        })}
      </div>
      <div className="chart-note">Conversion = deals in stage ÷ deals in previous stage</div>
    </div>
  )
}

// ── Avg time per stage ─────────────────────────────────────────────────────────
function AvgStageTimeChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="chart-card">
      <div className="chart-title">Avg Days per Stage</div>
      <p className="chart-empty">No stage history yet — move deals through stages to build data.</p>
    </div>
  )

  const maxDays = Math.max(...data.map(r => r.avg_days), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">Avg Days per Stage</div>
      <div className="funnel-rows">
        {data.map(row => (
          <div key={row.stage} className="funnel-row">
            <span className="funnel-label">{row.stage}</span>
            <div className="funnel-bar-track">
              <div
                className="funnel-bar-fill"
                style={{ width: `${(row.avg_days / maxDays) * 100}%`, background: STAGE_COLORS[row.stage]?.bar || '#94a3b8' }}
              />
            </div>
            <span className="funnel-count">{Math.round(row.avg_days)}d</span>
            <span className="funnel-conv muted">{row.deal_count} deals</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── EV by theme ────────────────────────────────────────────────────────────────
function EVByThemeChart({ data }) {
  if (!data) return null
  const rows = THEMES.map(t => {
    const entry = data.find(d => d.theme === t.value) || { total_ev: 0, count: 0 }
    return { theme: t.value, ev: entry.total_ev, count: entry.count, color: t.dot, bg: t.bg }
  })
  const noTheme = data.find(d => !d.theme)
  if (noTheme?.total_ev) rows.push({ theme: 'No theme', ev: noTheme.total_ev, count: noTheme.count, color: '#94a3b8', bg: '#f8fafc' })

  const maxEV = Math.max(...rows.map(r => r.ev), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">EV by DTE Theme</div>
      <div className="funnel-rows">
        {rows.map(row => (
          <div key={row.theme} className="funnel-row">
            <span className="funnel-label">{row.theme}</span>
            <div className="funnel-bar-track">
              <div className="funnel-bar-fill" style={{ width: `${(row.ev / maxEV) * 100}%`, background: row.color }} />
            </div>
            <span className="funnel-count">{fmtEV(row.ev)}</span>
            <span className="funnel-conv muted">{row.count}d</span>
          </div>
        ))}
      </div>
      {rows.every(r => r.ev === 0) && <p className="chart-empty">No EV data yet.</p>}
    </div>
  )
}

// ── Sourcing breakdown ─────────────────────────────────────────────────────────
function SourcingChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="chart-card">
      <div className="chart-title">Deal Sourcing Mix</div>
      <p className="chart-empty">No sourcing data yet.</p>
    </div>
  )

  const total = data.reduce((s, r) => s + r.count, 0)
  const maxCount = Math.max(...data.map(r => r.count), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">Deal Sourcing Mix</div>
      <div className="funnel-rows">
        {data.map(row => {
          const opt = SOURCING_OPTIONS.find(o => o.value === row.sourcing)
          const color = opt ? opt.bg.replace(')', ', 0.8)').replace('rgb', 'rgba') : '#94a3b8'
          const barColor = opt ? opt.color : '#94a3b8'
          return (
            <div key={row.sourcing || 'Unknown'} className="funnel-row">
              <span className="funnel-label">{row.sourcing || 'Unknown'}</span>
              <div className="funnel-bar-track">
                <div className="funnel-bar-fill" style={{ width: `${(row.count / maxCount) * 100}%`, background: barColor }} />
              </div>
              <span className="funnel-count">{row.count}</span>
              <span className="funnel-conv muted">{total > 0 ? Math.round((row.count / total) * 100) : 0}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Team workload ──────────────────────────────────────────────────────────────
function TeamWorkloadChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="chart-card">
      <div className="chart-title">Team Workload</div>
      <p className="chart-empty">No team assignments yet.</p>
    </div>
  )

  const maxCount = Math.max(...data.map(r => r.deal_count), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">Team Workload (Active Deals)</div>
      <div className="funnel-rows">
        {data.map(row => {
          const color = OWNER_COLORS[row.owner] || '#64748b'
          return (
            <div key={row.owner} className="funnel-row">
              <span className="funnel-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                {row.owner}
              </span>
              <div className="funnel-bar-track">
                <div className="funnel-bar-fill" style={{ width: `${(row.deal_count / maxCount) * 100}%`, background: color }} />
              </div>
              <span className="funnel-count">{row.deal_count}</span>
              {row.total_ev > 0 && <span className="funnel-conv muted">{fmtEV(row.total_ev)}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Criteria completion ────────────────────────────────────────────────────────
function CriteriaChart({ data }) {
  if (!data) return null
  const total = data.total_active || 1

  return (
    <div className="chart-card">
      <div className="chart-title">Investment Criteria Completion</div>
      <div className="funnel-rows">
        {CRITERIA.map(c => {
          const count = data[c.key] || 0
          const pct = Math.round((count / total) * 100)
          return (
            <div key={c.key} className="funnel-row">
              <span className="funnel-label" style={{ fontSize: 11 }}>{c.label}</span>
              <div className="funnel-bar-track">
                <div className="funnel-bar-fill" style={{ width: `${pct}%`, background: '#4f46e5' }} />
              </div>
              <span className="funnel-count">{count}</span>
              <span className="funnel-conv muted">{pct}%</span>
            </div>
          )
        })}
      </div>
      <div className="chart-note">{total} active deals</div>
    </div>
  )
}

// ── Monthly trend ──────────────────────────────────────────────────────────────
function MonthlyTrendChart({ data }) {
  const months = useMemo(() => {
    if (!data || data.length === 0) return []
    return data
  }, [data])

  if (months.length === 0) return (
    <div className="chart-card chart-card--wide">
      <div className="chart-title">Deals Added per Month</div>
      <p className="chart-empty">No trend data yet.</p>
    </div>
  )

  const maxCount = Math.max(...months.map(m => m.count), 1)
  const W = 460, H = 120, PAD = { t: 10, r: 10, b: 28, l: 24 }
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b

  const points = months.map((m, i) => ({
    x: PAD.l + (i / Math.max(months.length - 1, 1)) * plotW,
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
        {[0, 0.5, 1].map(frac => {
          const y   = PAD.t + plotH - frac * plotH
          const val = Math.round(frac * maxCount)
          return (
            <g key={frac}>
              <line x1={PAD.l} y1={y} x2={PAD.l + plotW} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{val}</text>
            </g>
          )
        })}
        <path d={area} fill="#4f46e510" />
        <polyline points={polyline} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#4f46e5" />)}
        {points.map((p, i) => i % 3 === 0 && (
          <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{p.month}</text>
        ))}
      </svg>
    </div>
  )
}

// ── Lost reasons ───────────────────────────────────────────────────────────────
function LostReasonsChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="chart-card">
      <div className="chart-title">Lost Reasons</div>
      <p className="chart-empty">No lost deals yet.</p>
    </div>
  )

  const maxCount = Math.max(...data.map(r => r.count), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">Lost Reasons ({data.reduce((s, r) => s + r.count, 0)} deals)</div>
      <div className="funnel-rows">
        {data.map(row => (
          <div key={row.reason || 'Unknown'} className="funnel-row">
            <span className="funnel-label">{row.reason || 'Unknown'}</span>
            <div className="funnel-bar-track">
              <div className="funnel-bar-fill" style={{ width: `${(row.count / maxCount) * 100}%`, background: '#94a3b8' }} />
            </div>
            <span className="funnel-count">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Postponed reasons ──────────────────────────────────────────────────────────
function PostponedReasonsChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="chart-card">
      <div className="chart-title">Postponed Reasons</div>
      <p className="chart-empty">No postponed deals yet.</p>
    </div>
  )

  const maxCount = Math.max(...data.map(r => r.count), 1)

  return (
    <div className="chart-card">
      <div className="chart-title">Postponed Reasons ({data.reduce((s, r) => s + r.count, 0)} deals)</div>
      <div className="funnel-rows">
        {data.map(row => (
          <div key={row.reason || 'Unknown'} className="funnel-row">
            <span className="funnel-label">{row.reason || 'Unknown'}</span>
            <div className="funnel-bar-track">
              <div className="funnel-bar-fill" style={{ width: `${(row.count / maxCount) * 100}%`, background: '#6b7280' }} />
            </div>
            <span className="funnel-count">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── KPI row ────────────────────────────────────────────────────────────────────
function KPIRow({ totals }) {
  if (!totals) return null
  const kpis = [
    { label: 'Active Deals',  value: totals.active_deals ?? 0 },
    { label: 'Pipeline EV',   value: fmtEV(totals.pipeline_ev ?? 0) },
    { label: 'Portfolio EV',  value: fmtEV(totals.closed_ev ?? 0) },
    { label: 'Win Rate',      value: `${totals.win_rate ?? 0}%` },
    { label: 'Lost',          value: totals.lost_count ?? 0 },
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
export default function AnalyticsPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    api.getAnalytics()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="analytics-page">
      <div className="loading-state"><div className="spinner" /><span>Loading analytics…</span></div>
    </div>
  )

  if (error) return (
    <div className="analytics-page">
      <p className="chart-empty" style={{ color: 'var(--danger)' }}>Failed to load analytics: {error}</p>
    </div>
  )

  return (
    <div className="analytics-page">
      <KPIRow totals={data?.totals} />
      <div className="analytics-grid">
        <FunnelChart data={data?.funnel} />
        <EVByThemeChart data={data?.themes} />
        <SourcingChart data={data?.sourcing} />
        <TeamWorkloadChart data={data?.team} />
        <CriteriaChart data={data?.criteria} />
        <MonthlyTrendChart data={data?.monthly} />
        <AvgStageTimeChart data={data?.stage_time} />
        <LostReasonsChart data={data?.lost} />
        <PostponedReasonsChart data={data?.postponed} />
      </div>
    </div>
  )
}
