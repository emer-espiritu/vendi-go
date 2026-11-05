/**
 * Red de seguridad de diagnóstico: placa de error a nivel de pantalla.
 *
 * El equivalente de la consola de DevTools, pero visible sin abrir nada:
 * captura todo error de runtime y lo muestra en una placa fija arriba.
 * Si Chrome se muere, el texto entra en localStorage y reaparece al
 * reabrir la pestaña — por eso también persistimos lo capturado.
 */

const STORAGE_KEY = 'vendigo:last-error'

function showThrowable(kind: string, detail: string, persist = true): void {
  const stamped = `${new Date().toLocaleTimeString()} — ${kind}\n${detail}`
  renderPlate(`ERROR DE LA APP — copia este texto:\n\n${stamped}`, persist ? stamped : null)
}

/** Pinta la placa. `persistText` null = solo mostrar, no volver a guardar. */
function renderPlate(text: string, persistText: string | null): void {
  try {
    if (persistText) localStorage.setItem(STORAGE_KEY, persistText.slice(0, 4000))
  } catch {
    // Sin storage: no importa, la placa igual se pinta.
  }
  if (document.getElementById('vendigo-error-plate')) return

  const plate = document.createElement('div')
  plate.id = 'vendigo-error-plate'
  plate.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#b30000;color:#fff;padding:10px 14px;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;max-height:40vh;overflow:auto;'
  plate.textContent = text
  const report = document.createElement('button')
  report.textContent = 'Copiar en portapapeles'
  report.style.cssText = 'display:block;margin-top:8px;padding:6px 10px;font:12px sans-serif;cursor:pointer;'
  report.onclick = () => navigator.clipboard.writeText(text).catch(() => {})
  const dismiss = document.createElement('button')
  dismiss.textContent = 'Descartar'
  dismiss.style.cssText =
    'margin-top:8px;margin-left:8px;padding:6px 10px;font:12px sans-serif;cursor:pointer;'
  dismiss.onclick = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Sin storage: nada que limpiar.
    }
    plate.remove()
  }
  plate.appendChild(report)
  plate.appendChild(dismiss)
  document.body.appendChild(plate)
}

export function installErrorPlate(): void {
  const last = localStorage.getItem(STORAGE_KEY)
  if (last) {
    try {
      localStorage.removeItem(STORAGE_KEY)
      renderPlate(
        `ERROR DE LA APP — error de la sesión anterior\n\n${last}\n\n` +
          'Si la app funciona con normalidad, descartá esta placa: suele ser de un cambio de código a medio guardar.',
        null
      )
    } catch {
      // Storage bloqueado: seguimos igual.
    }
  }

  window.addEventListener('error', (event) => {
    if (event.message === 'ResizeObserver loop') return
    showThrowable(
      `window.onerror: ${event.filename}:${event.lineno}:${event.colno}`,
      [
        `message: ${event.message}`,
        event.error?.stack ? `stack:\n${event.error.stack}` : 'sin stack'
      ].join('\n')
    )
  })

  window.addEventListener('unhandledrejection', (event) => {
    showThrowable(
      'unhandledrejection (promesa sin catch)',
      String((event.reason as Error)?.stack ?? event.reason).slice(0, 2000)
    )
  })
}
