import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { TEAM, OWNER_COLORS, THEMES, STAGE_COLORS } from '../constants'

function fmt(val, suffix = '') {
  return val != null && val !== '' ? `${val}${suffix}` : '—'
}

function fmtDate(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function OwnerAvatar({ owner, size = 28 }) {
  if (!owner) return null
  const color = OWNER_COLORS[owner] || '#64748b'
  return (
    <div className="owner-avatar" style={{ background: color, width: size, height: size, fontSize: size * 0.4 }} title={owner}>
      {owner.slice(0, 2).toUpperCase()}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="detail-field">
      <span className="detail-field-label">{label}</span>
      <span className="detail-field-value">{value || '—'}</span>
    </div>
  )
}

export default function DealDetailPanel({ deal, onClose, onEdit }) {
  const [notes, setNotes]       = useState([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [noteAuthor, setNoteAuthor] = useState(TEAM[0])
  const [notePin, setNotePin]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editText, setEditText] = useState('')

  const loadNotes = useCallback(async () => {
    setLoadingNotes(true)
    try {
      const data = await api.getNotes(deal.id)
      setNotes(data)
    } finally {
      setLoadingNotes(false)
    }
  }, [deal.id])

  useEffect(() => { loadNotes() }, [loadNotes])

  const handleAddNote = async (e) => {
    e.preventDefault()
    if (!noteText.trim()) return
    setSaving(true)
    try {
      const note = await api.createNote(deal.id, {
        text:      noteText.trim(),
        author:    noteAuthor,
        is_pinned: notePin,
      })
      setNotes(prev => {
        const base = notePin ? prev.map(n => ({ ...n, is_pinned: false })) : prev
        return [...base, note]
      })
      setNoteText('')
      setNotePin(false)
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePin = async (note) => {
    const updated = await api.updateNote(note.id, { is_pinned: !note.is_pinned })
    setNotes(prev =>
      prev.map(n => {
        if (updated.is_pinned && n.id !== note.id) return { ...n, is_pinned: false }
        if (n.id === note.id) return updated
        return n
      })
    )
  }

  const handleDeleteNote = async (noteId) => {
    await api.deleteNote(noteId)
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  const startEdit = (note) => {
    setEditingNoteId(note.id)
    setEditText(note.text)
  }

  const handleSaveEdit = async (noteId) => {
    if (!editText.trim()) return
    const updated = await api.updateNote(noteId, { text: editText.trim() })
    setNotes(prev => prev.map(n => n.id === noteId ? updated : n))
    setEditingNoteId(null)
  }

  const stageColor  = STAGE_COLORS[deal.stage] || {}
  const themeMeta   = THEMES.find(t => t.value === deal.theme)
  const pinnedNote  = notes.find(n => n.is_pinned)
  const chronoNotes = [...notes].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const isOverdue = deal.next_action_due && new Date(deal.next_action_due) < new Date()

  return (
    <div className="detail-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-panel">

        {/* ── Header ─────────────────────────────────── */}
        <div className="detail-header">
          <div className="detail-header-left">
            <span
              className="detail-stage-badge"
              style={{ background: stageColor.bg, color: stageColor.color, borderColor: stageColor.bar }}
            >
              {deal.stage}
            </span>
            <div>
              <h2 className="detail-title">{deal.company_name}</h2>
              {deal.domain && (
                <a className="detail-domain" href={`https://${deal.domain}`} target="_blank" rel="noreferrer">
                  {deal.domain}
                </a>
              )}
            </div>
          </div>
          <div className="detail-header-right">
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(deal)}>Edit</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        {/* ── Pinned thesis ──────────────────────────── */}
        {(pinnedNote || deal.thesis) && (
          <div className="thesis-box">
            <div className="thesis-box-label">Investment Thesis</div>
            <p className="thesis-box-text">{pinnedNote?.text || deal.thesis}</p>
            {pinnedNote && (
              <div className="thesis-box-meta">— {pinnedNote.author}</div>
            )}
          </div>
        )}

        {/* ── Next action ────────────────────────────── */}
        {(deal.next_action || deal.next_action_due) && (
          <div className={`detail-next-action${isOverdue ? ' overdue' : ''}`}>
            <span className="detail-next-action-label">{isOverdue ? '⚠ Overdue' : '→ Next action'}</span>
            <span className="detail-next-action-text">{deal.next_action || '—'}</span>
            {deal.next_action_due && (
              <span className="detail-next-action-due">{fmtDate(deal.next_action_due)}</span>
            )}
          </div>
        )}

        <div className="detail-scroll">

          {/* ── Deal fields ────────────────────────────── */}
          <div className="detail-section">
            <div className="detail-section-title">Overview</div>
            <div className="detail-fields">
              <Field label="Sector"      value={deal.sector} />
              <Field label="Country"     value={deal.country} />
              <Field label="Geography"   value={deal.geography} />
              <Field label="EV (€m)"     value={deal.ev != null ? `€${deal.ev}m` : null} />
              <Field label="Revenue (€m)" value={deal.revenue != null ? `€${deal.revenue}m` : null} />
              <Field label="EBITDA (€m)" value={deal.ebitda != null ? `€${deal.ebitda}m` : null} />
              <Field label="Ownership %" value={deal.ownership_pct != null ? `${deal.ownership_pct}%` : null} />
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-title">Deal Info</div>
            <div className="detail-fields">
              <Field label="Deal source"  value={deal.deal_source} />
              <Field label="Co-investor"  value={deal.co_investor} />
              <div className="detail-field detail-owner-field">
                <span className="detail-field-label">Owner</span>
                <span className="detail-field-value owner-value">
                  {deal.owner ? (
                    <><OwnerAvatar owner={deal.owner} size={20} /> {deal.owner}</>
                  ) : '—'}
                </span>
              </div>
              {deal.theme && (
                <div className="detail-field">
                  <span className="detail-field-label">Theme</span>
                  <span className="detail-field-value">
                    {themeMeta && (
                      <span className="theme-pill" style={{ background: themeMeta.bg, color: themeMeta.color }}>
                        <span className="theme-dot" style={{ background: themeMeta.dot }} />
                        {deal.theme}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {(deal.ic_date || deal.ic_memo || deal.term_sheet || deal.close_date) && (
            <div className="detail-section">
              <div className="detail-section-title">Process Milestones</div>
              <div className="detail-fields">
                <Field label="IC date"    value={fmtDate(deal.ic_date)} />
                <Field label="Close date" value={fmtDate(deal.close_date)} />
                {deal.ic_memo && (
                  <div className="detail-field">
                    <span className="detail-field-label">IC memo</span>
                    <a className="detail-file-link" href={api.uploadUrl(deal.ic_memo)} target="_blank" rel="noreferrer">
                      📄 View
                    </a>
                  </div>
                )}
                {deal.term_sheet && (
                  <div className="detail-field">
                    <span className="detail-field-label">Term sheet</span>
                    <a className="detail-file-link" href={api.uploadUrl(deal.term_sheet)} target="_blank" rel="noreferrer">
                      📄 View
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Notes feed ─────────────────────────────── */}
          <div className="detail-section notes-section">
            <div className="detail-section-title">Notes</div>

            {loadingNotes ? (
              <div className="notes-loading"><div className="spinner" /></div>
            ) : (
              <div className="notes-feed">
                {chronoNotes.length === 0 && (
                  <p className="notes-empty">No notes yet.</p>
                )}
                {chronoNotes.map(note => (
                  <div key={note.id} className={`note-item${note.is_pinned ? ' note-pinned' : ''}`}>
                    <div className="note-header">
                      <OwnerAvatar owner={note.author} size={24} />
                      <span className="note-author">{note.author}</span>
                      <span className="note-time">
                        {note.created_at
                          ? new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : ''}
                      </span>
                      <div className="note-actions">
                        <button
                          className={`note-pin-btn${note.is_pinned ? ' pinned' : ''}`}
                          title={note.is_pinned ? 'Unpin' : 'Pin as thesis'}
                          onClick={() => handleTogglePin(note)}
                        >
                          📌
                        </button>
                        <button className="note-edit-btn" onClick={() => startEdit(note)}>✎</button>
                        <button className="note-del-btn" onClick={() => handleDeleteNote(note.id)}>✕</button>
                      </div>
                    </div>
                    {editingNoteId === note.id ? (
                      <div className="note-edit-wrap">
                        <textarea
                          className="form-textarea"
                          rows={3}
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          autoFocus
                        />
                        <div className="note-edit-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(note.id)}>Save</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingNoteId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p className="note-text">{note.text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add note form */}
            <form className="note-form" onSubmit={handleAddNote}>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Add a note…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
              <div className="note-form-footer">
                <select
                  className="form-select note-author-select"
                  value={noteAuthor}
                  onChange={e => setNoteAuthor(e.target.value)}
                >
                  {TEAM.map(m => <option key={m}>{m}</option>)}
                </select>
                <label className="note-pin-label">
                  <input
                    type="checkbox"
                    checked={notePin}
                    onChange={e => setNotePin(e.target.checked)}
                  />
                  Set as thesis
                </label>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saving || !noteText.trim()}
                >
                  {saving ? 'Saving…' : 'Add note'}
                </button>
              </div>
            </form>
          </div>

        </div>{/* end detail-scroll */}
      </div>
    </div>
  )
}
