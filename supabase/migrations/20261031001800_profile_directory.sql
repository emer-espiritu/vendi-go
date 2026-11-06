-- =============================================================================
-- VendiGo · 0018 · El perfil deja de ser un directorio público
--
-- `profiles_select` permitía a cualquier usuario autenticado leer todos los
-- perfiles, con email, teléfono y último acceso incluidos. Esos datos solo los
-- necesita la administración de usuarios; el resto de la aplicación únicamente
-- mapea `user_id` a un nombre.
--
-- La tabla queda restringida al perfil propio o a quien tenga `roles.view`, y
-- se expone `v_profile_directory` con el mínimo imprescindible. La vista corre
-- como owner a propósito: aplica el recorte por columnas en lugar del RLS de la
-- tabla y filtra las bajas lógicas. No agregar email, teléfono ni actividad.
-- =============================================================================

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_permission('roles', 'view'));

create or replace view public.v_profile_directory
with (security_invoker = false)
as
select
  p.id,
  p.full_name,
  p.role_code,
  p.avatar_url,
  p.active
from public.profiles p
where p.deleted_at is null;

-- `anon` no tiene sesión ni acceso a tablas públicas: el login usa GoTrue.
revoke all on public.v_profile_directory from public, anon;
grant select on public.v_profile_directory to authenticated;

comment on view public.v_profile_directory is
  'Directorio mínimo del personal para mapear user_id a nombre. No expone email, teléfono ni actividad.';
