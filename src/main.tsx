import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { DemoStoreProvider } from '@/store/demo-store'
import { ToastProvider } from '@/store/toast'
import { installErrorPlate } from '@/lib/error-plate'

installErrorPlate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <DemoStoreProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DemoStoreProvider>
    </ToastProvider>
  </StrictMode>
)
