import { createContext, useContext } from 'react'

import { REP_ORDER } from '../lib/sites'

/**
 * Who the person using the app is, as a runtime choice rather than a constant.
 *
 * There is no authentication yet, and one deployment serves the whole team over
 * the LAN — so "my sites" and the author of a logged call have to be something
 * each person picks for themselves. The choice is kept in localStorage so it
 * survives a reload: it is per-browser, which is exactly the right scope while
 * every rep works from their own machine against a shared server.
 *
 * This is a stand-in for real accounts, not a security boundary — anyone can
 * select any rep. It decides whose work list you see, nothing more.
 *
 * The provider lives in its own module so this one exports no components,
 * which is what keeps fast refresh working for both.
 */

/** Where the chosen rep is remembered between reloads. */
export const STORAGE_KEY = 'canteen.currentRep'

/** Used when nothing is stored yet, or what is stored is no longer a rep. */
export const DEFAULT_REP_INITIALS = REP_ORDER[0]

export const CurrentRepContext = createContext(null)

/** The selected rep: `{ initials, displayName, reps, setRep }`. */
export function useCurrentRep() {
  const value = useContext(CurrentRepContext)
  if (value === null) {
    throw new Error('useCurrentRep must be used within a CurrentRepProvider')
  }
  return value
}
