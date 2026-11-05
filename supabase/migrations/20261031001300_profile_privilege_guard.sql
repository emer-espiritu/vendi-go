-- =============================================================================
-- VendiGo · 0013 · Protección de columnas privilegiadas en `profiles`
--
-- La política `profiles_update_self` permite a cada usuario editar su propio
-- perfil, pero RLS no puede comparar el valor anterior con el nuevo. Sin este
-- trigger, un cajero podría enviar `role_code = 'administrador'` en un PATCH y
-- escalar privilegios. El trigger bloquea esos cambios salvo que el usuario
-- tenga el permiso `roles.update`.
-- =============================================================================

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Sin sesión (service_role, migraciones, seeds) o con permiso de roles: sin restricción.
  if auth.uid() is null or public.has_permission('roles', 'update') then
    return new;
  end if;

  if new.role_code is distinct from old.role_code
     or new.active is distinct from old.active
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'No tienes permiso para cambiar tu rol o estado'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
before update on public.profiles
for each row execute function public.guard_profile_privileges();
