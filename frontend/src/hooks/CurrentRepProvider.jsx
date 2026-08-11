import { useCallback, useMemo, useState } from 'react'

import { REP_ORDER } from '../lib/sites'
import {
  CurrentRepContext,
  DEFAULT_REP_INITIALS,
  STORAGE_KEY,
} from './useCurrentRep'

/**
 * Read the remembered rep, ignoring anything not in the current roster.
 *
 * A stored value that is no longer a real rep would silently filter every view
 * down to nothing, which reads as "the data failed to load" rather than as a
 * stale setting.
 */
function readStoredRep() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return REP_ORDER.includes(stored) ? stored : DEFAULT_REP_INITIALS
  } catch {
    // Storage is unavailable in private windows and some locked-down profiles.
    return DEFAULT_REP_INITIALS
  }
}

/** Supplies the selected rep to the tree; see `useCurrentRep` for the shape. */
export function CurrentRepProvider({ children }) {
  const [initials, setInitials] = useState(readStoredRep)

  const setRep = useCallback((next) => {
    if (!REP_ORDER.includes(next)) return
    setInitials(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // The choice still applies for this session; it just won't be remembered.
    }
  }, [])

  const value = useMemo(
    () => ({ initials, displayName: `Rep ${initials}`, reps: REP_ORDER, setRep }),
    [initials, setRep],
  )

  return (
    <CurrentRepContext.Provider value={value}>{children}</CurrentRepContext.Provider>
  )
}
