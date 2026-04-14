import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'
import { TEAM } from '../constants'

const ENTRY_TYPES = ['Meeting', 'Call', 'Email', 'Note', 'Document Upload']

const TYPE_ICONS = {
  Meeting:           '🤝',
  Call:              '📞',
  Email:             '✉️',
  Note:              '📝',
  'Document Upload': '📎',
}

function fmtDate(val) {
  if (!val) return '—'
  return new Date(val + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function TeamMemberSelect({ selected, onChange }) {
  return (
    <div className="team-checkbox-row">
      {TEAM.map(m => (
        <label key={m} className={`team-chip-check${selected.includes(m) ? ' active' : ''}`}>
          <input
            type="checkbox"
            checked={selected.includes(m)}
            onChange={() => {
              if (selected.includes(m)) onChange(selected.filter(x => x !== m))
              else onChange([...selected, m])
            }}
            style={{ display: 'none' }}
          />
          {m}
        </label>
      ))}
    </div>
  )
}

function EntryForm({ dealId, onAdded }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    type:                  'Meeting',
    date:                  today,
    team_members:          [],
    external_participants: '',
    subject:               '',
    notes:                 '',
  })
  const [file, setFile]         = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]     = useState(false)
  const fileRef = useRef()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.date) return
    setSaving(true)
    try {
      let filename = null
      let original_filename = null
      if (file) {
        setUploading(true)
        const up = await api.uploadFile(file)
        filename = up.filename
        original_filename = up.original_name
        setUploading(false)
      }
      const entry = await api.createCorrespondence(dealId, {
        type:                  form.type,
        date:                  form.date,
        team_members:          form.team_members.join(',') || null,
        external_participants: form.external_participants || null,
        subject:               form.subject || null,
        notes:                 form.notes || null,
        filename,
        original_filename,
      })
      onAdded(entry)
      setForm({ type: 'Meeting', date: today, team_members: [], external_participants: '', subject: '', notes: '' })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  return (
    <form className="corr-entry-form" onSubmit={handleSubmit}>
      <div className="corr-form-title">Add timeline entry</div>

      <div className="corr-form-row">
        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="form-select" value={form.type} onChange={set('type')}>
            {ENTRY_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Date *</label>
          <input className="form-input" type="date" value={form.date} onChange={set('date')} required />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Subject</label>
        <input className="form-input" placeholder="Brief description" value={form.subject} onChange={set('subject')} />
      </div>

      <div className="form-group">
        <label className="form-label">DTE Team</label>
        <TeamMemberSelect
          selected={form.team_members}
          onChange={members => setForm(f => ({ ...f, team_members: members }))}
        />
      </div>

      <div className="form-group">
        <label className="form-label">External participants</label>
        <input
          className="form-input"
          placeholder="e.g. Jan de Vries (CEO), Sarah Smith"
          value={form.external_participants}
          onChange={set('external_participants')}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Key discussion points, outcomes…"
          value={form.notes}
          onChange={set('notes')}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Document (optional)</label>
        <div className="corr-file-row">
          <label className={`file-upload-btn${file ? ' has-file' : ''}`}>
            {file ? file.name : '📎 Attach file'}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.xlsx"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0] || null)}
            />
          </label>
          {file && (
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => { setFile(null); fileRef.current.value = '' }}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="corr-form-footer">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !form.date}>
          {uploading ? <><span className="mini-spinner" /> Uploading…</> : saving ? 'Saving…' : 'Add entry'}
        </button>
      </div>
    </form>
  )
}

function EntryRow({ entry, onDelete }) {
  const icon = TYPE_ICONS[entry.type] || '💬'
  const teamList = entry.team_members ? entry.team_members.split(',').map(s => s.trim()).filter(Boolean) : []

  return (
    <div className="corr-entry">
      <div className="corr-entry-left">
        <div className="corr-type-icon">{icon}</div>
        <div className="corr-entry-date">{fmtDate(entry.date)}</div>
      </div>
      <div className="corr-entry-body">
        <div className="corr-entry-header">
          <span className="corr-type-badge">{entry.type}</span>
          {entry.subject && <span className="corr-subject">{entry.subject}</span>}
        </div>
        {(teamList.length > 0 || entry.external_participants) && (
          <div className="corr-participants">
            {teamList.length > 0 && <span className="corr-team">{teamList.join(', ')}</span>}
            {entry.external_participants && (
              <span className="corr-external"> + {entry.external_participants}</span>
            )}
          </div>
        )}
        {entry.notes && <p className="corr-notes">{entry.notes}</p>}
        {entry.filename && (
          <a
            className="corr-doc-link"
            href={api.uploadUrl(entry.filename)}
            target="_blank"
            rel="noreferrer"
          >
            📄 {entry.original_filename || entry.filename}
          </a>
        )}
      </div>
      <button className="note-del-btn corr-del" onClick={() => onDelete(entry.id)} title="Delete entry">✕</button>
    </div>
  )
}

export default function CorrespondencePanel({ deal, onClose, onContactUpdated }) {
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setEntries(await api.getCorrespondence(deal.id)) }
    finally { setLoading(false) }
  }, [deal.id])

  useEffect(() => { load() }, [load])

  const handleAdded = (entry) => {
    setEntries(prev => [entry, ...prev])
    if (onContactUpdated) onContactUpdated(entry.date)
  }

  const handleDelete = async (entryId) => {
    await api.deleteCorrespondence(deal.id, entryId)
    setEntries(prev => {
      const next = prev.filter(e => e.id !== entryId)
      if (onContactUpdated) onContactUpdated(next[0]?.date || null)
      return next
    })
  }

  return (
    <div className="corr-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="corr-panel">
        <div className="corr-header">
          <div>
            <h2 className="corr-title">Correspondence Timeline</h2>
            <div className="corr-deal-name">{deal.company_name}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="corr-scroll">
          <EntryForm dealId={deal.id} onAdded={handleAdded} />

          <div className="corr-divider">
            <span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
          </div>

          {loading ? (
            <div className="notes-loading"><div className="spinner" /></div>
          ) : entries.length === 0 ? (
            <p className="notes-empty">No correspondence logged yet.</p>
          ) : (
            <div className="corr-feed">
              {entries.map(e => (
                <EntryRow key={e.id} entry={e} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
