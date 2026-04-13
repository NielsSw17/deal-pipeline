import { useState } from 'react'
import { LOST_REASONS } from '../constants'

export default function LostModal({ deal, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  const [note, setNote]     = useState('')

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal lost-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <div className="gate-transition-badge">
              <span className="gate-from">{deal.stage}</span>
              <span className="gate-arrow">→</span>
              <span style={{ color: '#94a3b8', fontWeight: 700 }}>Lost</span>
            </div>
            <h2 className="modal-title">Mark as Lost</h2>
            <p className="gate-desc">Select the primary reason this deal was lost.</p>
          </div>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <div className="lost-reasons-grid">
            {LOST_REASONS.map(r => (
              <button
                key={r}
                type="button"
                className={`lost-reason-btn${reason === r ? ' selected' : ''}`}
                onClick={() => setReason(r)}
              >
                {r}
              </button>
            ))}
          </div>

          {reason && (
            <div className="lost-note-wrap">
              <label className="form-label">Additional note (optional)</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Any additional context…"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-danger"
            onClick={() => onConfirm({ reason, note: note || null })}
            disabled={!reason}
          >
            Mark as Lost
          </button>
        </div>
      </div>
    </div>
  )
}
