import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { STAGES, TEAM, SECTOR_TAXONOMY, DEAL_TYPES, COUNTRIES, GEOGRAPHIES, LOST_REASONS, SOURCING_OPTIONS, OWNER_COLORS, getSectorMeta, parseSectors } from '../constants'

const EMPTY = {
  company_name:  '',
  stage:         'Sourcing',
  sectors:       [],   // array of sector names
  deal_type:     '',
  ev:            '',
  country:       '',
  owners:        [],
  domain:        '',
  notes:         '',
  sourcing:      '',
  revenue:       '',
  ebitda:        '',
  ownership_pct: '',
  geography:     '',
  co_investor:   '',
  thesis:        '',
  next_action:   '',
  lost_reason:   '',
}

function parseOwners(deal) {
  if (!deal) return []
  if (deal.owners) return deal.owners.split(',').map(o => o.trim()).filter(Boolean)
  if (deal.owner)  return [deal.owner]
  return []
}

function OwnerMultiSelect({ selected, onChange }) {
  return (
    <div className="owner-multiselect">
      {TEAM.map(m => {
        const active = selected.includes(m)
        const color  = OWNER_COLORS[m] || '#64748b'
        return (
          <button
            key={m}
            type="button"
            className={`owner-chip${active ? ' active' : ''}`}
            style={active ? { background: color, color: '#fff', borderColor: color } : {}}
            onClick={() => {
              if (active) onChange(selected.filter(o => o !== m))
              else        onChange([...selected, m])
            }}
          >
            <span className="owner-chip-dot" style={{ background: active ? '#ffffff66' : color }} />
            {m}
          </button>
        )
      })}
    </div>
  )
}

