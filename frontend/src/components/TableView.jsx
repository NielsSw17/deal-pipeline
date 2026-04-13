import { useState, useMemo } from 'react'
import { STAGES, STAGE_COLORS, THEMES, OWNER_COLORS } from '../constants'

const COLS = [
  { key: 'company_name', label: 'Company' },
  { key: 'stage',        label: 'Stage' },
  { key: 'theme',        label: 'Theme' },
  { key: 'sector',       label: 'Sector' },
  { key: 'ev',           label: 'EV (€m)' },
  { key: 'country',      label: 'Country' },
  { key: 'owner',        label: 'Owner' },
]

function StageBadge({ stage }) {
  const sc = STAGE_COLORS[stage] || STAGE_COLORS.Lost
  return (
    <span className="stage-badge" style={{ background: sc.bg, color: sc.color }}>
      {stage}
    </span>
  )
}

function ThemeBadge({ theme }) {
  if (!theme) return <span style={{ color: 'var(--text-light)' }}>—</span>
  const meta = THEMES.find(t => t.value === theme)
  if (!meta) return <span>{theme}</span>
  return (
    <span className="theme-pill" style={{ background: meta.bg, color: meta.color }}>
      <span className="theme-dot" style={{ background: meta.dot }} />
      {theme}
    </span>
  )
}

function OwnerCell({ owner }) {
  if (!owner) return <span style={{ color: 'var(--text-light)' }}>—</span>
  const color = OWNER_COLORS[owner] || '#64748b'
  const initials = owner.slice(0, 2).toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div className="owner-avatar" style={{ background: color, width: 22, height: 22, fontSize: 10 }}>
        {initials}
      </div>
      {owner}
    </div>
  )
}

export default function TableView({ deals, onEditDeal, onDeleteDeal, onViewDeal }) {
  const [sortKey, setSortKey] = useState('company_name')
  const [sortDir, setSortDir] = useState('asc')
  const [stageFilter, setStageFilter] = useState('All')

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let rows = [...deals]
    if (stageFilter !== 'All') rows = rows.filter(d => d.stage === stageFilter)
    rows.sort((a, b) => {
      let va = a[sortKey] ?? ''
      let vb = b[sortKey] ?? ''
      if (sortKey === 'stage') { va = STAGES.indexOf(va); vb = STAGES.indexOf(vb) }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [deals, stageFilter, sortKey, sortDir])

  const arrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const totalEV = filtered.filter(d => d.stage !== 'Lost').reduce((s, d) => s + (d.ev || 0), 0)

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
        >
          <option>All</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {filtered.length} deal{filtered.length !== 1 ? 's' : ''}
          {totalEV > 0 && ` · €${totalEV >= 1000 ? `${(totalEV / 1000).toFixed(1)}B` : `${totalEV.toFixed(0)}m`} EV`}
        </span>
      </div>

      <div className="table-wrapper">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>{deals.length === 0 ? 'No deals yet' : 'No results'}</h3>
            <p>{deals.length === 0 ? 'Click "Add Deal" to get started.' : 'Try adjusting your filters.'}</p>
          </div>
        ) : (
          <table className="deals-table">
            <thead>
              <tr>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    className={sortKey === col.key ? 'sorted' : ''}
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.label}
                    <span className="sort-icon">{arrow(col.key)}</span>
                  </th>
                ))}
                <th>Notes</th>
                <th style={{ width: 110 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(deal => (
                <tr key={deal.id}>
                  <td>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: onViewDeal ? 'pointer' : 'default' }}
                      onClick={() => onViewDeal && onViewDeal(deal)}
                    >
                      {deal.domain ? (
                        <img
                          src={`https://logo.clearbit.com/${deal.domain}`}
                          alt=""
                          className="table-logo"
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      ) : null}
                      <span style={{ fontWeight: 600 }}>{deal.company_name}</span>
                    </div>
                  </td>
                  <td><StageBadge stage={deal.stage} /></td>
                  <td><ThemeBadge theme={deal.theme} /></td>
                  <td>{deal.sector || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                  <td>
                    {deal.ev != null
                      ? <span style={{ fontWeight: 600, color: '#16a34a' }}>€{deal.ev}m</span>
                      : <span style={{ color: 'var(--text-light)' }}>—</span>
                    }
                  </td>
                  <td>{deal.country || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                  <td><OwnerCell owner={deal.owner} /></td>
                  <td style={{ maxWidth: 180 }}>
                    {deal.notes
                      ? <span style={{ color: 'var(--text-muted)', fontSize: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{deal.notes}</span>
                      : <span style={{ color: 'var(--text-light)' }}>—</span>
                    }
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => onEditDeal(deal)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDeleteDeal(deal.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
