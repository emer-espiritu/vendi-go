-- =============================================================================
-- VendiGo · 0012 · Anulación de compras e integridad de gastos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Anular orden de compra
--
-- Solo se anulan órdenes pendientes. Una orden ya recibida movió inventario y
-- costo promedio: revertirla exige una devolución de compra trazable, no un
-- borrado silencioso.
-- -----------------------------------------------------------------------------
create or replace function public.void_purchase(
  p_purchase_id uuid,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
begin
  perform public.assert_permission('purchases', 'delete');

  select * into v_order from public.purchase_orders where id = p_purchase_id for update;
  if not found then
    raise exception 'La orden de compra no existe' using errcode = 'P0001';
  end if;
  if v_order.status = 'anulada' then
    raise exception 'La orden ya está anulada' using errcode = 'P0001';
  end if;
  if v_order.status <> 'pendiente' then
    raise exception 'La orden ya fue recibida: registra una devolución de compra para revertir el stock'
      using errcode = 'P0001';
  end if;

  update public.purchase_orders
     set status = 'anulada',
         notes = concat_ws(' · ', nullif(notes, ''), nullif(p_reason, '')),
         deleted_at = now(),
         updated_at = now()
   where id = p_purchase_id;

  perform public.log_audit('void', 'purchase_order', p_purchase_id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'anulada', 'reason', p_reason));

  return jsonb_build_object('purchase_id', p_purchase_id, 'status', 'anulada');
end;
$$;

revoke all on function public.void_purchase(uuid, text) from anon;
grant execute on function public.void_purchase(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Integridad: el gasto referencia una sesión de caja existente.
-- (La tabla se creó en 0003, antes de que existiera cash_sessions en 0004.)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'expenses_cash_session_fk'
      and conrelid = 'public.expenses'::regclass
  ) then
    alter table public.expenses
      add constraint expenses_cash_session_fk
      foreign key (cash_session_id) references public.cash_sessions(id) on delete set null;
  end if;
end $$;
