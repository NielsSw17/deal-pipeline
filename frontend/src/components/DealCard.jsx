import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

export default function DealCard({ deal, onEdit, onDelete, isOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled: isOverlay,
  })

  const style = !isOverlay && transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const stopAndEdit = (e) => { e.stopPropagation(); onEdit(deal) }
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
      <div className="card-name">{deal.company_name}</div>

      <div className="card-meta">
        {deal.sector && <span className="card-tag">{deal.sector}</span>}
        {deal.country && <span className="card-tag">{deal.country}</span>}
        {deal.ev != null && (
          <span className="card-tag ev">€{deal.ev}m</span>
        )}
      </div>

      <div className="card-footer">
        <span className="card-owner">{deal.owner || ''}</span>
        {!isOverlay && (
          <div className="card-actions">
            <button className="card-action-btn edit" onClick={stopAndEdit}>Edit</button>
            <button className="card-action-btn delete" onClick={stopAndDelete}>Delete</button>
          </div>
        )}
      </div>
    </div>
  )
}
