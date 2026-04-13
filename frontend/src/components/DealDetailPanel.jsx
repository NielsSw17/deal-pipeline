import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'
import { TEAM, OWNER_COLORS, THEMES, STAGE_COLORS, CRITERIA, SOURCING_OPTIONS } from '../constants'
import { exportDealToPDF } from '../utils/export'

// ── Constants ──────────────────────────────────────────────────────────────────
const DOC_CATEGORIES = ['IC Memo', 'Term Sheet', 'NDA', 'Financial Model', 'Management Presentation', 'Other']
const CONTACT_ROLES  = ['Founder', 'CFO', 'Advisor', 'Co-investor', 'Legal', 'Other']
const INTERACTION_TYPES = ['Call', 'Email', 'Meeting']

// ── Helpers ────────────────────────────────────────────────────────────────────
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

function docIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf')  return '📄'
  if (ext === 'xlsx') return '📊'
  if (['doc', 'docx'].includes(ext)) return '📝'
  return '📎'
}

// ── Documents section ──────────────────────────────────────────────────────────
function DocumentsSection({ dealId }) {
  const [docs, setDocs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [uploading, setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [category, setCategory]     = useState('Other')
  const [editingId, setEditingId]   = useState(null)
  const [editCat, setEditCat]       = useState('')
  const fileRef = useRef()

  const load = useCallback(async () => {
    setLoading(true)
    try { setDocs(await api.getDocuments(dealId)) }
    finally { setLoading(false) }
  }, [dealId])

  useEffect(() => { load() }, [load])

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const doc = await api.uploadDocument(dealId, file, category)
      setDocs(prev => [doc, ...prev])
      fileRef.current.value = ''
    } catch (e) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    await api.deleteDocument(id)
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  const startEdit = (doc) => { setEditingId(doc.id); setEditCat(doc.category) }
  const saveEdit = async (id) => {
    const updated = await api.updateDocument(id, { category: editCat })
    setDocs(prev => prev.map(d => d.id === id ? updated : d))
    setEditingId(null)
  }

  return (
    <div className="detail-section">
      <div className="detail-section-title">Documents</div>

      {/* Upload row */}
      <div className="doc-upload-row">
        <select className="form-select doc-cat-select" value={category} onChange={e => setCategory(e.target.value)}>
          {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <label className={`file-upload-btn${uploading ? ' uploading' : ''}`}>
          {uploading ? <><span className="mini-spinner" /> Uploading…</> : <>📎 Choose file</>}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc,.xlsx"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={e => { const f = e.target.files[0]; if (f) handleUpload(f) }}
          />
        </label>
      </div>
      {uploadError && <span className="field-error">{uploadError}</span>}

      {/* List */}
      {loading ? (
        <div className="notes-loading"><div className="spinner" /></div>
      ) : docs.length === 0 ? (
        <p className="notes-empty">No documents yet.</p>
      ) : (
        <div className="doc-list">
          {docs.map(doc => (
            <div key={doc.id} className="doc-item">
              <span className="doc-icon">{docIcon(doc.original_name)}</span>
              <div className="doc-info">
                <a className="doc-name" href={api.uploadUrl(doc.filename)} target="_blank" rel="noreferrer">
                  {doc.original_name}
                </a>
                <div className="doc-meta">
                  {editingId === doc.id ? (
                    <span className="doc-edit-cat">
                      <select className="form-select doc-cat-inline" value={editCat} onChange={e => setEditCat(e.target.value)}>
                        {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <button className="btn btn-primary btn-xs" onClick={() => saveEdit(doc.id)}>Save</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setEditingId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <span className="doc-cat-badge" onClick={() => startEdit(doc)}>{doc.category}</span>
                  )}
                  <span className="doc-date">{fmtDate(doc.uploaded_at)}</span>
                </div>
              </div>
              <button className="note-del-btn" onClick={() => handleDelete(doc.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Contacts section ───────────────────────────────────────────────────────────
function InteractionRow({ interaction, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({ type: interaction.type, date: interaction.date, note: interaction.note || '' })

  const handleSave = async () => {
    await onEdit(interaction.id, form)
    setEditing(false)
  }

  const typeIcon = { Call: '📞', Email: '✉️', Meeting: '🤝' }[interaction.type] || '💬'

  return (
    <div className="interaction-row">
      <span className="interaction-type-icon">{typeIcon}</span>
      {editing ? (
        <div className="interaction-edit-wrap">
          <div className="interaction-edit-row">
            <select className="form-select interaction-type-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {INTERACTION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input className="form-input interaction-date-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <input className="form-input" placeholder="Note (optional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          <div className="note-edit-actions">
            <button className="btn btn-primary btn-xs" onClick={handleSave}>Save</button>
            <button className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="interaction-body">
          <span className="interaction-type">{interaction.type}</span>
          <span className="interaction-date">{fmtDate(interaction.date)}</span>
          {interaction.note && <span className="interaction-note">{interaction.note}</span>}
        </div>
      )}
      {!editing && (
        <div className="note-actions">
          <button className="note-edit-btn" onClick={() => setEditing(true)}>✎</button>
          <button className="note-del-btn" onClick={() => onDelete(interaction.id)}>✕</button>
        </div>
      )}
    </div>
  )
}

function ContactCard({ contact, onDelete, onUpdate }) {
  const [expanded, setExpanded]     = useState(false)
  const [addingInt, setAddingInt]   = useState(false)
  const [intForm, setIntForm]       = useState({ type: 'Call', date: new Date().toISOString().slice(0, 10), note: '' })
  const [editing, setEditing]       = useState(false)
  const [editForm, setEditForm]     = useState({ name: contact.name, role: contact.role || '', email: contact.email || '', phone: contact.phone || '' })
  const [interactions, setInteractions] = useState(contact.interactions || [])

  const handleAddInteraction = async (e) => {
    e.preventDefault()
    const created = await api.createInteraction(contact.id, intForm)
    setInteractions(prev => [created, ...prev])
    setAddingInt(false)
    setIntForm({ type: 'Call', date: new Date().toISOString().slice(0, 10), note: '' })
  }

  const handleDeleteInteraction = async (id) => {
    await api.deleteInteraction(id)
    setInteractions(prev => prev.filter(i => i.id !== id))
  }

  const handleEditInteraction = async (id, data) => {
    const updated = await api.updateInteraction(id, data)
    setInteractions(prev => prev.map(i => i.id === id ? updated : i))
  }

  const handleSaveContact = async () => {
    const updated = await api.updateContact(contact.id, editForm)
    onUpdate(updated)
    setEditing(false)
  }

  const roleColor = {
    Founder:     '#4f46e5',
    CFO:         '#0f766e',
    Advisor:     '#d97706',
    'Co-investor': '#7c3aed',
    Legal:       '#0369a1',
    Other:       '#64748b',
  }[contact.role] || '#64748b'

  return (
    <div className="contact-card">
      <div className="contact-header" onClick={() => setExpanded(e => !e)}>
        <div className="contact-avatar" style={{ background: roleColor }}>
          {contact.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="contact-summary">
          {editing ? (
            <div className="contact-edit-form" onClick={e => e.stopPropagation()}>
              <div className="contact-edit-row">
                <input className="form-input" placeholder="Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                <select className="form-select" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="">— Role —</option>
                  {CONTACT_ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="contact-edit-row">
                <input className="form-input" placeholder="Email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                <input className="form-input" placeholder="Phone" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="note-edit-actions">
                <button className="btn btn-primary btn-xs" onClick={handleSaveContact}>Save</button>
                <button className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <span className="contact-name">{contact.name}</span>
              {contact.role && <span className="contact-role-badge" style={{ color: roleColor }}>{contact.role}</span>}
              {contact.email && <span className="contact-detail-line">✉ {contact.email}</span>}
              {contact.phone && <span className="contact-detail-line">📞 {contact.phone}</span>}
            </>
          )}
        </div>
        {!editing && (
          <div className="contact-header-actions">
            <button className="note-edit-btn" onClick={e => { e.stopPropagation(); setEditing(true) }}>✎</button>
            <button className="note-del-btn" onClick={e => { e.stopPropagation(); onDelete(contact.id) }}>✕</button>
            <span className="contact-chevron">{expanded ? '▲' : '▼'}</span>
          </div>
        )}
      </div>

      {expanded && !editing && (
        <div className="contact-interactions">
          <div className="contact-int-header">
            <span className="contact-int-label">Interactions ({interactions.length})</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setAddingInt(a => !a)}>
              {addingInt ? 'Cancel' : '+ Log'}
            </button>
          </div>

          {addingInt && (
            <form className="interaction-add-form" onSubmit={handleAddInteraction}>
              <div className="interaction-edit-row">
                <select className="form-select interaction-type-select" value={intForm.type} onChange={e => setIntForm(f => ({ ...f, type: e.target.value }))}>
                  {INTERACTION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <input className="form-input interaction-date-input" type="date" value={intForm.date} onChange={e => setIntForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <input className="form-input" placeholder="Note (optional)" value={intForm.note} onChange={e => setIntForm(f => ({ ...f, note: e.target.value }))} />
              <button type="submit" className="btn btn-primary btn-xs">Add</button>
            </form>
          )}

          {interactions.length === 0 ? (
            <p className="notes-empty">No interactions yet.</p>
          ) : (
            interactions.map(i => (
              <InteractionRow
                key={i.id}
                interaction={i}
                onDelete={handleDeleteInteraction}
                onEdit={handleEditInteraction}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ContactsSection({ dealId }) {
  const [contacts, setContacts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState({ name: '', role: '', email: '', phone: '' })
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setContacts(await api.getContacts(dealId)) }
    finally { setLoading(false) }
  }, [dealId])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const contact = await api.createContact(dealId, {
        name:  form.name.trim(),
        role:  form.role  || null,
        email: form.email || null,
        phone: form.phone || null,
      })
      setContacts(prev => [...prev, contact])
      setForm({ name: '', role: '', email: '', phone: '' })
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    await api.deleteContact(id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  const handleUpdate = (updated) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
  }

  return (
    <div className="detail-section">
      <div className="detail-section-title-row">
        <span className="detail-section-title">Contacts</span>
        <button className="btn btn-ghost btn-xs" onClick={() => setAdding(a => !a)}>
          {adding ? 'Cancel' : '+ Add contact'}
        </button>
      </div>

      {adding && (
        <form className="contact-add-form" onSubmit={handleAdd}>
          <div className="contact-edit-row">
            <input className="form-input" placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="">— Role —</option>
              {CONTACT_ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="contact-edit-row">
            <input className="form-input" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input className="form-input" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : 'Add contact'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="notes-loading"><div className="spinner" /></div>
      ) : contacts.length === 0 && !adding ? (
        <p className="notes-empty">No contacts yet.</p>
      ) : (
        <div className="contacts-list">
          {contacts.map(c => (
            <ContactCard
              key={c.id}
              contact={c}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Criteria checklist ─────────────────────────────────────────────────────────
function CriteriaSection({ deal, onUpdate }) {
  const score = CRITERIA.filter(c => deal[c.key]).length

  const handleToggle = async (key) => {
    const newVal = !deal[key]
    await onUpdate(deal.id, { [key]: newVal })
  }

  return (
    <div className="detail-section">
      <div className="detail-section-title-row">
        <span className="detail-section-title">DTE Investment Criteria</span>
        <span className={`criteria-score-badge large${score === CRITERIA.length ? ' all-met' : ''}`}>
          {score}/{CRITERIA.length}
        </span>
      </div>
      <div className="criteria-list">
        {CRITERIA.map(c => (
          <label key={c.key} className="criteria-item">
            <input
              type="checkbox"
              checked={!!deal[c.key]}
              onChange={() => handleToggle(c.key)}
              className="criteria-checkbox"
            />
            <span className={`criteria-label${deal[c.key] ? ' checked' : ''}`}>{c.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export default function DealDetailPanel({ deal, onClose, onEdit, onUpdate }) {
  const [notes, setNotes]           = useState([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [noteText, setNoteText]     = useState('')
  const [noteAuthor, setNoteAuthor] = useState(TEAM[0])
  const [notePin, setNotePin]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editText, setEditText]     = useState('')

  // Tab state: overview | documents | contacts | notes
  const [tab, setTab] = useState('overview')

  const loadNotes = useCallback(async () => {
    setLoadingNotes(true)
    try { setNotes(await api.getNotes(deal.id)) }
    finally { setLoadingNotes(false) }
  }, [deal.id])

  useEffect(() => { loadNotes() }, [loadNotes])

  const handleAddNote = async (e) => {
    e.preventDefault()
    if (!noteText.trim()) return
    setSaving(true)
    try {
      const note = await api.createNote(deal.id, { text: noteText.trim(), author: noteAuthor, is_pinned: notePin })
      setNotes(prev => {
        const base = notePin ? prev.map(n => ({ ...n, is_pinned: false })) : prev
        return [...base, note]
      })
      setNoteText('')
      setNotePin(false)
    } finally { setSaving(false) }
  }

  const handleTogglePin = async (note) => {
    const updated = await api.updateNote(note.id, { is_pinned: !note.is_pinned })
    setNotes(prev => prev.map(n => {
      if (updated.is_pinned && n.id !== note.id) return { ...n, is_pinned: false }
      if (n.id === note.id) return updated
      return n
    }))
  }

  const handleDeleteNote = async (noteId) => {
    await api.deleteNote(noteId)
    setNotes(prev => prev.filter(n => n.id !== noteId))
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
  const isOverdue   = deal.next_action_due && new Date(deal.next_action_due) < new Date()

  return (
    <div className="detail-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-panel">

        {/* ── Header ── */}
        <div className="detail-header">
          <div className="detail-header-left">
            <span className="detail-stage-badge" style={{ background: stageColor.bg, color: stageColor.color, borderColor: stageColor.bar }}>
              {deal.stage}
            </span>
            <div>
              <h2 className="detail-title">{deal.company_name}</h2>
              {deal.domain && (
                <a className="detail-domain" href={`https://${deal.domain}`} target="_blank" rel="noreferrer">{deal.domain}</a>
              )}
            </div>
          </div>
          <div className="detail-header-right">
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(deal)}>Edit</button>
            <button
              className="btn btn-ghost btn-sm"
              title="Export as PDF"
              onClick={async () => {
                const [n, c] = await Promise.all([api.getNotes(deal.id), api.getContacts(deal.id)])
                exportDealToPDF(deal, n, c)
              }}
            >
              ↓ PDF
            </button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        {/* ── Pinned thesis ── */}
        {(pinnedNote || deal.thesis) && (
          <div className="thesis-box">
            <div className="thesis-box-label">Investment Thesis</div>
            <p className="thesis-box-text">{pinnedNote?.text || deal.thesis}</p>
            {pinnedNote && <div className="thesis-box-meta">— {pinnedNote.author}</div>}
          </div>
        )}

        {/* ── Next action ── */}
        {(deal.next_action || deal.next_action_due) && (
          <div className={`detail-next-action${isOverdue ? ' overdue' : ''}`}>
            <span className="detail-next-action-label">{isOverdue ? '⚠ Overdue' : '→ Next action'}</span>
            <span className="detail-next-action-text">{deal.next_action || '—'}</span>
            {deal.next_action_due && <span className="detail-next-action-due">{fmtDate(deal.next_action_due)}</span>}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="detail-tabs">
          {['overview', 'documents', 'contacts', 'notes'].map(t => (
            <button key={t} className={`detail-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="detail-scroll">

          {/* ── Overview tab ── */}
          {tab === 'overview' && (
            <>
              <div className="detail-section">
                <div className="detail-section-title">Overview</div>
                <div className="detail-fields">
                  <Field label="Sector"       value={deal.sector} />
                  <Field label="Country"      value={deal.country} />
                  <Field label="Geography"    value={deal.geography} />
                  <Field label="EV (€m)"      value={deal.ev != null ? `€${deal.ev}m` : null} />
                  <Field label="Revenue (€m)" value={deal.revenue != null ? `€${deal.revenue}m` : null} />
                  <Field label="EBITDA (€m)"  value={deal.ebitda != null ? `€${deal.ebitda}m` : null} />
                  <Field label="Ownership %"  value={deal.ownership_pct != null ? `${deal.ownership_pct}%` : null} />
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">Deal Info</div>
                <div className="detail-fields">
                  {/* Sourcing */}
                  {deal.sourcing && (() => {
                    const sopt = SOURCING_OPTIONS.find(o => o.value === deal.sourcing)
                    return (
                      <div className="detail-field">
                        <span className="detail-field-label">Sourcing</span>
                        <span className="detail-field-value">
                          <span className="sourcing-badge" style={sopt ? { background: sopt.bg, color: sopt.color } : {}}>
                            {deal.sourcing}
                          </span>
                        </span>
                      </div>
                    )
                  })()}
                  <Field label="Co-investor" value={deal.co_investor} />
                  {/* Multi-owner display */}
                  <div className="detail-field detail-owner-field">
                    <span className="detail-field-label">Team</span>
                    <span className="detail-field-value owner-value">
                      {(() => {
                        const ownerList = deal.owners
                          ? deal.owners.split(',').map(o => o.trim()).filter(Boolean)
                          : deal.owner ? [deal.owner] : []
                        if (ownerList.length === 0) return '—'
                        return (
                          <div className="detail-owners-row">
                            {ownerList.map(o => <OwnerAvatar key={o} owner={o} size={20} />)}
                            <span style={{ marginLeft: 6, fontSize: 13 }}>{ownerList.join(', ')}</span>
                          </div>
                        )
                      })()}
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

              {/* DTE Investment Criteria checklist */}
              {onUpdate && <CriteriaSection deal={deal} onUpdate={onUpdate} />}

              {(deal.ic_date || deal.ic_memo || deal.term_sheet || deal.close_date) && (
                <div className="detail-section">
                  <div className="detail-section-title">Process Milestones</div>
                  <div className="detail-fields">
                    <Field label="IC date"    value={fmtDate(deal.ic_date)} />
                    <Field label="Close date" value={fmtDate(deal.close_date)} />
                    {deal.ic_memo && (
                      <div className="detail-field">
                        <span className="detail-field-label">IC memo</span>
                        <a className="detail-file-link" href={api.uploadUrl(deal.ic_memo)} target="_blank" rel="noreferrer">📄 View</a>
                      </div>
                    )}
                    {deal.term_sheet && (
                      <div className="detail-field">
                        <span className="detail-field-label">Term sheet</span>
                        <a className="detail-file-link" href={api.uploadUrl(deal.term_sheet)} target="_blank" rel="noreferrer">📄 View</a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Documents tab ── */}
          {tab === 'documents' && <DocumentsSection dealId={deal.id} />}

          {/* ── Contacts tab ── */}
          {tab === 'contacts' && <ContactsSection dealId={deal.id} />}

          {/* ── Notes tab ── */}
          {tab === 'notes' && (
            <div className="detail-section notes-section">
              <div className="detail-section-title">Notes</div>
              {loadingNotes ? (
                <div className="notes-loading"><div className="spinner" /></div>
              ) : (
                <div className="notes-feed">
                  {chronoNotes.length === 0 && <p className="notes-empty">No notes yet.</p>}
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
                          <button className={`note-pin-btn${note.is_pinned ? ' pinned' : ''}`} title={note.is_pinned ? 'Unpin' : 'Pin as thesis'} onClick={() => handleTogglePin(note)}>📌</button>
                          <button className="note-edit-btn" onClick={() => { setEditingNoteId(note.id); setEditText(note.text) }}>✎</button>
                          <button className="note-del-btn" onClick={() => handleDeleteNote(note.id)}>✕</button>
                        </div>
                      </div>
                      {editingNoteId === note.id ? (
                        <div className="note-edit-wrap">
                          <textarea className="form-textarea" rows={3} value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
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
              <form className="note-form" onSubmit={handleAddNote}>
                <textarea className="form-textarea" rows={3} placeholder="Add a note…" value={noteText} onChange={e => setNoteText(e.target.value)} />
                <div className="note-form-footer">
                  <select className="form-select note-author-select" value={noteAuthor} onChange={e => setNoteAuthor(e.target.value)}>
                    {TEAM.map(m => <option key={m}>{m}</option>)}
                  </select>
                  <label className="note-pin-label">
                    <input type="checkbox" checked={notePin} onChange={e => setNotePin(e.target.checked)} />
                    Set as thesis
                  </label>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !noteText.trim()}>
                    {saving ? 'Saving…' : 'Add note'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>{/* end detail-scroll */}
      </div>
    </div>
  )
}
