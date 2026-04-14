import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { OWNER_COLORS, THEMES, SOURCING_OPTIONS, CRITERIA, parseSectors, getSectorMeta } from '../constants'

function CompanyLogo({ domain, name }) {
  const [failed, setFailed] = useState(false)
  const initials = name
    ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?'

  if (domain && !failed) {
    return (
      <img
        className="card-logo"
        src={`https://logo.clearbit.com/${domain}`}
        alt={name}
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <div className="card-logo-fallback">
      {initials}
    </div>
  )
}

function OwnerAvatars({ owners, owner }) {
  // Parse multi-owner or fall back to single owner
  const list = owners
    ? owners.split(',').map(o => o.trim()).filter(Boolean)
    : owner
    ? [owner]
    : []

  if (list.length === 0) return null

  return (
    <div className="card-avatars">
      {list.slice(0, 3).map(o => {
        const color = OWNER_COLORS[o] || '#64748b'
        return (
          <div
            key={o}
            className="owner-avatar owner-avatar-sm"
            style={{ background: color }}
            title={o}
          >
            {o.slice(0, 2).toUpperCase()}
          </div>
        )
      })}
      {list.length > 3 && (
        <div className="owner-avatar owner-avatar-sm owner-avatar-more" title={list.slice(3).join(', ')}>
          +{list.length - 3}
        </div>
      )}
    </div>
  )
}

function SourcingBadge({ sourcing }) {
  if (!sourcing) return null
  const opt = SOURCING_OPTIONS.find(o => o.value === sourcing)
  if (!opt) return (
    <span className="sourcing-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>{sourcing}</span>
  )
  return (
    <span className="sourcing-badge" style={{ background: opt.bg, color: opt.color }}>
      {sourcing}
    </span>
  )
}

function ThemePill({ theme }) {
  if (!theme) return null
  const meta = THEMES.find(t => t.value === theme)
  if (!meta) return null
  return (
    <span className="theme-pill" style={{ background: meta.bg, color: meta.color }}>
      <span className="theme-dot" style={{ background: meta.dot }} />
      {theme}
    </span>
  )
}

function SectorPills({ sectors, theme }) {
  const list = parseSectors(sectors)
  if (list.length > 0) {
    return (
      <>
        {list.slice(0, 2).map(s => {
          const meta = getSectorMeta(s)
          return (
            <span key={s} className="sector-pill sector-pill-sm" style={{ background: meta.bg, color: meta.color }}>
              {s}
            </span>
          )
        })}
        {list.length > 2 && (
          <span className="sector-pill sector-pill-sm" style={{ background: '#f1f5f9', color: '#64748b' }}>
            +{list.length - 2}
          </span>
        )}
      </>
    )
  }
  // Fall back to legacy theme pill
  if (theme) return <ThemePill theme={theme} />
  return null
}

function CriteriaScore({ deal }) {
  const score = CRITERIA.filter(c => deal[c.key]).length
  if (score === 0) return null
  const allMet = score === CRITERIA.length
  return (
    <span
      className={`criteria-score-badge${allMet ? ' all-met' : ''}`}
      title={`${score}/${CRITERIA.length} investment criteria met`}
    >
      {score}/{CRITERIA.length}
    </span>
  )
}

export default function DealCard({ deal, onEdit, onDelete, onView, isOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled: isOverlay,
  })

  const style = !isOverlay && transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const stopAndEdit   = (e) => { e.stopPropagation(); onEdit(deal) }
  const stopAndDelete = (e) => { e.stopPropagation(); onDelete(deal.id) }
  const handleClick   = () => { if (!isDragging && onView) onView(deal) }

  const isOverdue = deal.next_action_due && new Date(deal.next_action_due) < new Date()

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className={[
        'deal-card',
        isDragging && !isOverlay ? 'is-dragging' : '',
        isOverlay ? 'is-overlay' : '',
      ].filter(Boolean).join(' ')}
      onClick={isOverlay ? undefined : handleClick}
      {...(isOverlay ? {} : { ...listeners, ...attributes })}
    >
      {/* Top row: logo + name + criteria score */}
      <div className="card-top">
        <CompanyLogo domain={deal.domain} name={deal.company_name} />
        <div className="card-name-wrap">
          <div className="card-name">{deal.company_name}</div>
        </div>
        <CriteriaScore deal={deal} />
      </div>

      {/* Sourcing badge */}
      {deal.sourcing && (
        <div className="card-sourcing-row">
          <SourcingBadge sourcing={deal.sourcing} />
        </div>
      )}

      {/* Sector pills + EV */}
      <div className="card-pills-row">
        <SectorPills sectors={deal.sectors} theme={deal.theme} />
        {(deal.ev_range || deal.ev != null) && (
          <span className="card-tag ev">
            {deal.ev_range ? `€${deal.ev_range}m` : `€${deal.ev}m`}
          </span>
        )}
      </div>

      {/* Last contact */}
      {deal.last_contact_at && (
        <div className="card-last-contact">
          <span className="card-last-contact-dot" />
          {new Date(deal.last_contact_at + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      )}

      {/* Next action */}
      {(deal.next_action || deal.next_action_due) && (
        <div className={`card-next-action${isOverdue ? ' overdue' : ''}`}>
          <span className="card-next-action-text">
            {isOverdue ? '⚠ ' : '→ '}
            {deal.next_action || 'Follow up'}
          </span>
          {deal.next_action_due && (
            <span className="card-next-action-due">
              {new Date(deal.next_action_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      )}

      {/* Footer: owner avatars + actions */}
      <div className="card-footer">
        <OwnerAvatars owners={deal.owners} owner={deal.owner} />
        {!isOverlay && (
          <div className="card-actions">
            <button className="card-action-btn edit" onClick={stopAndEdit}>Edit</button>
            <button className="card-action-btn delete" onClick={stopAndDelete}>Del</button>
          </div>
        )}
      </div>
    </div>
  )
}
