import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { triggerSafeChunkReload } from './lib/lazyWithRetry'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  triggerSafeChunkReload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
