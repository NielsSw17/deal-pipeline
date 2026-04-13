import { useState, useEffect } from 'react'
import { STAGES, TEAM, THEMES, SECTORS, COUNTRIES, GEOGRAPHIES, DEAL_SOURCES, LOST_REASONS } from '../constants'

const EMPTY = {
  company_name:    '',
  stage:           'Sourcing',
  sector:          '',
  ev:              '',
  country:         '',
  owner:           '',
  domain:          '',
  theme:           '',
  notes:           '',
  revenue:         '',
  ebitda:          '',
  ownership_pct:   '',
  geography:       '',
  deal_source:     '',
  co_investor:     '',
  thesis:          '',
  ic_date:         '',
  close_date:      '',
  next_action:     '',
  next_action_due: '',
  lost_reason:     '',
}

export default function DealModal({ deal, onSave, onClose }) {
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setForm(deal ? {
      company_name:    deal.company_name    || '',
      stage:           deal.stage           || 'Sourcing',
      sector:          deal.sector          || '',
      ev:              deal.ev              ?? '',
      country:         deal.country         || '',
      owner:           deal.owner           || '',
      domain:          deal.domain          || '',
      theme:           deal.theme           || '',
      notes:           deal.notes           || '',
      revenue:         deal.revenue         ?? '',
      ebitda:          deal.ebitda          ?? '',
      ownership_pct:   deal.ownership_pct   ?? '',
      geography:       deal.geography       || '',
      deal_source:     deal.deal_source     || '',
      co_investor:     deal.co_investor     || '',
      thesis:          deal.thesis          || '',
      ic_date:         deal.ic_date         || '',
      close_date:      deal.close_date      || '',
      next_action:     deal.next_action     || '',
      next_action_due: deal.next_action_due || '',
      lost_reason:     deal.lost_reason     || '',
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
      await onSave({
        company_name:    form.company_name.trim(),
        stage:           form.stage,
        sector:          form.sector          || null,
        ev:              form.ev !== ''           ? Number(form.ev)            : null,
        country:         form.country         || null,
        owner:           form.owner           || null,
        domain:          form.domain?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || null,
        theme:           form.theme           || null,
        notes:           form.notes           || null,
        revenue:         form.revenue !== ''      ? Number(form.revenue)       : null,
        ebitda:          form.ebitda !== ''        ? Number(form.ebitda)        : null,
        ownership_pct:   form.ownership_pct !== '' ? Number(form.ownership_pct) : null,
        geography:       form.geography       || null,
        deal_source:     form.deal_source     || null,
        co_investor:     form.co_investor     || null,
        thesis:          form.thesis          || null,
        ic_date:         form.ic_date         || null,
        close_date:      form.close_date      || null,
        next_action:     form.next_action     || null,
        next_action_due: form.next_action_due || null,
        lost_reason:     form.lost_reason     || null,
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
                  placeholder="e.g. Perfotec"
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
                  placeholder="e.g. perfotec.com"
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
                <label className="form-label">Sector</label>
                <select className="form-select" value={form.sector} onChange={set('sector')}>
                  <option value="">— Select —</option>
                  {SECTORS.map(s => <option key={s}>{s}</option>)}
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

              {/* ── Deal details ── */}
              <div className="form-section-label full">Deal Details</div>

              <div className="form-group">
                <label className="form-label">Owner</label>
                <select className="form-select" value={form.owner} onChange={set('owner')}>
                  <option value="">— Unassigned —</option>
                  {TEAM.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Deal source</label>
                <select className="form-select" value={form.deal_source} onChange={set('deal_source')}>
                  <option value="">— Select —</option>
                  {DEAL_SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
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

              {/* ── DTE Theme ── */}
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
                        : {}}
                      onClick={() => setForm(f => ({ ...f, theme: t.value }))}
                    >
                      <span className="theme-dot" style={{ background: t.dot }} />
                      {t.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Process dates ── */}
              <div className="form-section-label full">Process</div>

              <div className="form-group">
                <label className="form-label">IC date</label>
                <input className="form-input" type="date" value={form.ic_date} onChange={set('ic_date')} />
              </div>

              <div className="form-group">
                <label className="form-label">Close date</label>
                <input className="form-input" type="date" value={form.close_date} onChange={set('close_date')} />
              </div>

              {/* ── Next action ── */}
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

              <div className="form-group">
                <label className="form-label">Due date</label>
                <input className="form-input" type="date" value={form.next_action_due} onChange={set('next_action_due')} />
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
