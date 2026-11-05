import { supabase } from '@/lib/supabase'
import type { Category, Presentation } from '@/types'
import { fail, unwrap } from './errors'
import type { ProductInput } from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PresentationRow {
  id: string
  label: string
}

/** Índice único parcial sobre `is_base`: a lo sumo una presentación base por producto. */
async function clearBasePresentation(productId: string): Promise<void> {
  unwrap(
    await supabase
      .from('product_presentations')
      .update({ is_base: false })
      .eq('product_id', productId)
  )
}

function productColumns(input: ProductInput) {
  return {
    sku: input.sku.trim(),
    name: input.name.trim(),
    barcode: input.barcode.trim() || null,
    category_id: input.categoryId || null,
    supplier_id: input.supplierId || null,
    base_unit: input.baseUnit,
    purchase_unit: input.purchaseUnit ?? null,
    pack_size: input.purchaseUnit ? (input.packSize ?? null) : null,
    price: input.price,
    cost: input.cost,
    min_stock: input.minStock,
    image_url: input.image ?? null,
    emoji: input.emoji || '📦',
    expires_at: input.expiresAt ?? null,
    active: input.active
  }
}

/**
 * Sincroniza las presentaciones del producto.
 *
 * Las presentaciones nuevas llegan con ids sintéticos (`base`, `saco`,
 * `half-saco`, `docena`), por lo que primero se busca la fila por UUID y, si no
 * existe, por etiqueta. Las que desaparecen del formulario se desactivan en
 * lugar de borrarse para no romper las referencias de `sale_items`.
 *
 * El índice único parcial sobre `is_base` obliga a liberar la base anterior
 * antes de asignar la nueva, así que la operación no puede ser atómica desde
 * el navegador. Para que un fallo a mitad no deje el producto sin precio base
 * se recuerda qué fila era la base y, ante un error, se restaura antes de
 * propagar. La corrección definitiva sería una RPC transaccional en la base.
 */
async function syncPresentations(productId: string, presentations: Presentation[]) {
  const existing = unwrap(
    await supabase
      .from('product_presentations')
      .select('id, label, is_base')
      .eq('product_id', productId)
  ) as (PresentationRow & { is_base: boolean })[]

  const previousBaseId = existing.find((row) => row.is_base)?.id ?? null
  const byId = new Map(existing.map((row) => [row.id, row]))
  const byLabel = new Map(existing.map((row) => [row.label, row]))
  const kept = new Set<string>()
  let baseRowId: string | null = null

  // Libera el índice único de presentación base antes de reasignarlo.
  await clearBasePresentation(productId)

  try {
    for (let index = 0; index < presentations.length; index += 1) {
      const item = presentations[index]
      const match = (UUID_RE.test(item.id) ? byId.get(item.id) : undefined) ?? byLabel.get(item.label)
      const payload = {
        product_id: productId,
        label: item.label,
        factor: item.factor,
        price: item.price,
        barcode: item.barcode?.trim() || null,
        // La base se asigna al final, con todas las filas ya sincronizadas.
        is_base: false,
        sort_order: index,
        active: true
      }

      if (match) {
        unwrap(
          await supabase.from('product_presentations').update(payload).eq('id', match.id).select('id')
        )
        kept.add(match.id)
        if (item.factor === 1) baseRowId = match.id
      } else {
        const created = unwrap(
          await supabase.from('product_presentations').insert(payload).select('id').single()
        ) as { id: string }
        kept.add(created.id)
        if (item.factor === 1) baseRowId = created.id
      }
    }

    const stale = existing.filter((row) => !kept.has(row.id)).map((row) => row.id)
    if (stale.length > 0) {
      unwrap(
        await supabase.from('product_presentations').update({ active: false }).in('id', stale)
      )
    }
  } catch (cause) {
    // Restaura la base previa (si sobrevivió) antes de propagar el error, para
    // no dejar el producto sin precio en la unidad base.
    if (previousBaseId && kept.has(previousBaseId) && previousBaseId !== baseRowId) {
      unwrap(
        await supabase
          .from('product_presentations')
          .update({ is_base: true })
          .eq('id', previousBaseId)
      )
    }
    throw cause
  }

  if (baseRowId) {
    unwrap(
      await supabase
        .from('product_presentations')
        .update({ is_base: true })
        .eq('id', baseRowId)
        .select('id')
    )
  }
}

/** Ajusta el inventario del almacén por defecto usando la RPC autorizada. */
export async function adjustStock(
  productId: string,
  delta: number,
  reason: string
): Promise<void> {
  if (!delta) return
  const { error } = await supabase.rpc('create_stock_adjustment', {
    p_product_id: productId,
    p_qty: delta,
    p_reason: reason
  })
  if (error) fail(error)
}

export async function createProduct(input: ProductInput): Promise<string> {
  const created = unwrap(
    await supabase.from('products').insert(productColumns(input)).select('id').single()
  ) as { id: string }

  await syncPresentations(created.id, input.presentations)
  await adjustStock(created.id, input.stock, 'Stock inicial del producto')
  return created.id
}

export async function updateProduct(id: string, patch: ProductInput): Promise<void> {
  const { data: current, error } = await supabase
    .from('products')
    .select('id')
    .eq('id', id)
    .single()
  if (error) fail(error)
  if (!current) throw new Error('El producto ya no existe.')

  const delta = patch.stock - (await currentStock(id))

  unwrap(await supabase.from('products').update(productColumns(patch)).eq('id', id).select('id'))
  await syncPresentations(id, patch.presentations)
  await adjustStock(id, delta, 'Actualización de producto desde el catálogo')
}

async function currentStock(productId: string): Promise<number> {
  const rows = unwrap(
    await supabase.from('inventory').select('stock').eq('product_id', productId)
  ) as { stock: number }[]
  return rows.reduce((total, row) => total + Number(row.stock ?? 0), 0)
}

export async function deleteProduct(id: string): Promise<void> {
  // Baja lógica: conserva ventas y movimientos históricos.
  unwrap(
    await supabase
      .from('products')
      .update({ active: false, deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
  )
}

export async function addCategory(name: string, emoji: string, color: string): Promise<Category> {
  const created = unwrap(
    await supabase
      .from('categories')
      .insert({ name: name.trim(), emoji: emoji || '📦', color })
      .select('id, name, emoji, color')
      .single()
  ) as Category
  return created
}

export interface CategoryRow extends Category {
  active?: boolean
}
