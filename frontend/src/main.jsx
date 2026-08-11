import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { CurrentRepProvider } from './hooks/CurrentRepProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CurrentRepProvider>
      <App />
    </CurrentRepProvider>
  </StrictMode>,
)
