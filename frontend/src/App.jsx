import { useState } from 'react'

import SiteGrid from './components/Grid/SiteGrid'
import SiteMap from './components/Map/SiteMap'

const VIEWS = [
  { id: 'map', label: 'Map' },
  { id: 'grid', label: 'Grid' },
]

export default function App() {
  const [view, setView] = useState('map')

  return (
    <div className="flex h-screen w-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
        <h1 className="text-sm font-semibold text-gray-900">
          Canteen Retention Tracker
        </h1>

        <nav className="inline-flex gap-0.5 rounded-md bg-gray-100 p-0.5">
          {VIEWS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                view === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1 p-4">
        {view === 'map' ? <SiteMap /> : <SiteGrid />}
      </main>
    </div>
  )
}
