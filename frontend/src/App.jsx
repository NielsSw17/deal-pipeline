import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from './api'
import { TEAM, THEMES } from './constants'
import KanbanBoard from './components/KanbanBoard'
import TableView from './components/TableView'
import DealModal from './components/DealModal'
import StatsBar from './components/StatsBar'
import DTELogo from './components/DTELogo'

let toastId = 0

export default function App() {
  const [deals, setDeals]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState('kanban')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editingDeal, setEditingDeal] = useState(null)
  const [toasts, setToasts]         = useState([])

  // Global filters (apply to both kanban + table)
  const [search, setSearch]         = useState('')
  const [ownerFilter, setOwnerFilter] = useState('All')
  const [themeFilter, setThemeFilter] = useState('All')

  const showToast = useCallback((msg, type = 'info') => {
    const id = ++toastId
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  const loadDeals = useCallback(async () => {
    try {
      const data = await api.getDeals()
      setDeals(data)
    } catch {
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
    setDeals(d => d.map(x => x.id === dealId ? { ...x, stage: newStage } : x))
    try {
      await api.updateDeal(dealId, { stage: newStage })
    } catch (e) {
      showToast(e.message, 'error')
      loadDeals()
    }
  }, [showToast, loadDeals])

  const openAdd  = () => { setEditingDeal(null); setModalOpen(true) }
  const openEdit = (deal) => { setEditingDeal(deal); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditingDeal(null) }

  const handleSave = async (data) => {
    if (editingDeal) await handleUpdate(editingDeal.id, data)
    else await handleCreate(data)
    closeModal()
  }

  // Apply global filters
  const filteredDeals = useMemo(() => {
    let rows = deals
    if (ownerFilter !== 'All') rows = rows.filter(d => d.owner === ownerFilter)
    if (themeFilter !== 'All') rows = rows.filter(d => d.theme === themeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(d =>
        d.company_name?.toLowerCase().includes(q) ||
        d.sector?.toLowerCase().includes(q) ||
        d.country?.toLowerCase().includes(q) ||
        d.owner?.toLowerCase().includes(q) ||
        d.domain?.toLowerCase().includes(q)
      )
    }
    return rows
  }, [deals, ownerFilter, themeFilter, search])

  const hasFilters = ownerFilter !== 'All' || themeFilter !== 'All' || search.trim()

  return (
    <>
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar-brand">
          <DTELogo height={30} />
          <span className="navbar-divider" />
          <span className="navbar-subtitle">Deal Pipeline</span>
        </div>

        <div className="navbar-spacer" />

        {/* Global filters */}
        <div className="navbar-filters">
          <div className="search-wrap">
            <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              className="form-input search-input"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-select filter-select"
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
          >
            <option value="All">All owners</option>
            {TEAM.map(m => <option key={m}>{m}</option>)}
          </select>

          <select
            className="form-select filter-select"
            value={themeFilter}
            onChange={e => setThemeFilter(e.target.value)}
          >
            <option value="All">All themes</option>
            {THEMES.map(t => <option key={t.value}>{t.value}</option>)}
          </select>

          {hasFilters && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSearch(''); setOwnerFilter('All'); setThemeFilter('All') }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="view-toggle">
          <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>
            ▦ Board
          </button>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            ☰ Table
          </button>
        </div>

        <button className="btn btn-primary" onClick={openAdd}>
          + Add Deal
        </button>
      </nav>

      {/* ── Stats bar ── */}
      <StatsBar deals={deals} />

      {/* ── Main content ── */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading pipeline…</span>
        </div>
      ) : view === 'kanban' ? (
        <div className="board-container">
          <KanbanBoard
            deals={filteredDeals}
            onUpdateDeal={handleDragMove}
            onEditDeal={openEdit}
            onDeleteDeal={handleDelete}
          />
        </div>
      ) : (
        <div className="table-container">
          <TableView
            deals={filteredDeals}
            onEditDeal={openEdit}
            onDeleteDeal={handleDelete}
          />
        </div>
      )}

      {/* ── Modal ── */}
      {modalOpen && (
        <DealModal
          deal={editingDeal}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </>
  )
}
