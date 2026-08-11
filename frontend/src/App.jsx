import { useState } from 'react'

import MyAssignments from './components/Assignments/MyAssignments'
import SiteGrid from './components/Grid/SiteGrid'
import ImportControl from './components/Import/ImportControl'
import SiteMap from './components/Map/SiteMap'
import SiteDetailPanel from './components/SiteDetail/SiteDetailPanel'
import { useCurrentRep } from './hooks/useCurrentRep'
import { useSelectedSite } from './hooks/useSelectedSite'

const VIEWS = [
  { id: 'map', label: 'Map', Component: SiteMap },
  { id: 'grid', label: 'Grid', Component: SiteGrid },
  { id: 'calls', label: 'My Calls', Component: MyAssignments },
]

const CYCLE_LABEL = 'FY26 Retention Cycle'

/**
 * Rep identity picker, standing in for a login until auth lands.
 *
 * The choice drives which sites count as "mine" across every view and who a
 * logged call is attributed to, so it sits in the header where it stays
 * visible — a rep looking at an unexpectedly empty work list should be able to
 * see immediately that they are viewing it as someone else.
 */
function RepSwitcher() {
  const { initials, reps, setRep } = useCurrentRep()

  return (
    <label className="flex items-center gap-[7px]">
      {/*
        The word stays put and only the initials change: it sits outside the
        control rather than inside every option, so switching rep does not
        reflow the label next to it.
      */}
      <span className="whitespace-nowrap font-medium text-white">Rep</span>
      <select
        value={initials}
        onChange={(event) => setRep(event.target.value)}
        aria-label="Viewing as rep"
        className="h-[22px] cursor-pointer border border-teal-hairline bg-teal-header px-1 text-[11px] font-bold text-white hover:border-accent focus:border-accent focus:outline-none"
      >
        {reps.map((rep) => (
          // Options render on the system menu background, not the teal bar, so
          // they need their own colours to stay legible.
          <option key={rep} value={rep} className="bg-white text-body">
            {rep}
          </option>
        ))}
      </select>
    </label>
  )
}

/** The 48px brand bar: logo mark, title, tab switcher, and rep identity. */
function AppHeader({ view, onViewChange }) {
  return (
    <header className="flex h-12 flex-none items-stretch border-b border-teal-deep bg-teal-header pl-4 text-white">
      <div className="flex items-center gap-2.5 pr-7">
        {/*
          Decorative: the wordmark beside it already names the app, so an alt
          text here would only make a screen reader announce it twice.
        */}
        <img
          src="/canteen.png"
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px] flex-none"
        />
        <div className="whitespace-nowrap text-[14px] font-semibold tracking-[0.02em]">
          Canteen Retention Tracker
        </div>
      </div>

      <nav className="flex items-stretch">
        {VIEWS.map(({ id, label }) => {
          const isActive = view === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`whitespace-nowrap border-b-[3px] px-[18px] text-[12px] transition-colors ${
                isActive
                  ? 'border-accent font-bold text-white'
                  : 'border-transparent font-medium text-tab-inactive hover:text-white'
              }`}
            >
              {label}
            </button>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-4 px-4 text-[11px] text-header-meta">
        <ImportControl />
        <span className="h-[18px] w-px flex-none bg-teal-hairline" />
        <span className="hidden whitespace-nowrap xl:inline">{CYCLE_LABEL}</span>
        <span className="hidden h-[18px] w-px flex-none bg-teal-hairline xl:block" />
        <RepSwitcher />
      </div>
    </header>
  )
}

export default function App() {
  const [view, setView] = useState('grid')
  const { selectedSite, clearSelection } = useSelectedSite()

  const { Component: ActiveView } = VIEWS.find(({ id }) => id === view)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface">
      <AppHeader view={view} onViewChange={setView} />

      <main className="flex min-h-0 flex-1 flex-col">
        <ActiveView />
      </main>

      {selectedSite && (
        <SiteDetailPanel site={selectedSite} onClose={clearSelection} />
      )}
    </div>
  )
}
