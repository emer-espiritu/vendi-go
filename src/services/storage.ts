import { supabase } from '@/lib/supabase'
import { fail } from './errors'

/** Techo de tamaño por imagen, 8 MB. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

/**
 * Sube una imagen (data URL del formulario) al bucket público
 * `product-images` y devuelve su URL pública.
 *
 * La conversión va por `fetch(data:)` → `blob()`: convierte sin recorrer el
 * base64 carácter a carácter en el hilo principal. El archivo se guarda con
 * un nombre aleatorio para no colisionar entre productos y evitar cachear
 * imágenes reemplazadas.
 */
export async function uploadProductImage(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl

  const blob = await fetch(dataUrl)
    .then((response) => response.blob())
    .catch(() => null)

  if (!blob || !blob.type) throw new Error('La imagen no tiene un formato válido.')

  const extension = EXTENSIONS[blob.type]
  if (!extension) {
    throw new Error('Formato de imagen no soportado. Usa PNG, JPG, WebP o GIF.')
  }

  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error('La imagen es demasiado grande (máximo 8 MB).')
  }
  const path = `products/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from('product-images').upload(path, blob, {
    cacheControl: '31536000',
    contentType: blob.type,
    upsert: false
  })
  if (error) fail(error)

  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}
