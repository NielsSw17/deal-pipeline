import { useState, useEffect, useCallback } from 'react'
import { api } from './api'
import KanbanBoard from './components/KanbanBoard'
import TableView from './components/TableView'
import DealModal from './components/DealModal'
import StatsBar from './components/StatsBar'

let toastId = 0

export default function App() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban') // 'kanban' | 'table'
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState(null)
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((msg, type = 'info') => {
    const id = ++toastId
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  const loadDeals = useCallback(async () => {
    try {
      const data = await api.getDeals()
      setDeals(data)
    } catch (e) {
      showToast('Failed to load deals', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadDeals() }, [loadDeals])

  const handleCreate = async (data) => {
    try {
      const deal = await api.createDeal(data)
      setDeals(d => [...d, deal])
      showToast(`${deal.company_name} added`)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleUpdate = async (id, data) => {
    try {
      const deal = await api.updateDeal(id, data)
      setDeals(d => d.map(x => x.id === id ? deal : x))
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    const deal = deals.find(d => d.id === id)
    if (!window.confirm(`Delete "${deal?.company_name}"?`)) return
    try {
      await api.deleteDeal(id)
      setDeals(d => d.filter(x => x.id !== id))
      showToast('Deal deleted')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleDragMove = useCallback(async (dealId, newStage) => {
    // Optimistic update
    setDeals(d => d.map(x => x.id === dealId ? { ...x, stage: newStage } : x))
    try {
      await api.updateDeal(dealId, { stage: newStage })
    } catch (e) {
      showToast(e.message, 'error')
      loadDeals() // revert
    }
  }, [showToast, loadDeals])

  const openAdd = () => { setEditingDeal(null); setModalOpen(true) }
  const openEdit = (deal) => { setEditingDeal(deal); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditingDeal(null) }

  const handleSave = async (data) => {
    if (editingDeal) {
      await handleUpdate(editingDeal.id, data)
    } else {
      await handleCreate(data)
    }
    closeModal()
  }

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="navbar-logo-icon">D</div>
          DealFlow
        </div>
        <div className="navbar-spacer" />
        <div className="view-toggle">
          <button
            className={view === 'kanban' ? 'active' : ''}
            onClick={() => setView('kanban')}
          >
            ▦ Board
          </button>
          <button
            className={view === 'table' ? 'active' : ''}
            onClick={() => setView('table')}
          >
            ☰ Table
          </button>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + Add Deal
        </button>
      </nav>

      {/* Stats bar */}
      <StatsBar deals={deals} />

      {/* Main content */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading pipeline…</span>
        </div>
      ) : view === 'kanban' ? (
        <div className="board-container">
          <KanbanBoard
            deals={deals}
            onUpdateDeal={handleDragMove}
            onEditDeal={openEdit}
            onDeleteDeal={handleDelete}
          />
        </div>
      ) : (
        <div className="table-container">
          <TableView
            deals={deals}
            onEditDeal={openEdit}
            onDeleteDeal={handleDelete}
          />
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <DealModal
          deal={editingDeal}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </>
  )
}
