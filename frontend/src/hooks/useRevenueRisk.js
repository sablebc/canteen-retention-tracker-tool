import { useEffect, useState } from 'react'

import { getRevenueRisk } from '../api/client'

/**
 * Load the revenue-risk scores keyed by site primary key.
 *
 * `/analysis/revenue-risk-score/` is still a placeholder that answers 501
 * until the R scoring bridge lands, so a failure here is expected rather than
 * exceptional: the hook resolves to an empty map and the Rev. Risk column
 * renders blank instead of blocking the grid.
 *
 * The payload shape is not fixed yet, so both a `{siteId: score}` object and
 * a list of `{site, score}` records are accepted.
 */
function toScoreMap(payload) {
  const scores = new Map()
  if (!payload) return scores

  const rows = Array.isArray(payload) ? payload : (payload.results ?? null)

  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const siteId = row.site ?? row.site_id ?? row.id
      const score = row.score ?? row.risk_score ?? row.revenue_risk
      if (siteId !== undefined && score !== undefined && score !== null) {
        scores.set(Number(siteId), Number(score))
      }
    })
    return scores
  }

  if (typeof payload === 'object') {
    Object.entries(payload).forEach(([siteId, score]) => {
      const numeric = Number(score)
      if (Number.isFinite(numeric) && Number.isFinite(Number(siteId))) {
        scores.set(Number(siteId), numeric)
      }
    })
  }

  return scores
}

export function useRevenueRisk() {
  const [riskBySite, setRiskBySite] = useState(() => new Map())
  const [isAvailable, setIsAvailable] = useState(false)

  useEffect(() => {
    let isCancelled = false

    getRevenueRisk()
      .then((payload) => {
        if (isCancelled) return
        const scores = toScoreMap(payload)
        setRiskBySite(scores)
        setIsAvailable(scores.size > 0)
      })
      .catch(() => {
        // Scoring is not wired up yet; the column stays empty.
        if (!isCancelled) setIsAvailable(false)
      })

    return () => {
      isCancelled = true
    }
  }, [])

  return { riskBySite, isAvailable }
}
