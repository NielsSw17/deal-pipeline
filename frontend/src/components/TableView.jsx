import { useState, useMemo } from 'react'

const STAGES = ['Sourcing', 'Screening', 'IC', 'Due Diligence', 'Signed', 'Closed', 'Lost']

const STAGE_COLORS = {
  Sourcing: { bg: '#eff6ff', color: '#3b82f6' },
  Screening: { bg: '#f5f3ff', color: '#8b5cf6' },
  IC: { bg: '#fffbeb', color: '#f59e0b' },
  'Due Diligence': { bg: '#fff7ed', color: '#f97316' },
  Signed: { bg: '#ecfeff', color: '#06b6d4' },
  Closed: { bg: '#f0fdf4', color: '#10b981' },
  Lost: { bg: '#f8fafc', color: '#94a3b8' },
}

const COLS = [
  { key: 'company_name', label: 'Company' },
  { key: 'stage', label: 'Stage' },
  { key: 'sector', label: 'Sector' },
  { key: 'ev', label: 'EV (€m)' },
  { key: 'country', label: 'Country' },
  { key: 'owner', label: 'Owner' },
]

export default function TableView({ deals, onEditDeal, onDeleteDeal }) {
  const [sortKey, setSortKey] = useState('company_name')
  const [sortDir, setSortDir] = useState('asc')
  const [stageFilter, setStageFilter] = useState('All')
  const [search, setSearch] = useState('')

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let rows = [...deals]
    if (stageFilter !== 'All') rows = rows.filter(d => d.stage === stageFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(d =>
        d.company_name?.toLowerCase().includes(q) ||
        d.sector?.toLowerCase().includes(q) ||
        d.country?.toLowerCase().includes(q) ||
        d.owner?.toLowerCase().includes(q)
      )
    }
    rows.sort((a, b) => {
      let va = a[sortKey] ?? ''
      let vb = b[sortKey] ?? ''
      if (sortKey === 'stage') {
        va = STAGES.indexOf(va)
        vb = STAGES.indexOf(vb)
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return rows
  }, [deals, stageFilter, search, sortKey, sortDir])

  const arrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ maxWidth: 240 }}
          placeholder="Search deals…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(deal => {
                const sc = STAGE_COLORS[deal.stage] || STAGE_COLORS.Lost
                return (
                  <tr key={deal.id}>
                    <td style={{ fontWeight: 600 }}>{deal.company_name}</td>
                    <td>
                      <span
                        className="stage-badge"
                        style={{ background: sc.bg, color: sc.color }}
                      >
                        {deal.stage}
                      </span>
                    </td>
                    <td>{deal.sector || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                    <td>
                      {deal.ev != null
                        ? <span style={{ fontWeight: 600, color: '#16a34a' }}>€{deal.ev}m</span>
                        : <span style={{ color: 'var(--text-light)' }}>—</span>
                      }
                    </td>
                    <td>{deal.country || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                    <td>{deal.owner || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                    <td style={{ maxWidth: 200 }}>
                      {deal.notes
                        ? <span style={{ color: 'var(--text-muted)', fontSize: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{deal.notes}</span>
                        : <span style={{ color: 'var(--text-light)' }}>—</span>
                      }
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => onEditDeal(deal)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => onDeleteDeal(deal.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
