import { useDroppable } from '@dnd-kit/core'
import { STAGE_COLORS } from '../constants'
import DealCard from './DealCard'

export default function KanbanColumn({ stage, deals, onEditDeal, onDeleteDeal, onViewDeal }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  const totalEV = deals.reduce((s, d) => s + (d.ev || 0), 0)
  const sc = STAGE_COLORS[stage] || STAGE_COLORS.Lost

  return (
    <div className={`kanban-column${isOver ? ' is-over' : ''}`}>
      <div className="column-header">
        <div className="column-color-bar" style={{ background: sc.bar }} />
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
            onView={onViewDeal}
          />
        ))}
      </div>
    </div>
  )
}
