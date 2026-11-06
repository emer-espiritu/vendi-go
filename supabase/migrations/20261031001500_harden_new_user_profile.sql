-- =============================================================================
-- VendiGo · 0015 · Endurecimiento del alta de perfiles
--
-- `handle_new_user()` asignaba el rol leyendo `raw_user_meta_data->>'role'`.
-- Ese metadata lo controla el cliente que se registra: bastaba enviar
-- `{"role": "administrador"}` para obtener privilegios de administrador.
--
-- Ahora el perfil nace siempre como `cajero` e inactivo. La cuenta solo queda
-- operativa cuando un administrador le asigna rol y la activa. `service_role`
-- (seed y panel de Supabase) sigue pudiendo hacerlo: el guard de privilegios
-- solo restringe sesiones de usuario.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, email, full_name, phone, role_code, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'usuario'), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'cajero',
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
        updated_at = now();

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Crea el perfil de un usuario de Auth. Ignora el rol del metadata y lo deja inactivo hasta que un administrador lo habilite.';
