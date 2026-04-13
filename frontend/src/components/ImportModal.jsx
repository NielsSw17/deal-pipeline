import { useState, useRef } from 'react'
import { api } from '../api'

export default function ImportModal({ onClose, onImported }) {
  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)   // { imported, skipped }
  const [error, setError]     = useState(null)
  const fileRef               = useRef()

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.importDeals(file)
      setResult(res)
      onImported()   // refresh the deal list
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSeed = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.seedDeals()
      setResult(res)
      onImported()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal import-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">Import Deals</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!result ? (
            <>
              <p className="import-desc">
                Upload an Excel file in the DTE Investment Timeline format (.xlsx).
                Columns: <strong>Company, Sector, Country, Type, Channel, Ticket (€m), Last phase, Notes</strong>.
                Duplicate companies (by name) will be skipped.
              </p>

              <div className="import-file-row">
                <label className={`file-upload-btn${file ? ' has-file' : ''}`}>
                  {file ? file.name : '📎 Choose .xlsx file'}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files[0]
                      if (f) { setFile(f); setError(null) }
                    }}
                  />
                </label>
                {file && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setFile(null); fileRef.current.value = '' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {error && <div className="import-error">{error}</div>}

              <div className="import-divider">
                <span>or</span>
              </div>

              <button
                className="btn btn-ghost import-seed-btn"
                onClick={handleSeed}
                disabled={loading}
              >
                {loading ? <><span className="mini-spinner" /> Loading…</> : '⚡ Load DTE pipeline data (pre-loaded list)'}
              </button>
            </>
          ) : (
            <div className="import-result">
              <div className="import-result-icon">✓</div>
              <div className="import-result-title">Import complete</div>
              <div className="import-result-stats">
                <span className="import-stat imported">{result.imported} deals imported</span>
                {result.skipped > 0 && (
                  <span className="import-stat skipped">{result.skipped} skipped (already exist)</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!result ? (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!file || loading}
              >
                {loading ? <><span className="mini-spinner" /> Importing…</> : 'Import'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  )
}
