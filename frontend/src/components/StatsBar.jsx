import { STAGES, STAGE_COLORS } from '../constants'

export default function StatsBar({ deals }) {
  const activeDeals = deals.filter(d => d.stage !== 'Lost')
  const totalEV = activeDeals.reduce((s, d) => s + (d.ev || 0), 0)
  const countByStage = STAGES.reduce((acc, s) => {
    acc[s] = deals.filter(d => d.stage === s).length
    return acc
  }, {})

  return (
    <div className="stats-bar">
      <div className="stat-item">
        <span className="stat-label">Total Deals</span>
        <span className="stat-total">{deals.length}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Pipeline EV</span>
        <span className="stat-total">
          €{totalEV >= 1000 ? `${(totalEV / 1000).toFixed(1)}B` : `${totalEV.toFixed(0)}m`}
        </span>
      </div>
      {STAGES.map(stage =>
        countByStage[stage] > 0 ? (
          <div key={stage} className="stat-item">
            <div className="stat-dot" style={{ background: STAGE_COLORS[stage].bar }} />
            <span className="stat-label">{stage}</span>
            <span className="stat-value">{countByStage[stage]}</span>
          </div>
        ) : null
      )}
    </div>
  )
}
