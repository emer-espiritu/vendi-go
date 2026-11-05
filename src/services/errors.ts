/**
 * Traducción de errores de PostgREST/Postgres a mensajes accionables en
 * español. Las RPC ya lanzan mensajes legibles; las violaciones de
 * restricciones llegan en inglés y con el nombre técnico de la restricción.
 */

type ErrorLike = { message?: string; details?: string; hint?: string } | null | undefined

const FRIENDLY: [RegExp, string][] = [
  [/products_sku_key/, 'Ya existe un producto con ese SKU.'],
  [/products_barcode_unique/, 'Ese código de barras ya está registrado en otro producto.'],
  [
    /product_presentations_product_id_label_key/,
    'Hay dos presentaciones con la misma etiqueta en este producto.'
  ],
  [/product_presentations_barcode_unique/, 'Ese código de barras de presentación ya está en uso.'],
  [/customers_doc_unique/, 'Ya existe un cliente con ese documento.'],
  [/suppliers_ruc_key/, 'Ya existe un proveedor con ese RUC.'],
  [/categories_name_key/, 'Ya existe una categoría con ese nombre.'],
  [/roles_pkey|roles_code_key/, 'Ese rol ya existe.'],
  [/permissions_pkey|permissions_code_key/, 'Ese permiso ya existe.'],
  [/cash_sessions_open_register/, 'La caja ya tiene una sesión abierta.'],
  [/document_sequences_doc_type_series_key/, 'No se pudo generar el correlativo del documento.'],
  [/profiles_email_idx|profiles_email_key/, 'Ya existe un usuario con ese correo.'],
  [/new row violates row-level security policy/, 'No tienes permisos para realizar esta operación.'],
  [/permission denied for/, 'No tienes permisos para realizar esta operación.'],
  [/JWT expired/, 'Tu sesión expiró. Vuelve a iniciar sesión.'],
  [/Failed to fetch|NetworkError|fetch failed/, 'No se pudo conectar con el servidor. Revisa tu conexión.']
]

/** Lanza un Error legible a partir de la respuesta de Supabase. */
export function fail(error: ErrorLike): never {
  const raw = error?.message?.trim() || error?.details?.trim() || 'Ocurrió un error inesperado'
  for (const [pattern, friendly] of FRIENDLY) {
    if (pattern.test(raw)) throw new Error(friendly)
  }
  throw new Error(raw)
}

/** Devuelve `data` o lanza el error traducido. */
export function unwrap<T>(result: { data: T; error: ErrorLike }): T {
  if (result.error) fail(result.error)
  return result.data
}

/** Convierte cualquier valor lanzado en un mensaje para la UI. */
export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'Ocurrió un error inesperado'
}
