-- =============================================================================
-- VendiGo · 0010 · Storage: imágenes de productos, logos y documentos
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
  ('logos', 'logos', true, 2097152,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('documents', 'documents', false, 10485760,
    array['application/pdf', 'application/xml', 'text/plain', 'text/xml'])
on conflict (id) do nothing;

-- Lectura pública de imágenes de catálogo.
drop policy if exists vendigo_product_images_read on storage.objects;
create policy vendigo_product_images_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists vendigo_logos_read on storage.objects;
create policy vendigo_logos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'logos');

-- Escritura: solo quien administra el catálogo.
drop policy if exists vendigo_product_images_write on storage.objects;
create policy vendigo_product_images_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'product-images'
    and public.has_permission('products', 'update')
  )
  with check (
    bucket_id = 'product-images'
    and public.has_permission('products', 'update')
  );

drop policy if exists vendigo_logos_write on storage.objects;
create policy vendigo_logos_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'logos'
    and public.has_permission('settings', 'update')
  )
  with check (
    bucket_id = 'logos'
    and public.has_permission('settings', 'update')
  );

-- Documentos privados: lectura autenticada, escritura administrativa.
drop policy if exists vendigo_documents_read on storage.objects;
create policy vendigo_documents_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents');

drop policy if exists vendigo_documents_write on storage.objects;
create policy vendigo_documents_write on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and public.has_permission('settings', 'update'))
  with check (bucket_id = 'documents' and public.has_permission('settings', 'update'));
