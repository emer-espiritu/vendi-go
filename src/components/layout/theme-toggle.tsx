import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/store/theme'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={cn(
        'group relative inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-1.5 py-1.5 text-muted transition-all duration-200 hover:border-brand/40 hover:text-brand-600',
        withLabel && 'px-3',
        className
      )}
    >
      <span className="relative grid size-6 place-items-center overflow-hidden rounded-lg">
        <Sun
          className={cn(
            'absolute size-3.5 transition-all duration-300',
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          )}
        />
        <Moon
          className={cn(
            'absolute size-3.5 transition-all duration-300',
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          )}
        />
      </span>
      {withLabel ? <span className="text-xs font-semibold text-foreground">{isDark ? 'Modo oscuro' : 'Modo claro'}</span> : null}
    </button>
  )
}
