import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * `HTTPS=1 npm run dev:lan` sirve el dev por https:// con un certificado
 * autofirmado y lo expone en la red local. El navegador móvil exige un
 * contexto seguro para dar acceso a la cámara: es la única forma de probar
 * el escáner de códigos desde el celular antes del despliegue con https.
 *
 * `npm run dev` no cambia: http en localhost es contexto seguro para la PC,
 * donde la entrada es el lector de códigos (cable o inalámbrico/HID).
 */
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    ...(process.env.HTTPS === '1' ? [basicSsl()] : [])
  ],
  server: {
    host: process.env.HTTPS === '1',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
