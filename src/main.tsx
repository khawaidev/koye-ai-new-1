import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ThemeProvider } from './components/theme-provider'
import './index.css'
// Initialize multi-database manager on app start
import './services/multiDbManager'

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('Root element not found!')
  throw new Error('Root element not found')
}

console.log('Rendering app...')

try {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </StrictMode>
  )
  console.log('App rendered successfully')
} catch (error) {
  console.error('Error rendering app:', error)
  rootElement.innerHTML = `
    <div style="padding: 20px; color: red;">
      <h1>Error Rendering App</h1>
      <pre>${String(error)}</pre>
    </div>
  `
}
