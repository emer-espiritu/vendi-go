-- =============================================================================
-- VendiGo · 0017 · El borrado lógico exige permiso de borrado
--
-- La aplicación nunca ejecuta DELETE: "eliminar" es un UPDATE que setea
-- `deleted_at`. Ese UPDATE solo pasa por la política `*_update`, así que el
-- permiso `*_delete` nunca se evaluaba. Un almacenero (products.update sin
-- products.delete) podía borrar productos y proveedores desde el cliente.
--
-- Este trigger cierra el hueco en Postgres: la transición `deleted_at` de NULL
-- a un valor exige el permiso `<módulo>.delete`. Las bajas hechas sin sesión
-- (service_role, seeds, migraciones) siguen permitidas.
-- =============================================================================

create or replace function public.guard_soft_delete_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_module text;
begin
  -- No es una baja (ni ya estaba dada de baja): no aplica.
  if new.deleted_at is null or old.deleted_at is not null then
    return new;
  end if;

  -- Sin sesión: service_role, seeds y migraciones.
  if auth.uid() is null then
    return new;
  end if;

  v_module := case tg_table_name
    when 'products' then 'products'
    when 'categories' then 'products'
    when 'customers' then 'customers'
    when 'suppliers' then 'suppliers'
  end;

  if v_module is null or not public.has_permission(v_module, 'delete') then
    raise exception 'No tienes permiso para eliminar en %', tg_table_name
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_soft_delete_privileges on public.products;
create trigger guard_soft_delete_privileges
before update of deleted_at on public.products
for each row execute function public.guard_soft_delete_privileges();

drop trigger if exists guard_soft_delete_privileges on public.categories;
create trigger guard_soft_delete_privileges
before update of deleted_at on public.categories
for each row execute function public.guard_soft_delete_privileges();

drop trigger if exists guard_soft_delete_privileges on public.customers;
create trigger guard_soft_delete_privileges
before update of deleted_at on public.customers
for each row execute function public.guard_soft_delete_privileges();

drop trigger if exists guard_soft_delete_privileges on public.suppliers;
create trigger guard_soft_delete_privileges
before update of deleted_at on public.suppliers
for each row execute function public.guard_soft_delete_privileges();
