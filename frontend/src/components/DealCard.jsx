import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { OWNER_COLORS, THEMES } from '../constants'

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

function OwnerAvatar({ owner }) {
  if (!owner) return null
  const color = OWNER_COLORS[owner] || '#64748b'
  const initials = owner.slice(0, 2).toUpperCase()
  return (
    <div
      className="owner-avatar"
      style={{ background: color }}
      title={owner}
    >
      {initials}
    </div>
  )
}

function ThemePill({ theme }) {
  if (!theme) return null
  const meta = THEMES.find(t => t.value === theme)
  if (!meta) return null
  return (
    <span
      className="theme-pill"
      style={{ background: meta.bg, color: meta.color }}
    >
      <span className="theme-dot" style={{ background: meta.dot }} />
      {theme}
    </span>
  )
}

export default function DealCard({ deal, onEdit, onDelete, isOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled: isOverlay,
  })

  const style = !isOverlay && transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const stopAndEdit   = (e) => { e.stopPropagation(); onEdit(deal) }
  const stopAndDelete = (e) => { e.stopPropagation(); onDelete(deal.id) }

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className={[
        'deal-card',
        isDragging && !isOverlay ? 'is-dragging' : '',
        isOverlay ? 'is-overlay' : '',
      ].filter(Boolean).join(' ')}
      {...(isOverlay ? {} : { ...listeners, ...attributes })}
    >
      {/* Top row: logo + name/sector */}
      <div className="card-top">
        <CompanyLogo domain={deal.domain} name={deal.company_name} />
        <div className="card-name-wrap">
          <div className="card-name">{deal.company_name}</div>
          {deal.sector && <div className="card-sector">{deal.sector}</div>}
        </div>
      </div>

      {/* Tags: EV + country */}
      {(deal.ev != null || deal.country) && (
        <div className="card-meta">
          {deal.ev != null && (
            <span className="card-tag ev">€{deal.ev}m</span>
          )}
          {deal.country && (
            <span className="card-tag">{deal.country}</span>
          )}
        </div>
      )}

      {/* Theme pill */}
      {deal.theme && <ThemePill theme={deal.theme} />}

      {/* Footer: owner avatar + actions */}
      <div className="card-footer">
        <OwnerAvatar owner={deal.owner} />
        {deal.owner && <span className="card-owner-name">{deal.owner}</span>}
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
