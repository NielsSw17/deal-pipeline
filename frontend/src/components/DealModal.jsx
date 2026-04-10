import { useState, useEffect } from 'react'
import { STAGES, TEAM, THEMES, SECTORS, COUNTRIES } from '../constants'

const EMPTY = {
  company_name: '',
  stage: 'Sourcing',
  sector: '',
  ev: '',
  country: '',
  owner: '',
  domain: '',
  theme: '',
  notes: '',
}

export default function DealModal({ deal, onSave, onClose }) {
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setForm(deal ? {
      company_name: deal.company_name || '',
      stage:        deal.stage || 'Sourcing',
      sector:       deal.sector || '',
      ev:           deal.ev ?? '',
      country:      deal.country || '',
      owner:        deal.owner || '',
      domain:       deal.domain || '',
      theme:        deal.theme || '',
      notes:        deal.notes || '',
    } : EMPTY)
    setErrors({})
  }, [deal])

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    if (errors[field]) setErrors(er => ({ ...er, [field]: null }))
  }

  const validate = () => {
    const errs = {}
    if (!form.company_name.trim()) errs.company_name = 'Required'
    if (form.ev !== '' && isNaN(Number(form.ev))) errs.ev = 'Must be a number'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      await onSave({
        company_name: form.company_name.trim(),
        stage:   form.stage,
        sector:  form.sector  || null,
        ev:      form.ev !== '' ? Number(form.ev) : null,
        country: form.country || null,
        owner:   form.owner   || null,
        domain:  form.domain?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || null,
        theme:   form.theme   || null,
        notes:   form.notes   || null,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">{deal ? 'Edit Deal' : 'Add Deal'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">

              {/* Company name */}
              <div className="form-group full">
                <label className="form-label">Company Name *</label>
                <input
                  className={`form-input${errors.company_name ? ' input-error' : ''}`}
                  value={form.company_name}
                  onChange={set('company_name')}
                  placeholder="e.g. Perfotec"
                  autoFocus
                />
                {errors.company_name && <span className="field-error">{errors.company_name}</span>}
              </div>

              {/* Domain */}
              <div className="form-group full">
                <label className="form-label">Website / Domain</label>
                <input
                  className="form-input"
                  value={form.domain}
                  onChange={set('domain')}
                  placeholder="e.g. perfotec.com"
                />
                <span className="field-hint">Used to fetch the company logo automatically</span>
              </div>

              {/* Stage */}
              <div className="form-group">
                <label className="form-label">Stage</label>
                <select className="form-select" value={form.stage} onChange={set('stage')}>
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {/* Sector */}
              <div className="form-group">
                <label className="form-label">Sector</label>
                <select className="form-select" value={form.sector} onChange={set('sector')}>
                  <option value="">— Select —</option>
                  {SECTORS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {/* EV */}
              <div className="form-group">
                <label className="form-label">EV (€m)</label>
                <input
                  className={`form-input${errors.ev ? ' input-error' : ''}`}
                  type="number"
                  min="0"
                  step="any"
                  value={form.ev}
                  onChange={set('ev')}
                  placeholder="e.g. 150"
                />
                {errors.ev && <span className="field-error">{errors.ev}</span>}
              </div>

              {/* Country */}
              <div className="form-group">
                <label className="form-label">Country</label>
                <select className="form-select" value={form.country} onChange={set('country')}>
                  <option value="">— Select —</option>
                  {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Owner – dropdown */}
              <div className="form-group">
                <label className="form-label">Owner</label>
                <select className="form-select" value={form.owner} onChange={set('owner')}>
                  <option value="">— Unassigned —</option>
                  {TEAM.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              {/* Theme – pill buttons */}
              <div className="form-group full">
                <label className="form-label">DTE Theme</label>
                <div className="theme-picker">
                  <button
                    type="button"
                    className={`theme-option none-option${form.theme === '' ? ' selected' : ''}`}
                    onClick={() => setForm(f => ({ ...f, theme: '' }))}
                  >
                    None
                  </button>
                  {THEMES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      className={`theme-option${form.theme === t.value ? ' selected' : ''}`}
                      style={form.theme === t.value
                        ? { background: t.bg, color: t.color, borderColor: t.dot }
                        : {}
                      }
                      onClick={() => setForm(f => ({ ...f, theme: t.value }))}
                    >
                      <span className="theme-dot" style={{ background: t.dot }} />
                      {t.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="form-group full">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="Add notes about this deal…"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : deal ? 'Save Changes' : 'Add Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
