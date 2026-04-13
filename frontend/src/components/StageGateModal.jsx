import { useState } from 'react'
import { STAGE_GATES } from '../constants'
import { api } from '../api'

export default function StageGateModal({ deal, fromStage, toStage, onConfirm, onCancel }) {
  const gateKey = `${fromStage}→${toStage}`
  const gate    = STAGE_GATES[gateKey]

  // Pre-fill from existing deal values
  const [form, setForm] = useState(() => {
    const init = {}
    gate?.checks.forEach(c => { init[c.key] = deal[c.key] ?? '' })
    return init
  })
  const [uploadMeta, setUploadMeta]   = useState({}) // { key: { filename, original_name } }
  const [uploading, setUploading]     = useState({}) // { key: true|false }
  const [uploadError, setUploadError] = useState({})

  if (!gate) return null

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleFile = async (key, file) => {
    setUploading(u => ({ ...u, [key]: true }))
    setUploadError(e => ({ ...e, [key]: null }))
    try {
      const result = await api.uploadFile(file)
      setUploadMeta(m => ({ ...m, [key]: result }))
      set(key, result.filename)
    } catch (e) {
      setUploadError(er => ({ ...er, [key]: e.message }))
    } finally {
      setUploading(u => ({ ...u, [key]: false }))
    }
  }

  const clearFile = (key) => {
    set(key, '')
    setUploadMeta(m => ({ ...m, [key]: null }))
  }

  const allFilled = gate.checks.every(c => {
    const v = form[c.key]
    return v !== '' && v != null
  })

  const anyUploading = Object.values(uploading).some(Boolean)

  const handleConfirm = () => {
    if (!allFilled || anyUploading) return
    // Coerce numbers
    const payload = {}
    gate.checks.forEach(c => {
      payload[c.key] = c.type === 'number' ? Number(form[c.key]) : form[c.key]
    })
    onConfirm(payload)
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal gate-modal" role="dialog" aria-modal="true">

        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="gate-transition-badge">
              <span className="gate-from">{fromStage}</span>
              <span className="gate-arrow">→</span>
              <span className="gate-to">{toStage}</span>
            </div>
            <h2 className="modal-title">{gate.title}</h2>
            <p className="gate-desc">{gate.description}</p>
          </div>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        {/* Checklist body */}
        <div className="modal-body">
          <div className="gate-checklist">
            {gate.checks.map(check => {
              const filled = form[check.key] !== '' && form[check.key] != null
              return (
                <div key={check.key} className={`gate-item ${filled ? 'gate-item--done' : ''}`}>
                  <div className="gate-check-icon">{filled ? '✓' : '○'}</div>
                  <div className="gate-field">
                    <label className="form-label">{check.label}</label>

                    {check.type === 'select' && (
                      <select className="form-select" value={form[check.key]} onChange={e => set(check.key, e.target.value)}>
                        <option value="">— Select —</option>
                        {check.options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    )}

                    {check.type === 'textarea' && (
                      <textarea
                        className="form-textarea"
                        rows={2}
                        value={form[check.key]}
                        onChange={e => set(check.key, e.target.value)}
                        placeholder={check.placeholder || ''}
                      />
                    )}

                    {check.type === 'number' && (
                      <input
                        className="form-input"
                        type="number" min="0" step="any"
                        value={form[check.key]}
                        onChange={e => set(check.key, e.target.value)}
                      />
                    )}

                    {check.type === 'date' && (
                      <input
                        className="form-input"
                        type="date"
                        value={form[check.key]}
                        onChange={e => set(check.key, e.target.value)}
                      />
                    )}

                    {check.type === 'file' && (
                      <div className="file-upload-wrap">
                        {form[check.key] ? (
                          <div className="file-uploaded-row">
                            <a
                              href={api.uploadUrl(form[check.key])}
                              target="_blank"
                              rel="noreferrer"
                              className="file-link"
                            >
                              📄 {uploadMeta[check.key]?.original_name || form[check.key]}
                            </a>
                            <button type="button" className="file-clear" onClick={() => clearFile(check.key)}>✕</button>
                          </div>
                        ) : (
                          <label className={`file-upload-btn ${uploading[check.key] ? 'uploading' : ''}`}>
                            {uploading[check.key] ? (
                              <><span className="mini-spinner" /> Uploading…</>
                            ) : (
                              <>📎 Choose file</>
                            )}
                            <input
                              type="file"
                              accept=".pdf,.docx,.doc"
                              style={{ display: 'none' }}
                              disabled={uploading[check.key]}
                              onChange={e => { const f = e.target.files[0]; if (f) handleFile(check.key, f) }}
                            />
                          </label>
                        )}
                        {uploadError[check.key] && (
                          <span className="field-error">{uploadError[check.key]}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!allFilled || anyUploading}
          >
            {anyUploading ? 'Uploading…' : 'Confirm & Move Stage →'}
          </button>
        </div>
      </div>
    </div>
  )
}
