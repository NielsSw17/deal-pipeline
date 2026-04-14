import { useState } from 'react'
import { POSTPONE_REASONS } from '../constants'

export default function PostponeModal({ deal, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  const [notes, setNotes]   = useState('')

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal postpone-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <div className="gate-transition-badge">
              <span className="gate-from">{deal.stage}</span>
              <span className="gate-arrow">→</span>
              <span style={{ color: '#6b7280', fontWeight: 700 }}>Postponed</span>
            </div>
            <h2 className="modal-title">Postpone Deal</h2>
            <p className="gate-desc">Select the reason for postponing <strong>{deal.company_name}</strong>.</p>
          </div>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <div className="postpone-reasons-grid">
            {POSTPONE_REASONS.map(r => (
              <button
                key={r}
                type="button"
                className={`lost-reason-btn${reason === r ? ' selected' : ''}`}
                style={reason === r ? { borderColor: '#6b7280', background: '#f9fafb', color: '#374151' } : {}}
                onClick={() => setReason(r)}
              >
                {r}
              </button>
            ))}
          </div>

          {reason && (
            <div className="lost-note-wrap">
              <label className="form-label">Additional notes (optional)</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Revisit in Q3 2026 when founder is ready…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-secondary"
            style={{ background: '#6b7280', color: '#fff', borderColor: '#6b7280' }}
            onClick={() => onConfirm({ reason, notes: notes || null })}
            disabled={!reason}
          >
            Postpone Deal
          </button>
        </div>
      </div>
    </div>
  )
}
