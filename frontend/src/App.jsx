import { useState } from 'react'

import MyAssignments from './components/Assignments/MyAssignments'
import SiteGrid from './components/Grid/SiteGrid'
import ImportControl from './components/Import/ImportControl'
import SiteMap from './components/Map/SiteMap'
import SiteDetailPanel from './components/SiteDetail/SiteDetailPanel'
import { useSelectedSite } from './hooks/useSelectedSite'
import { CURRENT_REP } from './lib/sites'

const VIEWS = [
  { id: 'map', label: 'Map', Component: SiteMap },
  { id: 'grid', label: 'Grid', Component: SiteGrid },
  { id: 'calls', label: 'My Calls', Component: MyAssignments },
]

const CYCLE_LABEL = 'FY26 Retention Cycle'

/** The 48px brand bar: logo mark, title, tab switcher, and rep identity. */
function AppHeader({ view, onViewChange }) {
  return (
    <header className="flex h-12 flex-none items-stretch border-b border-teal-deep bg-teal-header pl-4 text-white">
      <div className="flex items-center gap-2.5 pr-7">
        {/* Placeholder for the Canteen Canada mark. */}
        <div className="h-[18px] w-[18px] flex-none bg-accent" />
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
        <span className="flex items-center gap-[7px]">
          <span className="flex h-[22px] w-[22px] flex-none items-center justify-center bg-accent text-[10px] font-bold text-teal-deep">
            {CURRENT_REP.initials}
          </span>
          <span className="whitespace-nowrap text-white">
            {CURRENT_REP.displayName}
          </span>
        </span>
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
