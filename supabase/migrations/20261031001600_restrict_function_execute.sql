-- =============================================================================
-- VendiGo · 0016 · Superficie RPC mínima
--
-- `grant execute on all functions in schema public to authenticated` dejaba
-- invocables por cualquier usuario autenticado funciones que no son API:
--
--   * `next_document_number` quema correlativos (abre huecos en la numeración).
--   * `log_audit` permite insertar entradas de auditoría falsas.
--   * Los helpers de triggers y de seed escriben datos sin validar permisos.
--
-- PostgREST expone toda función ejecutable en `public` como RPC, así que se
-- revoca el acceso masivo y se concede solo lo que la aplicación invoca: los
-- helpers que evalúan las políticas RLS y las RPC de negocio, que validan
-- permisos con `assert_permission`. Las llamadas internas entre funciones
-- `security definer` no dependen de estos grants: se ejecutan como owner.
-- =============================================================================

revoke all on all functions in schema public from public, anon, authenticated;

-- Las migraciones futuras nacen cerradas: hay que conceder explícitamente.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Helpers invocados desde las políticas RLS
-- -----------------------------------------------------------------------------
grant execute on function public.current_role_code() to authenticated;
grant execute on function public.has_permission(text, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_view_sale(uuid) to authenticated;
grant execute on function public.can_view_cash_session(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC de negocio invocadas por la aplicación
-- -----------------------------------------------------------------------------
grant execute on function public.register_login() to authenticated;

grant execute on function public.create_sale(jsonb) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;

grant execute on function public.open_cash_session(uuid, numeric) to authenticated;
grant execute on function public.register_cash_movement(uuid, public.cash_movement_type, numeric, text) to authenticated;
grant execute on function public.close_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.record_expense(jsonb) to authenticated;

grant execute on function public.create_purchase(jsonb) to authenticated;
grant execute on function public.receive_purchase(uuid) to authenticated;
grant execute on function public.void_purchase(uuid, text) to authenticated;
grant execute on function public.create_purchase_return(jsonb) to authenticated;

grant execute on function public.create_stock_adjustment(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.create_sale_return(jsonb) to authenticated;
grant execute on function public.approve_sale_return(uuid, boolean) to authenticated;
