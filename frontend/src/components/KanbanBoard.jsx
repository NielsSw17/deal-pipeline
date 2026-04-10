import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import KanbanColumn from './KanbanColumn'
import DealCard from './DealCard'

const STAGES = ['Sourcing', 'Screening', 'IC', 'Due Diligence', 'Signed', 'Closed', 'Lost']

export default function KanbanBoard({ deals, onUpdateDeal, onEditDeal, onDeleteDeal }) {
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const activeDeal = activeId != null ? deals.find(d => d.id === activeId) : null

  // Group deals by stage, sorted by position
  const dealsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = deals
      .filter(d => d.stage === stage)
      .sort((a, b) => a.position - b.position)
    return acc
  }, {})

  // Given an id, determine if it's a stage name or a deal id and return the stage
  const resolveStage = useCallback((id) => {
    if (STAGES.includes(id)) return id
    const deal = deals.find(d => d.id === id)
    return deal?.stage ?? null
  }, [deals])

  const handleDragStart = ({ active }) => setActiveId(active.id)

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return

    const currentStage = deals.find(d => d.id === active.id)?.stage
    const targetStage = resolveStage(over.id)

    if (!targetStage || currentStage === targetStage) return
    onUpdateDeal(active.id, targetStage)
  }

  const handleDragCancel = () => setActiveId(null)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="kanban-board">
        {STAGES.map(stage => (
          <KanbanColumn
            key={stage}
            stage={stage}
            deals={dealsByStage[stage]}
            onEditDeal={onEditDeal}
            onDeleteDeal={onDeleteDeal}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
        {activeDeal && <DealCard deal={activeDeal} isOverlay />}
      </DragOverlay>
    </DndContext>
  )
}