function SectorMultiSelect({ selected, onChange }) {
  const [sectors, setSectors] = useState([])
  const [open, setOpen]       = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const ref = useRef()

  useEffect(() => {
    api.getSectors().then(setSectors).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (name) => {
    if (selected.includes(name)) onChange(selected.filter(s => s !== name))
    else onChange([...selected, name])
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const sector = await api.createSector({ name, is_custom: true })
      setSectors(prev => [...prev, sector])
      onChange([...selected, sector.name])
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  const groups = SECTOR_TAXONOMY.map(group => ({
    ...group,
    items: sectors.filter(s => s.theme === group.theme && !s.is_custom),
  }))
  const customItems = sectors.filter(s => s.is_custom)

  return (
    <div className="sector-multiselect" ref={ref}>
      <button
        type="button"
        className="sector-dropdown-trigger"
        onClick={() => setOpen(o => !o)}
      >
        {selected.length === 0 ? (
          <span className="sector-placeholder">— Select sectors —</span>
        ) : (
          <div className="sector-pills-wrap">
            {selected.map(s => {
              const meta = getSectorMeta(s)
              return (
                <span key={s} className="sector-pill" style={{ background: meta.bg, color: meta.color }}>
                  {s}
                </span>
              )
            })}
          </div>
        )}
        <span className="sector-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="sector-dropdown-panel">
          {groups.map(group => (
            group.items.length > 0 && (
              <div key={group.theme} className="sector-group">
                <div className="sector-group-label" style={{ color: group.color }}>{group.theme}</div>
                {group.items.map(s => (
                  <label key={s.name} className="sector-check-item">
                    <input
                      type="checkbox"
                      checked={selected.includes(s.name)}
                      onChange={() => toggle(s.name)}
                    />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            )
          ))}
          {customItems.length > 0 && (
            <div className="sector-group">
              <div className="sector-group-label" style={{ color: '#64748b' }}>Custom</div>
              {customItems.map(s => (
                <label key={s.name} className="sector-check-item">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.name)}
                    onChange={() => toggle(s.name)}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          )}
          <form className="sector-create-row" onSubmit={handleCreate}>
            <input
              className="form-input sector-create-input"
              placeholder="New custom sector…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <button type="submit" className="btn btn-ghost btn-xs" disabled={creating || !newName.trim()}>
              {creating ? '…' : '+ Create'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default function DealModal({ deal, onSave, onClose }) {
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setForm(deal ? {
      company_name:  deal.company_name  || '',
      stage:         deal.stage         || 'Sourcing',
      sectors:       parseSectors(deal.sectors),
      deal_type:     deal.deal_type     || '',
      ev:            deal.ev            ?? '',
      country:       deal.country       || '',
      owners:        parseOwners(deal),
      domain:        deal.domain        || '',
      notes:         deal.notes         || '',
      sourcing:      deal.sourcing      || '',
      revenue:       deal.revenue       ?? '',
      ebitda:        deal.ebitda        ?? '',
      ownership_pct: deal.ownership_pct ?? '',
      geography:     deal.geography     || '',
      co_investor:   deal.co_investor   || '',
      thesis:        deal.thesis        || '',
      next_action:   deal.next_action   || '',
      lost_reason:   deal.lost_reason   || '',
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
    if (form.revenue !== '' && isNaN(Number(form.revenue))) errs.revenue = 'Must be a number'
    if (form.ebitda !== '' && isNaN(Number(form.ebitda))) errs.ebitda = 'Must be a number'
    if (form.ownership_pct !== '' && isNaN(Number(form.ownership_pct))) errs.ownership_pct = 'Must be a number'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const ownersStr = form.owners.join(',') || null
      await onSave({
        company_name:  form.company_name.trim(),
        stage:         form.stage,
        sectors:       form.sectors.length ? JSON.stringify(form.sectors) : null,
        deal_type:     form.deal_type     || null,
        ev:            form.ev !== ''           ? Number(form.ev)            : null,
        country:       form.country       || null,
        owner:         form.owners[0]     || null,
        owners:        ownersStr,
        domain:        form.domain?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || null,
        notes:         form.notes         || null,
        sourcing:      form.sourcing      || null,
        revenue:       form.revenue !== ''      ? Number(form.revenue)       : null,
        ebitda:        form.ebitda !== ''        ? Number(form.ebitda)        : null,
        ownership_pct: form.ownership_pct !== '' ? Number(form.ownership_pct) : null,
        geography:     form.geography     || null,
        co_investor:   form.co_investor   || null,
        thesis:        form.thesis        || null,
        next_action:   form.next_action   || null,
        lost_reason:   form.lost_reason   || null,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">{deal ? 'Edit Deal' : 'Add Deal'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">

              {/* ── Identity ── */}
              <div className="form-section-label full">Company</div>

              <div className="form-group full">
                <label className="form-label">Company Name *</label>
                <input
                  className={`form-input${errors.company_name ? ' input-error' : ''}`}
                  value={form.company_name}
                  onChange={set('company_name')}
                  placeholder="e.g. Company"
                  autoFocus
                />
                {errors.company_name && <span className="field-error">{errors.company_name}</span>}
              </div>

              <div className="form-group full">
                <label className="form-label">Website / Domain</label>
                <input
                  className="form-input"
                  value={form.domain}
                  onChange={set('domain')}
                  placeholder="e.g. company.com"
                />
                <span className="field-hint">Used to fetch the company logo automatically</span>
              </div>

              <div className="form-group">
                <label className="form-label">Stage</label>
                <select className="form-select" value={form.stage} onChange={set('stage')}>
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {form.stage === 'Lost' && (
                <div className="form-group">
                  <label className="form-label">Lost reason</label>
                  <select className="form-select" value={form.lost_reason} onChange={set('lost_reason')}>
                    <option value="">— Select reason —</option>
                    {LOST_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Deal Type</label>
                <select className="form-select" value={form.deal_type} onChange={set('deal_type')}>
                  <option value="">— Select —</option>
                  {DEAL_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Country</label>
                <select className="form-select" value={form.country} onChange={set('country')}>
                  <option value="">— Select —</option>
                  {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Geography</label>
                <select className="form-select" value={form.geography} onChange={set('geography')}>
                  <option value="">— Select —</option>
                  {GEOGRAPHIES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>

              {/* ── Sectors ── */}
              <div className="form-group full">
                <label className="form-label">Sectors</label>
                <SectorMultiSelect
                  selected={form.sectors}
                  onChange={sectors => setForm(f => ({ ...f, sectors }))}
                />
              </div>

              {/* ── Financials ── */}
              <div className="form-section-label full">Financials</div>

              <div className="form-group">
                <label className="form-label">EV (€m)</label>
                <input
                  className={`form-input${errors.ev ? ' input-error' : ''}`}
                  type="number" min="0" step="any"
                  value={form.ev}
                  onChange={set('ev')}
                  placeholder="e.g. 150"
                />
                {errors.ev && <span className="field-error">{errors.ev}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Revenue (€m)</label>
                <input
                  className={`form-input${errors.revenue ? ' input-error' : ''}`}
                  type="number" min="0" step="any"
                  value={form.revenue}
                  onChange={set('revenue')}
                  placeholder="e.g. 30"
                />
                {errors.revenue && <span className="field-error">{errors.revenue}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">EBITDA (€m)</label>
                <input
                  className={`form-input${errors.ebitda ? ' input-error' : ''}`}
                  type="number" min="0" step="any"
                  value={form.ebitda}
                  onChange={set('ebitda')}
                  placeholder="e.g. 8"
                />
                {errors.ebitda && <span className="field-error">{errors.ebitda}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Ownership % target</label>
                <input
                  className={`form-input${errors.ownership_pct ? ' input-error' : ''}`}
                  type="number" min="0" max="100" step="any"
                  value={form.ownership_pct}
                  onChange={set('ownership_pct')}
                  placeholder="e.g. 60"
                />
                {errors.ownership_pct && <span className="field-error">{errors.ownership_pct}</span>}
              </div>

              {/* ── Deal Details ── */}
              <div className="form-section-label full">Deal Details</div>

              {/* Sourcing visual picker */}
              <div className="form-group full">
                <label className="form-label">Deal Sourcing</label>
                <div className="sourcing-picker">
                  <button
                    type="button"
                    className={`sourcing-option none-option${form.sourcing === '' ? ' selected' : ''}`}
                    onClick={() => setForm(f => ({ ...f, sourcing: '' }))}
                  >
                    None
                  </button>
                  {SOURCING_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`sourcing-option${form.sourcing === opt.value ? ' selected' : ''}`}
                      style={form.sourcing === opt.value
                        ? { background: opt.bg, color: opt.color, borderColor: opt.color }
                        : {}}
                      onClick={() => setForm(f => ({ ...f, sourcing: opt.value }))}
                    >
                      {opt.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team members multi-select */}
              <div className="form-group full">
                <label className="form-label">Team Members</label>
                <OwnerMultiSelect
                  selected={form.owners}
                  onChange={owners => setForm(f => ({ ...f, owners }))}
                />
              </div>

              <div className="form-group full">
                <label className="form-label">Co-investor</label>
                <input
                  className="form-input"
                  value={form.co_investor}
                  onChange={set('co_investor')}
                  placeholder="e.g. Alpinvest"
                />
              </div>

              <div className="form-group full">
                <label className="form-label">Investment Thesis</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={form.thesis}
                  onChange={set('thesis')}
                  placeholder="e.g. Market leader in cold-chain logistics for fresh produce…"
                />
              </div>

              {/* ── Next Action ── */}
              <div className="form-section-label full">Next Action</div>

              <div className="form-group full">
                <label className="form-label">Next action</label>
                <input
                  className="form-input"
                  value={form.next_action}
                  onChange={set('next_action')}
                  placeholder="e.g. Send term sheet, Schedule management call…"
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
