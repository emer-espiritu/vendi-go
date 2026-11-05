import { supabase } from '@/lib/supabase'
import { unwrap } from './errors'
import type { Database } from '@/types/database'
import type { Role } from '@/types'
import type { CustomerInput, SupplierInput } from './types'

/** Cambia el rol de un perfil. RLS exige el permiso `roles.update`. */
export async function updateUserRole(id: string, role: Role): Promise<void> {
  unwrap(await supabase.from('profiles').update({ role_code: role }).eq('id', id))
}

export async function createCustomer(input: CustomerInput): Promise<void> {
  unwrap(
    await supabase.from('customers').insert({
      name: input.name.trim(),
      doc_type: input.docType,
      doc_number: input.docNumber.trim() || null,
      email: input.email.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      segment: input.segment
    })
  )
}

export async function updateCustomer(id: string, patch: Partial<CustomerInput>): Promise<void> {
  const payload: Database['public']['Tables']['customers']['Update'] = {}
  if (patch.name !== undefined) payload.name = patch.name.trim()
  if (patch.docType !== undefined) payload.doc_type = patch.docType
  if (patch.docNumber !== undefined) payload.doc_number = patch.docNumber.trim() || null
  if (patch.email !== undefined) payload.email = patch.email.trim()
  if (patch.phone !== undefined) payload.phone = patch.phone.trim()
  if (patch.address !== undefined) payload.address = patch.address.trim()
  if (patch.segment !== undefined) payload.segment = patch.segment
  if (Object.keys(payload).length === 0) return

  unwrap(await supabase.from('customers').update(payload).eq('id', id))
}

export async function deleteCustomer(id: string): Promise<void> {
  unwrap(
    await supabase
      .from('customers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  )
}

export async function createSupplier(input: SupplierInput): Promise<void> {
  unwrap(
    await supabase.from('suppliers').insert({
      name: input.name.trim(),
      ruc: input.ruc.trim() || null,
      contact: input.contact.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      category: input.category.trim(),
      rating: input.rating,
      active: input.active
    })
  )
}

export async function updateSupplier(id: string, patch: Partial<SupplierInput>): Promise<void> {
  const payload: Database['public']['Tables']['suppliers']['Update'] = {}
  if (patch.name !== undefined) payload.name = patch.name.trim()
  if (patch.ruc !== undefined) payload.ruc = patch.ruc.trim() || null
  if (patch.contact !== undefined) payload.contact = patch.contact.trim()
  if (patch.phone !== undefined) payload.phone = patch.phone.trim()
  if (patch.email !== undefined) payload.email = patch.email.trim()
  if (patch.address !== undefined) payload.address = patch.address.trim()
  if (patch.category !== undefined) payload.category = patch.category.trim()
  if (patch.rating !== undefined) payload.rating = patch.rating
  if (patch.active !== undefined) payload.active = patch.active
  if (Object.keys(payload).length === 0) return

  unwrap(await supabase.from('suppliers').update(payload).eq('id', id))
}

export async function deleteSupplier(id: string): Promise<void> {
  unwrap(
    await supabase
      .from('suppliers')
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq('id', id)
  )
}
