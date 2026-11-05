import { useUiStore, type Theme } from '@/stores/ui'

export type { Theme }
export { useUiStore }

/** Adaptador de compatibilidad sobre el store de preferencias de la UI. */
export function useTheme() {
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  return { theme, setTheme, toggleTheme }
}
