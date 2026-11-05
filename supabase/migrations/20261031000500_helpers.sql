-- =============================================================================
-- VendiGo · 0005 · Helpers de autorización, numeración y auditoría
-- =============================================================================

create or replace function public.current_role_code()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role_code
  from public.profiles p
  where p.id = auth.uid()
    and p.active
    and p.deleted_at is null
$$;

create or replace function public.has_permission(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.role_permissions rp
    join public.permissions perm on perm.code = rp.permission_code
    where rp.role_code = public.current_role_code()
      and perm.module = p_module
      and perm.action = p_action
  );
$$;

create or replace function public.assert_permission(p_module text, p_action text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_module, p_action) then
    raise exception 'No tienes permiso para % en el módulo %', p_action, p_module
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.default_warehouse_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select w.id
  from public.warehouses w
  where w.active
    and w.deleted_at is null
  order by w.is_default desc, w.created_at
  limit 1
$$;

create or replace function public.log_audit(
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_logs(user_id, action, entity, entity_id, old_data, new_data)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_old_data, p_new_data);
$$;

create or replace function public.register_login()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
     set last_access_at = now()
   where id = auth.uid();

  perform public.log_audit('login', 'auth', auth.uid()::text, null, jsonb_build_object('at', now()));
end;
$$;

-- Numeración atómica por serie. Evita duplicados con lock de fila.
create or replace function public.next_document_number(
  p_doc_type public.document_type,
  p_series text default null
)
returns table (series text, number text, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_series_id uuid;
  v_series text;
  v_number bigint;
begin
  select ds.id, ds.series
    into v_series_id, v_series
  from public.document_series ds
  where ds.doc_type = p_doc_type
    and ds.active
    and (p_series is null or ds.series = p_series)
  order by ds.series
  limit 1;

  if v_series_id is null then
    raise exception 'No existe una serie activa para el documento %', p_doc_type
      using errcode = 'P0001';
  end if;

  insert into public.document_sequences(series_id, current_number)
  values (v_series_id, 0)
  on conflict (series_id) do nothing;

  update public.document_sequences
     set current_number = current_number + 1,
         updated_at = now()
   where series_id = v_series_id
  returning current_number into v_number;

  series := v_series;
  number := lpad(v_number::text, 8, '0');
  code := v_series || '-' || number;
  return next;
end;
$$;

-- Trigger: crea el perfil cuando Supabase Auth registra un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.app_role;
begin
  begin
    v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'cajero');
  exception when others then
    v_role := 'cajero';
  end;

  insert into public.profiles(id, email, full_name, phone, role_code)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'usuario'), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    v_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Trigger genérico de auditoría para cambios de fila.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity text := tg_table_name;
  v_entity_id text;
  v_old jsonb;
  v_new jsonb;
begin
  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old);
    v_new := null;
    v_entity_id := coalesce(v_old ->> 'id', '');
  else
    v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
    v_new := to_jsonb(new);
    v_entity_id := coalesce(v_new ->> 'id', '');
  end if;

  perform public.log_audit(lower(tg_op), v_entity, v_entity_id, v_old, v_new);
  return coalesce(new, old);
end;
$$;

-- Sincroniza el precio espejo del producto cuando cambia la presentación base.
create or replace function public.sync_base_presentation_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_base then
    update public.products
       set price = new.price,
           updated_at = now()
     where id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists product_presentations_sync_price on public.product_presentations;
create trigger product_presentations_sync_price
after insert or update of price, is_base on public.product_presentations
for each row execute function public.sync_base_presentation_price();

-- Auditoría de tablas sensibles.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'products', 'product_presentations', 'sales', 'inventory_movements',
    'cash_sessions', 'cash_movements', 'sale_returns', 'stock_adjustments'
  ] loop
    execute format('drop trigger if exists %I_audit on public.%I', tbl, tbl);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      tbl, tbl
    );
  end loop;
end $$;
