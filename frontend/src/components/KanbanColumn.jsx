import { useDroppable } from '@dnd-kit/core'
import DealCard from './DealCard'

const STAGE_COLORS = {
  Sourcing: '#3b82f6',
  Screening: '#8b5cf6',
  IC: '#f59e0b',
  'Due Diligence': '#f97316',
  Signed: '#06b6d4',
  Closed: '#10b981',
  Lost: '#94a3b8',
}

export default function KanbanColumn({ stage, deals, onEditDeal, onDeleteDeal }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  const totalEV = deals.reduce((s, d) => s + (d.ev || 0), 0)

  return (
    <div className={`kanban-column${isOver ? ' is-over' : ''}`}>
      <div className="column-header">
        <div
          className="column-color-bar"
          style={{ background: STAGE_COLORS[stage] || '#94a3b8' }}
        />
        <span className="column-name">{stage}</span>
        <span className="column-count">{deals.length}</span>
      </div>

      {totalEV > 0 && (
        <div className="column-ev">
          €{totalEV >= 1000 ? `${(totalEV / 1000).toFixed(1)}B` : `${totalEV.toFixed(0)}m`}
        </div>
      )}

      <div ref={setNodeRef} className="column-cards">
        {deals.map(deal => (
          <DealCard
            key={deal.id}
            deal={deal}
            onEdit={onEditDeal}
            onDelete={onDeleteDeal}
          />
        ))}
      </div>
    </div>
  )
}
