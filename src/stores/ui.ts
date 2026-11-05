import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const THEME_KEY = 'vendigo.theme'
const SIDEBAR_KEY = 'vendigo.sidebar'

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readSidebar(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SIDEBAR_KEY) === 'true'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

function persist(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* almacenamiento no disponible */
  }
}

interface UiState {
  theme: Theme
  sidebarCollapsed: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
}

const initialTheme = readTheme()

export const useUiStore = create<UiState>((set, get) => ({
  theme: initialTheme,
  sidebarCollapsed: readSidebar(),

  setTheme: (theme) => {
    applyTheme(theme)
    persist(THEME_KEY, theme)
    set({ theme })
  },

  toggleTheme: () => {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
  },

  setSidebarCollapsed: (sidebarCollapsed) => {
    persist(SIDEBAR_KEY, String(sidebarCollapsed))
    set({ sidebarCollapsed })
  },

  toggleSidebar: () => get().setSidebarCollapsed(!get().sidebarCollapsed)
}))

// Aplica el tema al documento en el primer render, antes de pintar.
applyTheme(initialTheme)
