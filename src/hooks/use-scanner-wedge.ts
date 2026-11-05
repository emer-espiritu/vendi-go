import { useEffect, useRef } from 'react'

/**
 * Captura el patrón de un lector de códigos físico, por cable o inalámbrico
 * (USB/Bluetooth funcionando en modo HID de teclado).
 *
 * Un lector de QR/código de barras tipo teclado (keyboard wedge) digita el
 * código y envía Enter. Este hook detecta ese patrón aunque el foco esté
 * fuera del campo de búsqueda:
 *
 * - Mientras el foco esté en un input/textarea/select o un elemento editable
 *   no interfiere: ahí el comportamiento existe en los handler locales.
 * - Una persona no puede tipear 4+ caracteres con menos de 80 ms entre cada
 *   tecla; un lector sí. Ese umbral descarta el uso accidental del teclado.
 */
interface ScannerWedgeOptions {
  enabled?: boolean
  /** Máximo ms entre teclas para considerarlas salida de un lector. */
  maxKeyDelayMs?: number
  /** Mínimo de caracteres del buffer para emitir un escaneo. */
  minLength?: number
  onScan: (code: string) => void
}

/**
 * 80 ms en lugar de 40: un lector por cable digita a 5-20 ms por carácter,
 * pero uno inalámbrico (Bluetooth/HID) sume latencia de radio de hasta ~70 ms
 * entre ráfagas. A una persona tipear 4+ caracteres todos bajo 80 ms de
 * distancia es prácticamente imposible, así que el umbral sigue descartando
 * el uso accidental del teclado.
 */
const WEDGE_MAX_KEY_DELAY_MS = 80

const isTypingTarget = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable)

export function useScannerWedge({
  enabled = true,
  maxKeyDelayMs = WEDGE_MAX_KEY_DELAY_MS,
  minLength = 3,
  onScan
}: ScannerWedgeOptions) {
  const optionsRef = useRef({ enabled, maxKeyDelayMs, minLength, onScan })

  // Se actualiza fuera del render para no leer refs durante el pintado.
  useEffect(() => {
    optionsRef.current = { enabled, maxKeyDelayMs, minLength, onScan }
  }, [enabled, maxKeyDelayMs, minLength, onScan])

  const bufferRef = useRef<{ text: string; time: number } | null>(null)

  useEffect(() => {
    const reset = () => {
      bufferRef.current = null
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!optionsRef.current.enabled) return
      if (event.ctrlKey || event.altKey || event.metaKey) {
        reset()
        return
      }
      if (event.key === 'Escape') {
        reset()
        return
      }

      if (event.key === 'Enter') {
        const buffer = bufferRef.current
        reset()
        // Buffer con el largo y el timing de un lector: es un escaneo y se
        // bloquea el Enter para que no dispare el botón o el link enfocado.
        if (buffer?.text.length && buffer.text.length >= optionsRef.current.minLength) {
          event.preventDefault()
          optionsRef.current.onScan(buffer.text)
        }
        return
      }

      if (isTypingTarget(event.target)) return
      if (event.key.length !== 1) return

      const time = performance.now()
      const buffer = bufferRef.current
      if (!buffer) {
        bufferRef.current = { text: event.key, time }
        return
      }
      if (time - buffer.time <= optionsRef.current.maxKeyDelayMs) {
        bufferRef.current = { text: buffer.text + event.key, time }
        return
      }
      // Ritmo de una persona tipeando: se descarta el buffer parcial
      bufferRef.current = null
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
