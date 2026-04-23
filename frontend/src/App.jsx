import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from './api'
import { TEAM, THEMES, STAGE_ORDER, STAGE_GATES } from './constants'
import { exportPipelineToExcel, exportDealToPDF } from './utils/export'
import { useAuth } from './contexts/AuthContext'
import KanbanBoard from './components/KanbanBoard'
import TableView from './components/TableView'
import DealModal from './components/DealModal'
import DealDetailPanel from './components/DealDetailPanel'
import StageGateModal from './components/StageGateModal'
import LostModal from './components/LostModal'
import LostDealsView from './components/LostDealsView'
import AnalyticsPage from './components/AnalyticsPage'
import StatsBar from './components/StatsBar'
import DTELogo from './components/DTELogo'
import ImportModal from './components/ImportModal'
import CorrespondencePanel from './components/CorrespondencePanel'
import PostponeModal from './components/PostponeModal'
import AlertBanner from './components/AlertBanner'
import LoginPage from './components/LoginPage'
import SettingsPage from './components/SettingsPage'

let toastId = 0

export default function App() {
  const { user, loading: authLoading, logout } = useAuth()

  const [deals, setDeals]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState('kanban') // kanban | table | analytics | lost | settings
  const [modalOpen, setModalOpen]     = useState(false)
  const [editingDeal, setEditingDeal] = useState(null)
  const [toasts, setToasts]           = useState([])

  // Detail panel
  const [detailDeal, setDetailDeal] = useState(null)

  // Stage gate
  const [pendingGate, setPendingGate] = useState(null) // { dealId, fromStage, toStage }

  // Lost modal
  const [pendingLost, setPendingLost] = useState(null) // { dealId, fromStage }

  // Postpone modal
  const [pendingPostpone, setPendingPostpone] = useState(null) // { dealId, fromStage }

  // Export dropdown
  const [exportOpen, setExportOpen]   = useState(false)
  const exportRef = useRef(null)

  // Import modal
  const [importOpen, setImportOpen]   = useState(false)

  // Correspondence timeline panel
  const [timelineDeal, setTimelineDeal] = useState(null)

  // Global filters (apply only to kanban/table)
  const [search, setSearch]           = useState('')
  const [ownerFilter, setOwnerFilter] = useState('All')
  const [themeFilter, setThemeFilter] = useState('All')

  const isAdmin = user?.role === 'admin'

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

  useEffect(() => {
    if (user) loadDeals()
    else setLoading(false)
  }, [user, loadDeals])

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
      setDetailDeal(prev => prev?.id === id ? deal : prev)
      return deal
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!isAdmin) { showToast('Only admins can delete deals', 'error'); return }
    const deal = deals.find(d => d.id === id)
    if (!window.confirm(`Delete "${deal?.company_name}"?`)) return
    try {
      await api.deleteDeal(id)
      setDeals(d => d.filter(x => x.id !== id))
      if (detailDeal?.id === id) setDetailDeal(null)
      showToast('Deal deleted')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // Stage gate + lost interception
  const handleDragMove = useCallback(async (dealId, newStage) => {
    const deal = deals.find(d => d.id === dealId)
    if (!deal) return

    // Moving to Lost — capture reason
    if (newStage === 'Lost') {
      setPendingLost({ dealId, fromStage: deal.stage })
      return
    }

    // Moving to Postponed — capture reason
    if (newStage === 'Postponed') {
      setPendingPostpone({ dealId, fromStage: deal.stage })
      return
    }

    const fromIdx = STAGE_ORDER.indexOf(deal.stage)
    const toIdx   = STAGE_ORDER.indexOf(newStage)
    const gateKey = `${deal.stage}→${newStage}`

    // Forward single-step gate
    if (toIdx === fromIdx + 1 && STAGE_GATES[gateKey]) {
      setPendingGate({ dealId, fromStage: deal.stage, toStage: newStage })
      return
    }

    // No gate — optimistic move
    setDeals(d => d.map(x => x.id === dealId ? { ...x, stage: newStage } : x))
    try {
      await api.updateDeal(dealId, { stage: newStage })
    } catch (e) {
      showToast(e.message, 'error')
      loadDeals()
    }
  }, [deals, showToast, loadDeals])

  const handleGateConfirm = async (payload) => {
    if (!pendingGate) return
    const { dealId, toStage } = pendingGate
    setPendingGate(null)
    const updated = await handleUpdate(dealId, { ...payload, stage: toStage })
    if (updated) showToast(`Moved to ${toStage}`)
  }
  const handleGateCancel = () => setPendingGate(null)

  const handleLostConfirm = async ({ reason, note }) => {
    if (!pendingLost) return
    const { dealId } = pendingLost
    setPendingLost(null)
    const updated = await handleUpdate(dealId, { stage: 'Lost', lost_reason: reason, lost_note: note || null })
    if (updated) showToast('Deal marked as lost')
  }
  const handleLostCancel = () => setPendingLost(null)

  const handlePostponeConfirm = async ({ reason, notes }) => {
    if (!pendingPostpone) return
    const { dealId } = pendingPostpone
    setPendingPostpone(null)
    const updated = await handleUpdate(dealId, { stage: 'Postponed', postpone_reason: reason, postpone_notes: notes || null })
    if (updated) showToast('Deal postponed')
  }
  const handlePostponeCancel = () => setPendingPostpone(null)

  // Reactivate a lost deal — move back to Sourcing
  const handleReactivate = async (deal) => {
    if (!window.confirm(`Reactivate "${deal.company_name}" back to Sourcing?`)) return
    const updated = await handleUpdate(deal.id, { stage: 'Sourcing', lost_reason: null })
    if (updated) { showToast(`${deal.company_name} reactivated`); setView('kanban') }
  }

  const openAdd  = () => { setEditingDeal(null); setModalOpen(true) }
  const openEdit = (deal) => { setDetailDeal(null); setEditingDeal(deal); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditingDeal(null) }

  const handleSave = async (data) => {
    if (editingDeal) await handleUpdate(editingDeal.id, data)
    else await handleCreate(data)
    closeModal()
  }

  const openDetail  = (deal) => setDetailDeal(deal)
  const closeDetail = () => setDetailDeal(null)

  // Apply global filters (only for kanban/table)
  const filteredDeals = useMemo(() => {
    let rows = deals.filter(d => d.stage !== 'Lost')
    if (ownerFilter !== 'All') rows = rows.filter(d => {
      if (d.owners) return d.owners.split(',').map(o => o.trim()).includes(ownerFilter)
      return d.owner === ownerFilter
    })
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

  const lostDeals  = useMemo(() => deals.filter(d => d.stage === 'Lost'), [deals])
  const hasFilters = ownerFilter !== 'All' || themeFilter !== 'All' || search.trim()

  const gatingDeal = pendingGate ? deals.find(d => d.id === pendingGate.dealId) : null
  const lostingDeal = pendingLost ? deals.find(d => d.id === pendingLost.dealId) : null

  const showFilters = view === 'kanban' || view === 'table'

  // Show a spinner while checking auth
  if (authLoading) {
    return <div className="loading-state"><div className="spinner" /><span>Loading…</span></div>
  }

  // Show login page if not authenticated
  if (!user) return <LoginPage />

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

        {/* Global filters — only in board/table view */}
        {showFilters && (
          <div className="navbar-filters">
            <div className="search-wrap">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
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
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setOwnerFilter('All'); setThemeFilter('All') }}>
                Clear
              </button>
            )}
          </div>
        )}

        {/* View switcher */}
        <div className="view-toggle">
          <button className={view === 'kanban'    ? 'active' : ''} onClick={() => setView('kanban')}>▦ Board</button>
          <button className={view === 'table'     ? 'active' : ''} onClick={() => setView('table')}>☰ Table</button>
          <button className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')}>📊 Analytics</button>
          <button
            className={view === 'lost' ? 'active lost-tab' : 'lost-tab'}
            onClick={() => setView('lost')}
          >
            Lost{lostDeals.length > 0 && <span className="lost-count-badge">{lostDeals.length}</span>}
          </button>
          {isAdmin && (
            <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>⚙ Settings</button>
          )}
        </div>

        {/* Export dropdown */}
        <div className="export-wrap" ref={exportRef}>
          <button className="btn btn-ghost btn-sm export-btn" onClick={() => setExportOpen(o => !o)}>
            Export ↓
          </button>
          {exportOpen && (
            <div className="export-dropdown">
              <button
                className="export-option"
                onClick={() => { exportPipelineToExcel(deals); setExportOpen(false) }}
              >
                📊 Export to Excel (.xlsx)
              </button>
              {detailDeal && (
                <button
                  className="export-option"
                  onClick={async () => {
                    setExportOpen(false)
                    const [n, c] = await Promise.all([api.getNotes(detailDeal.id), api.getContacts(detailDeal.id)])
                    exportDealToPDF(detailDeal, n, c)
                  }}
                >
                  📄 Export deal as PDF
                </button>
              )}
            </div>
          )}
        </div>

        {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>↑ Import</button>}
        <button className="btn btn-primary" onClick={openAdd}>+ Add Deal</button>

        {/* User badge + logout */}
        <div className="user-menu">
          <span className="user-name">{user.full_name}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
        </div>
      </nav>

      {/* ── Alert banner (overdue next actions) ── */}
      <AlertBanner onViewDeal={openDetail} />

      {/* ── Stats bar (hide in analytics/lost/settings) ── */}
      {(view === 'kanban' || view === 'table') && <StatsBar deals={deals} />}

      {/* ── Main content ── */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading pipeline…</span></div>
      ) : view === 'kanban' ? (
        <div className="board-container">
          <KanbanBoard
            deals={filteredDeals}
            onUpdateDeal={handleDragMove}
            onEditDeal={openEdit}
            onDeleteDeal={isAdmin ? handleDelete : null}
            onViewDeal={openDetail}
          />
        </div>
      ) : view === 'table' ? (
        <div className="table-container">
          <TableView
            deals={filteredDeals}
            onEditDeal={openEdit}
            onDeleteDeal={isAdmin ? handleDelete : null}
            onViewDeal={openDetail}
          />
        </div>
      ) : view === 'analytics' ? (
        <div className="analytics-container">
          <AnalyticsPage />
        </div>
      ) : view === 'settings' ? (
        <div className="settings-container">
          <SettingsPage />
        </div>
      ) : (
        <div className="table-container">
          <LostDealsView
            deals={lostDeals}
            onReactivate={handleReactivate}
            onViewDeal={openDetail}
          />
        </div>
      )}

      {/* ── Import modal ── */}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={loadDeals}
        />
      )}

      {/* ── Edit modal ── */}
      {modalOpen && <DealModal deal={editingDeal} onSave={handleSave} onClose={closeModal} />}

      {/* ── Stage gate modal ── */}
      {pendingGate && gatingDeal && (
        <StageGateModal
          deal={gatingDeal}
          fromStage={pendingGate.fromStage}
          toStage={pendingGate.toStage}
          onConfirm={handleGateConfirm}
          onCancel={handleGateCancel}
        />
      )}

      {/* ── Lost modal ── */}
      {pendingLost && lostingDeal && (
        <LostModal
          deal={lostingDeal}
          onConfirm={handleLostConfirm}
          onCancel={handleLostCancel}
        />
      )}

      {/* ── Postpone modal ── */}
      {pendingPostpone && (() => {
        const postponingDeal = deals.find(d => d.id === pendingPostpone.dealId)
        return postponingDeal ? (
          <PostponeModal
            deal={postponingDeal}
            onConfirm={handlePostponeConfirm}
            onCancel={handlePostponeCancel}
          />
        ) : null
      })()}

      {/* ── Detail panel ── */}
      {detailDeal && (
        <DealDetailPanel
          deal={detailDeal}
          onClose={closeDetail}
          onEdit={openEdit}
          onUpdate={handleUpdate}
          onOpenTimeline={(deal) => setTimelineDeal(deal)}
        />
      )}

      {/* ── Correspondence timeline panel ── */}
      {timelineDeal && (
        <CorrespondencePanel
          deal={timelineDeal}
          onClose={() => setTimelineDeal(null)}
          onContactUpdated={(date) => {
            handleUpdate(timelineDeal.id, { last_contact_at: date })
          }}
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
