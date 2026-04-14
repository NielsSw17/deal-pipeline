import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

function fmtDate(val) {
  if (!val) return ''
  return new Date(val + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function AlertBanner({ onViewDeal }) {
  const [alerts, setAlerts]   = useState([])
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(() => {
    api.getOverdueAlerts()
      .then(data => setAlerts(data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(interval)
  }, [load])

  if (alerts.length === 0) return null

  const overdueCount = alerts.filter(a => a.is_overdue).length
  const dueTodayCount = alerts.length - overdueCount

  return (
    <div className={`alert-banner${expanded ? ' expanded' : ''}`}>
      <div className="alert-banner-bar" onClick={() => setExpanded(e => !e)}>
        <div className="alert-banner-left">
          <span className="alert-icon">⚠</span>
          <span className="alert-summary">
            {overdueCount > 0 && (
              <span className="alert-badge overdue">{overdueCount} overdue</span>
            )}
            {dueTodayCount > 0 && (
              <span className="alert-badge due-today">{dueTodayCount} due today</span>
            )}
            <span className="alert-text">next action deadline{alerts.length !== 1 ? 's' : ''}</span>
          </span>
        </div>
        <span className="alert-caret">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="alert-list">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`alert-item${alert.is_overdue ? ' overdue' : ' due-today'}`}
              onClick={() => { if (onViewDeal) onViewDeal(alert) }}
            >
              <div className="alert-item-left">
                <span className={`alert-status-dot${alert.is_overdue ? ' overdue' : ''}`} />
                <div>
                  <span className="alert-company">{alert.company_name}</span>
                  <span className="alert-stage">{alert.stage}</span>
                </div>
              </div>
              <div className="alert-item-right">
                <span className="alert-action">{alert.next_action || 'Follow up'}</span>
                <span className={`alert-due${alert.is_overdue ? ' overdue' : ''}`}>
                  {alert.is_overdue ? '⚠ ' : ''}
                  {fmtDate(alert.next_action_due)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
