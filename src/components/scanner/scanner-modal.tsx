import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { AlertCircle, Camera, CheckCircle2, Loader2, X } from 'lucide-react'
import { Button, Modal, Select } from '@/components/ui'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 900

/**
 * Solo códigos de barras lineales (1D): EAN/UPC/Code 128/Code 39/ITF/Codabar.
 *
 * Restringir los formatos agiliza la detección de un código en la etiqueta
 * (no compite con la lectura de QR) y es lo que retorna el lector/etiqueta
 * física usada en el minimarket. Si algún día se emiten códigos QR en el
 * local, se agrega `BarcodeFormat.QR_CODE` a la lista y listo.
 */
const BARCODE_HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR
    ]
  ],
  [DecodeHintType.TRY_HARDER, true]
])

const CAMERA_ERRORS: [RegExp, string][] = [
  [/NotAllowedError|permission/i, 'Permiso de cámara denegado. Habilítalo en el candado de la barra de direcciones.'],
  [/NotFoundError|no camera|no camera of type/i, 'No se encontró una cámara disponible en este dispositivo.'],
  [/secure/i, 'La cámara requiere abrir la app en https:// o localhost.']
]

const SECURE_MESSAGE = 'La cámara requiere un contexto seguro: abre la app con https:// o en localhost.'

/** Documento el caso exacto del dev en LAN: secuencia para usar la cámara. */
const DEV_SECURE_TIP =
  'Modo desarrollo: `HTTPS=1 npm run dev:lan` y abrilo en el celular con la URL https:// que imprime la terminal.'

/**
 * Escáner por cámara (celular, tablet o webcam) compuesto sobre ZXing.
 *
 * Lee códigos de barras lineales (EAN, UPC, Code 128…); la lectura de QR
 * quedó fuera del flujo de venta. La sesión queda abierta para escanear
 * varios productos seguidos, con debounce para no aceptar el doble disparo
 * del mismo código.
 *
 * Requiere contexto seguro (`https://` o `localhost`): si falta, se explica
 * en pantalla en vez de fallar de forma opaca al pedir el permiso.
 */
export default function ScannerModal({
  open,
  onClose,
  onScan
}: {
  open: boolean
  onClose: () => void
  onScan: (code: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const lastRef = useRef<{ code: string; at: number } | null>(null)
  const onScanRef = useRef(onScan)

  // Fuera del render: evita leer refs durante el pintado.
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [devTip, setDevTip] = useState(false)
  // Cambia con "Reintentar" para re-ejecutar el arranque (incl. deviceId vacío).
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) {
      controlsRef.current?.stop()
      controlsRef.current = null
      setError(null)
      setFlash(null)
      return
    }

    const video = videoRef.current
    if (!video) return

    // `navigator.mediaDevices` no existe en contexto no seguro: avisar antes
    // de que la cámara falle con un error opaco.
    if (!navigator.mediaDevices?.getUserMedia) {
      setStarting(false)
      if (window.isSecureContext) {
        setError('Este navegador no expone la API de cámara (mediaDevices).')
      } else {
        setError(SECURE_MESSAGE)
        setDevTip(true)
      }
      return
    }

    setStarting(true)
    setDevTip(false)
    setError(null)

    const reader = new BrowserMultiFormatReader(BARCODE_HINTS)
    let cancelled = false

    void reader
      .decodeFromVideoDevice(deviceId ?? undefined, video, (result, _err, controls) => {
        if (cancelled) return
        controlsRef.current = controls
        setStarting(false)

        if (!result) return
        const code = result.getText().trim()
        if (!code) return

        const now = Date.now()
        const last = lastRef.current
        if (last && last.code === code && now - last.at < DEBOUNCE_MS) return
        lastRef.current = { code, at: now }

        setFlash(code)
        window.setTimeout(() => setFlash(null), 1200)
        onScanRef.current(code)
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        return BrowserMultiFormatReader.listVideoInputDevices()
          .then((all) => setDevices(all))
          .catch(() => setDevices([]))
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setStarting(false)
        const message = String((cause as Error)?.message ?? cause ?? '')
        const friendly = CAMERA_ERRORS.find(([pattern]) => pattern.test(message))?.[1]
        if (!navigator.mediaDevices?.getUserMedia && !window.isSecureContext) {
          setError(SECURE_MESSAGE)
          setDevTip(true)
          return
        }
        setError(
          friendly ??
            (window.isSecureContext
              ? 'No se pudo iniciar la cámara. Revisa permisos y vuelve a intentar.'
              : SECURE_MESSAGE)
        )
        setDevTip(import.meta.env.DEV && message.includes('mediaDevices'))
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [open, deviceId, attempt])

  const close = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    onClose()
  }, [onClose])

  return (
    <Modal
      open={open}
      onClose={close}
      title="Escanear código de barras"
      description="Enfoca el código (EAN, UPC, Code 128…) con la cámara. La sesión queda abierta para escanear varios seguidos."
      size="lg"
    >
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-xl border border-line bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div
            className={cn(
              'pointer-events-none absolute inset-8 rounded-2xl border-2 transition-colors',
              flash ? 'border-brand-400' : 'border-white/60'
            )}
          />
          {flash ? (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/60 px-3 py-2">
              <div className="flex items-center gap-2 rounded-lg bg-brand/90 px-3 py-1.5 font-mono text-[11px] font-semibold text-white">
                <CheckCircle2 className="size-4" />
                {flash}
              </div>
            </div>
          ) : null}
          {starting && !error ? (
            <div className="absolute inset-0 grid place-items-center bg-black/60 text-white">
              <div className="flex items-center gap-2 text-[12px] font-medium">
                <Loader2 className="size-4 animate-spin" />
                Iniciando cámara…
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-[11px] font-medium text-danger"
          >
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 space-y-1">
              {error}
              {devTip ? <span className="block text-[10px] text-muted">{DEV_SECURE_TIP}</span> : null}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDeviceId(undefined)
                setAttempt((value) => value + 1)
              }}
              icon={<Camera className="size-3.5" />}
            >
              Reintentar
            </Button>
          </div>
        ) : null}

        {devices.length > 1 ? (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Cámara</p>
            <Select
              value={deviceId ?? ''}
              onChange={(event) => setDeviceId(event.target.value || undefined)}
              className="h-9 text-[12px]"
            >
              <option value="">Automática</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Cámara ${devices.indexOf(device) + 1}`}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[10px] leading-relaxed text-muted">
            En el celular, abre el POS desde la URL de producción con https:// para habilitar la cámara.
          </p>
          <Button size="sm" onClick={close} icon={<X className="size-4" />}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
