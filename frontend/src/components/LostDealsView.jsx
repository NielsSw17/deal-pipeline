import { STAGE_COLORS, OWNER_COLORS } from '../constants'

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function OwnerDot({ owner }) {
  if (!owner) return null
  const color = OWNER_COLORS[owner] || '#64748b'
  return (
    <div className="owner-avatar" style={{ background: color, width: 20, height: 20, fontSize: 9 }}>
      {owner.slice(0, 2).toUpperCase()}
    </div>
  )
}

export default function LostDealsView({ deals, onReactivate, onViewDeal }) {
  const lost = [...deals].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))

  if (lost.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <div className="empty-state-icon">✓</div>
        <h3>No lost deals</h3>
        <p>All tracked deals are still active.</p>
      </div>
    )
  }

  return (
    <div className="lost-view">
      <div className="lost-view-header">
        <span className="lost-view-count">{lost.length} lost deal{lost.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="table-wrapper">
        <table className="deals-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Lost Reason</th>
              <th>Last Stage</th>
              <th>Owner</th>
              <th>EV (€m)</th>
              <th>Lost</th>
              <th style={{ width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {lost.map(deal => (
              <tr key={deal.id} className="lost-row">
                <td>
                  <span
                    className="lost-company-link"
                    onClick={() => onViewDeal && onViewDeal(deal)}
                  >
                    {deal.domain && (
                      <img
                        src={`https://logo.clearbit.com/${deal.domain}`}
                        alt=""
                        className="table-logo"
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    )}
                    {deal.company_name}
                  </span>
                </td>
                <td>
                  {deal.lost_reason
                    ? <span className="lost-reason-tag">{deal.lost_reason}</span>
                    : <span style={{ color: 'var(--text-light)' }}>—</span>
                  }
                </td>
                <td>
                  <span className="stage-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                    {deal.stage}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <OwnerDot owner={deal.owner} />
                    {deal.owner || <span style={{ color: 'var(--text-light)' }}>—</span>}
                  </div>
                </td>
                <td>
                  {deal.ev != null
                    ? <span style={{ fontWeight: 600, color: '#64748b' }}>€{deal.ev}m</span>
                    : <span style={{ color: 'var(--text-light)' }}>—</span>
                  }
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {fmtDate(deal.updated_at || deal.created_at)}
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onReactivate(deal)}
                      title="Move back to Sourcing"
                    >
                      ↩ Reactivate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
