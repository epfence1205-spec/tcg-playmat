import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StreamView } from './stream/StreamView'

// Clear corrupted localStorage if it causes crashes
try {
  const raw = localStorage.getItem('tcg-playmat-state')
  if (raw) {
    const parsed = JSON.parse(raw)
    // If mulliganState exists but selectedToPutBack is not an array, it's corrupted
    if (parsed.mulliganState && !Array.isArray(parsed.mulliganState.selectedToPutBack)) {
      console.warn('Clearing corrupted persisted state')
      localStorage.removeItem('tcg-playmat-state')
    }
  }
} catch {
  localStorage.removeItem('tcg-playmat-state')
}

const isStreamView = window.location.pathname.endsWith('/stream') || window.location.pathname.endsWith('/stream/')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStreamView ? <StreamView /> : <App />}
  </StrictMode>,
)
