-- =============================================================================
-- VendiGo · 0020 · Crédito de clientes y cuentas por cobrar
--
-- El crédito no es una columna que se resta desde el cliente: es un libro de
-- movimientos (`cargo` cuando se fía, `abono` cuando paga) y el saldo se
-- deriva de él. El límite sí es un dato del cliente.
--
-- Reglas de caja: una venta a crédito NO entra al efectivo esperado del turno.
-- `sales_total` sigue sumando el total (es venta devengada), pero
-- `expected_total` y `cash_movements('venta')` solo reciben la parte cobrada
-- con dinero real. Sin eso, el arqueo cierra con un faltante fantasma.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Límite de crédito en el cliente (0 = sin crédito)
-- -----------------------------------------------------------------------------
alter table public.customers
  add column if not exists credit_limit numeric(14, 2) not null default 0
  check (credit_limit >= 0);

comment on column public.customers.credit_limit is
  'Monto máximo de deuda acumulada permitido. 0 deshabilita el crédito.';

-- -----------------------------------------------------------------------------
-- 2. Método de pago `credito`
-- -----------------------------------------------------------------------------
alter table public.payment_methods drop constraint if exists payment_methods_kind_check;
alter table public.payment_methods add constraint payment_methods_kind_check
  check (kind in ('efectivo', 'tarjeta', 'billetera', 'transferencia', 'credito'));

insert into public.payment_methods (code, name, kind, requires_reference) values
  ('credito', 'Crédito', 'credito', false)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Libro de movimientos del crédito
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.credit_movement_type as enum ('cargo', 'abono');
exception when duplicate_object then null; end $$;

create table if not exists public.customer_credit_movements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete restrict,
  sale_return_id uuid references public.sale_returns(id) on delete restrict,
  type public.credit_movement_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method_id uuid references public.payment_methods(id) on delete restrict,
  reference text,
  notes text,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_credit_movements_customer_idx
  on public.customer_credit_movements(customer_id, created_at desc);
create index if not exists customer_credit_movements_sale_idx
  on public.customer_credit_movements(sale_id);

-- Una venta solo puede generar un cargo; el resto son abonos o reversos.
create unique index if not exists customer_credit_movements_cargo_unique
  on public.customer_credit_movements(sale_id)
  where type = 'cargo' and sale_id is not null;

-- -----------------------------------------------------------------------------
-- 4. Saldo por cliente (derivado, nunca editado)
-- -----------------------------------------------------------------------------
create or replace view public.customer_credit_balances
with (security_invoker = true) as
select
  c.id as customer_id,
  coalesce(sum(case m.type when 'cargo' then m.amount else -m.amount end), 0)::numeric(14, 2) as balance,
  coalesce(sum(case when m.type = 'cargo' then m.amount else 0 end), 0)::numeric(14, 2) as charged,
  coalesce(sum(case when m.type = 'abono' then m.amount else 0 end), 0)::numeric(14, 2) as paid,
  max(m.created_at) as last_movement_at
from public.customers c
left join public.customer_credit_movements m on m.customer_id = c.id
where c.deleted_at is null
group by c.id;

-- -----------------------------------------------------------------------------
-- 5. Permisos del módulo `receivables` (cuentas por cobrar)
-- -----------------------------------------------------------------------------
insert into public.permissions (code, module, action, description) values
  ('receivables.view', 'receivables', 'view', 'Ver cuentas por cobrar y saldos'),
  ('receivables.update', 'receivables', 'update', 'Registrar abonos de clientes')
on conflict (code) do nothing;

insert into public.role_permissions (role_code, permission_code)
select r.role_code::public.app_role, p.code
from (values ('administrador'), ('gerente'), ('cajero'), ('supervisor')) as r(role_code)
cross join public.permissions p
where p.code in ('receivables.view', 'receivables.update')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 6. RLS: lectura según permiso; escritura solo por RPC
-- -----------------------------------------------------------------------------
alter table public.customer_credit_movements enable row level security;

drop policy if exists customer_credit_movements_select on public.customer_credit_movements;
create policy customer_credit_movements_select on public.customer_credit_movements
  for select to authenticated
  using (public.has_permission('receivables', 'view'));

-- Supabase concede `all` a `anon` y `authenticated` en tablas nuevas: se
-- retira para que el libro solo se lea y solo lo escriban las RPC.
revoke all on public.customer_credit_movements from public, anon, authenticated;
grant select on public.customer_credit_movements to authenticated;

revoke all on public.customer_credit_balances from public, anon;
grant select on public.customer_credit_balances to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Un cliente con deuda no se puede dar de baja
-- -----------------------------------------------------------------------------
create or replace function public.guard_customer_credit_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.deleted_at is null or old.deleted_at is not null then
    return new;
  end if;

  if exists (
    select 1
    from public.customer_credit_movements
    where customer_id = new.id
    group by customer_id
    having sum(case when type = 'cargo' then amount else -amount end) > 0.009
  ) then
    raise exception 'No se puede eliminar un cliente con saldo pendiente' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_customer_credit_on_delete on public.customers;
create trigger guard_customer_credit_on_delete
before update of deleted_at on public.customers
for each row execute function public.guard_customer_credit_on_delete();

-- -----------------------------------------------------------------------------
-- 8. Registrar un abono (cobranza)
-- -----------------------------------------------------------------------------
create or replace function public.register_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_method text default 'efectivo',
  p_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_method public.payment_methods%rowtype;
  v_session public.cash_sessions%rowtype;
  v_movement_id uuid;
  v_amount numeric(14, 2);
  v_balance numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para registrar un abono' using errcode = '42501';
  end if;

  perform public.assert_permission('receivables', 'update');

  v_amount := round(coalesce(p_amount, 0), 2);
  if v_amount <= 0 then
    raise exception 'El monto del abono debe ser mayor a cero' using errcode = '22023';
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id and deleted_at is null
  for update;

  if not found then
    raise exception 'El cliente no existe' using errcode = 'P0001';
  end if;

  select * into v_method
  from public.payment_methods
  where code = p_method and active;

  if not found then
    raise exception 'Método de pago no válido: %', p_method using errcode = 'P0001';
  end if;
  if v_method.kind = 'credito' then
    raise exception 'Un abono no puede registrarse con crédito' using errcode = '22023';
  end if;

  -- El cliente queda bloqueado arriba: dos abonos simultáneos no pueden
  -- dejar el saldo en negativo.
  select coalesce(sum(case when type = 'cargo' then amount else -amount end), 0)
    into v_balance
  from public.customer_credit_movements
  where customer_id = p_customer_id;

  if v_amount > v_balance + 0.009 then
    raise exception 'El abono (%) supera el saldo pendiente (%)', v_amount, v_balance
      using errcode = '22023';
  end if;

  insert into public.customer_credit_movements(
    customer_id, type, amount, payment_method_id, reference, notes, user_id
  ) values (
    p_customer_id, 'abono', v_amount, v_method.id,
    nullif(p_reference, ''), nullif(p_notes, ''), auth.uid()
  ) returning id into v_movement_id;

  -- Igual que una venta cobrada: el abono se imputa al turno abierto del usuario.
  select * into v_session
  from public.cash_sessions
  where status = 'abierta' and user_id = auth.uid()
  order by opened_at desc
  limit 1
  for update;

  if found then
    insert into public.cash_movements(
      cash_session_id, type, amount, description, reference, user_id
    ) values (
      v_session.id, 'ingreso', v_amount,
      'Abono de ' || v_customer.name, nullif(p_reference, ''), auth.uid()
    );

    update public.cash_sessions
       set expected_total = expected_total + v_amount
     where id = v_session.id;
  end if;

  perform public.log_audit(
    'create', 'customer_credit_payment', v_movement_id::text, null,
    jsonb_build_object('customer_id', p_customer_id, 'amount', v_amount, 'method', p_method)
  );

  return jsonb_build_object(
    'movement_id', v_movement_id,
    'customer_id', p_customer_id,
    'amount', v_amount,
    'balance', round(v_balance - v_amount, 2)
  );
end;
$$;

grant execute on function public.register_customer_payment(uuid, numeric, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. create_sale: acepta la parte a crédito sin inflar el efectivo del turno
-- -----------------------------------------------------------------------------
create or replace function public.create_sale(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_sale_id uuid;
  v_doc public.document_type;
  v_series text;
  v_number text;
  v_code text;
  v_customer_id uuid;
  v_customer_name text;
  v_customer_doc text;
  v_warehouse uuid;
  v_register public.cash_registers%rowtype;
  v_session public.cash_sessions%rowtype;
  v_register_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_pres public.product_presentations%rowtype;
  v_qty numeric(14, 3);
  v_discount numeric(12, 2);
  v_gross numeric(14, 2);
  v_line_discount numeric(14, 2) := 0;
  v_global_discount numeric(14, 2);
  v_discount_total numeric(14, 2);
  v_total numeric(14, 2);
  v_subtotal numeric(14, 2);
  v_tax numeric(14, 2);
  v_profit numeric(14, 2) := 0;
  v_paid numeric(14, 2);
  v_cash_paid numeric(14, 2);
  v_other_paid numeric(14, 2);
  v_cash numeric(14, 2);
  v_credit numeric(14, 2) := 0;
  v_credit_limit numeric(14, 2);
  v_credit_balance numeric(14, 2);
  v_method_id uuid;
  v_payment jsonb;
  v_agg record;
  v_stock_after numeric(14, 3);
  v_tax_rate numeric(5, 4) := 0.18;
  v_idx integer := 0;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para registrar una venta' using errcode = '42501';
  end if;

  perform public.assert_permission('pos', 'create');

  if p_payload is null or jsonb_typeof(p_payload -> 'items') <> 'array'
     or jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'La venta no tiene productos' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload -> 'payments') <> 'array'
     or jsonb_array_length(p_payload -> 'payments') = 0 then
    raise exception 'La venta no tiene pagos' using errcode = '22023';
  end if;

  v_doc := coalesce((p_payload ->> 'doc_type')::public.document_type, 'boleta');

  -- Caja y sesión abierta: obligatorias para afectar el efectivo del turno.
  if (p_payload ->> 'cash_session_id') is not null then
    select * into v_session
    from public.cash_sessions
    where id = (p_payload ->> 'cash_session_id')::uuid
    for update;

    if not found or v_session.status <> 'abierta' then
      raise exception 'La sesión de caja no existe o ya está cerrada' using errcode = 'P0001';
    end if;
    if v_session.user_id <> v_user and not public.has_permission('cash', 'view_all') then
      raise exception 'Esta caja pertenece a otro cajero' using errcode = '42501';
    end if;
  else
    v_register_id := (p_payload ->> 'cash_register_id')::uuid;
    select * into v_session
    from public.cash_sessions
    where status = 'abierta'
      and user_id = v_user
      and (v_register_id is null or cash_register_id = v_register_id)
    order by opened_at desc
    limit 1
    for update;

    if not found then
      raise exception 'Debes abrir una caja antes de cobrar' using errcode = 'P0001';
    end if;
  end if;

  select * into v_register
  from public.cash_registers
  where id = v_session.cash_register_id;

  v_warehouse := coalesce(
    nullif(p_payload ->> 'warehouse_id', '')::uuid,
    v_register.warehouse_id,
    public.default_warehouse_id()
  );

  if v_warehouse is null then
    raise exception 'No hay un almacén configurado' using errcode = 'P0001';
  end if;

  v_customer_id := nullif(p_payload ->> 'customer_id', '')::uuid;
  if v_customer_id is not null then
    select name, coalesce(doc_number, '—')
      into v_customer_name, v_customer_doc
    from public.customers
    where id = v_customer_id and deleted_at is null;
    if not found then
      raise exception 'El cliente no existe' using errcode = 'P0001';
    end if;
  else
    v_customer_name := coalesce(nullif(p_payload ->> 'customer_name', ''), 'Clientes varios');
    v_customer_doc := coalesce(nullif(p_payload ->> 'customer_doc', ''), '—');
  end if;

  create temporary table if not exists pg_temp.sale_lines (
    idx integer,
    product_id uuid,
    presentation_id uuid,
    name text,
    sku text,
    base_unit public.base_unit,
    presentation_label text,
    factor numeric(14, 3),
    qty numeric(14, 3),
    base_qty numeric(14, 3),
    unit_price numeric(12, 2),
    discount numeric(12, 2),
    subtotal numeric(14, 2),
    unit_cost numeric(12, 4),
    total_cost numeric(14, 2),
    profit numeric(14, 2)
  ) on commit drop;
  truncate pg_temp.sale_lines;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items') loop
    v_idx := v_idx + 1;
    v_qty := coalesce((v_item ->> 'qty')::numeric, 0);
    v_discount := coalesce((v_item ->> 'discount')::numeric, 0);

    if v_qty <= 0 then
      raise exception 'La cantidad de cada producto debe ser mayor a cero' using errcode = '22023';
    end if;
    if v_discount < 0 then
      raise exception 'El descuento no puede ser negativo' using errcode = '22023';
    end if;

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and active
      and deleted_at is null;

    if not found then
      raise exception 'Producto inexistente o inactivo: %', (v_item ->> 'product_id')
        using errcode = 'P0001';
    end if;

    select * into v_pres
    from public.product_presentations
    where id = (v_item ->> 'presentation_id')::uuid
      and product_id = v_product.id
      and active;

    if not found then
      raise exception 'La presentación no pertenece al producto %', v_product.name
        using errcode = 'P0001';
    end if;

    if v_discount > round(v_qty * v_pres.price, 2) then
      raise exception 'El descuento de % supera el importe de la línea', v_product.name
        using errcode = '22023';
    end if;

    insert into pg_temp.sale_lines values (
      v_idx,
      v_product.id,
      v_pres.id,
      v_product.name,
      v_product.sku,
      v_product.base_unit,
      v_pres.label,
      v_pres.factor,
      v_qty,
      round(v_qty * v_pres.factor, 3),
      v_pres.price,
      v_discount,
      round(v_qty * v_pres.price - v_discount, 2),
      v_product.cost,
      round(v_qty * v_pres.factor * v_product.cost, 2),
      round(v_qty * (v_pres.price - v_product.cost * v_pres.factor) - v_discount, 2)
    );
  end loop;

  -- Bloquea inventario y valida stock antes de escribir.
  for v_agg in
    select product_id, sum(base_qty) as qty, max(name) as name
    from pg_temp.sale_lines
    group by product_id
  loop
    select stock into v_stock_after
    from public.inventory
    where product_id = v_agg.product_id and warehouse_id = v_warehouse
    for update;

    if v_stock_after is null or v_stock_after < v_agg.qty then
      raise exception 'Stock insuficiente de % (disponible: %, requerido: %)',
        v_agg.name, coalesce(v_stock_after, 0), v_agg.qty
        using errcode = 'P0001';
    end if;
  end loop;

  select coalesce(sum(qty * unit_price), 0),
         coalesce(sum(discount), 0),
         coalesce(sum(profit), 0)
    into v_gross, v_line_discount, v_profit
  from pg_temp.sale_lines;

  v_global_discount := greatest(0, coalesce((p_payload ->> 'global_discount')::numeric, 0));
  if v_global_discount > v_gross - v_line_discount then
    raise exception 'El descuento global supera el importe de la venta' using errcode = '22023';
  end if;

  v_discount_total := round(v_line_discount + v_global_discount, 2);
  v_total := round(greatest(0, v_gross - v_discount_total), 2);
  v_subtotal := round(v_total / (1 + v_tax_rate), 2);
  v_tax := round(v_total - v_subtotal, 2);
  v_profit := round(v_profit - v_global_discount, 2);

  select coalesce(sum((p ->> 'amount')::numeric), 0)
    into v_paid
  from jsonb_array_elements(p_payload -> 'payments') p;

  select coalesce(sum((p ->> 'amount')::numeric), 0)
    into v_credit
  from jsonb_array_elements(p_payload -> 'payments') p
  where (p ->> 'method') = 'credito';

  v_credit := round(v_credit, 2);

  if v_paid + 0.01 < v_total then
    raise exception 'Los pagos (%) no cubren el total de la venta (%)', v_paid, v_total
      using errcode = '22023';
  end if;

  if v_credit > 0 then
    if v_customer_id is null then
      raise exception 'La venta a crédito requiere un cliente identificado' using errcode = '22023';
    end if;
    if v_credit > v_total then
      raise exception 'El monto a crédito (%) supera el total de la venta (%)', v_credit, v_total
        using errcode = '22023';
    end if;

    -- Bloquea al cliente para que dos ventas simultáneas no excedan el límite.
    select credit_limit into v_credit_limit
    from public.customers
    where id = v_customer_id
    for update;

    select coalesce(sum(case when type = 'cargo' then amount else -amount end), 0)
      into v_credit_balance
    from public.customer_credit_movements
    where customer_id = v_customer_id;

    if round(v_credit_balance + v_credit, 2) > v_credit_limit then
      raise exception 'Crédito insuficiente de % (disponible: %, solicitado: %)',
        v_customer_name,
        round(greatest(0, v_credit_limit - v_credit_balance), 2),
        v_credit
        using errcode = '22023';
    end if;
  end if;

  select ds.series, ds.number, ds.code
    into v_series, v_number, v_code
  from public.next_document_number(v_doc, nullif(p_payload ->> 'series', '')) ds;

  insert into public.sales(
    code, series, number, doc_type, customer_id, customer_name, customer_doc,
    user_id, cash_register_id, cash_session_id, warehouse_id, date,
    subtotal, discount, tax, total, profit, status, notes
  ) values (
    v_code, v_series, v_number, v_doc, v_customer_id, v_customer_name, v_customer_doc,
    v_user, v_register.id, v_session.id, v_warehouse, now(),
    v_subtotal, v_discount_total, v_tax, v_total, v_profit, 'pagada',
    nullif(p_payload ->> 'notes', '')
  ) returning id into v_sale_id;

  insert into public.sale_items(
    sale_id, product_id, presentation_id, name, sku, base_unit, presentation_label,
    factor, qty, base_qty, unit_price, discount, subtotal, unit_cost, total_cost, profit
  )
  select v_sale_id, product_id, presentation_id, name, sku, base_unit, presentation_label,
         factor, qty, base_qty, unit_price, discount, subtotal, unit_cost, total_cost, profit
  from pg_temp.sale_lines
  order by idx;

  for v_payment in select * from jsonb_array_elements(p_payload -> 'payments') loop
    if coalesce((v_payment ->> 'amount')::numeric, 0) <= 0 then
      raise exception 'Cada pago debe tener un monto mayor a cero' using errcode = '22023';
    end if;

    select id into v_method_id
    from public.payment_methods
    where code = (v_payment ->> 'method') and active;

    if v_method_id is null then
      raise exception 'Método de pago no válido: %', (v_payment ->> 'method')
        using errcode = 'P0001';
    end if;

    insert into public.sale_payments(sale_id, payment_method_id, amount, reference, status)
    values (
      v_sale_id, v_method_id, (v_payment ->> 'amount')::numeric,
      nullif(v_payment ->> 'reference', ''),
      case when (v_payment ->> 'method') = 'credito'
        then 'pendiente'::public.payment_status
        else 'completado'::public.payment_status
      end
    );
  end loop;

  if v_credit > 0 then
    insert into public.customer_credit_movements(
      customer_id, sale_id, type, amount, notes, user_id
    ) values (
      v_customer_id, v_sale_id, 'cargo', v_credit, 'Venta ' || v_code, v_user
    );
  end if;

  for v_agg in
    select product_id, sum(base_qty) as qty, max(name) as name
    from pg_temp.sale_lines
    group by product_id
  loop
    update public.inventory
       set stock = stock - v_agg.qty,
           updated_at = now()
     where product_id = v_agg.product_id
       and warehouse_id = v_warehouse
       and stock >= v_agg.qty
    returning stock into v_stock_after;

    if v_stock_after is null then
      raise exception 'Stock insuficiente de % al descontar', v_agg.name using errcode = 'P0001';
    end if;

    insert into public.inventory_movements(
      product_id, warehouse_id, type, qty, stock_after, reason, reference, user_id
    ) values (
      v_agg.product_id, v_warehouse, 'salida', -v_agg.qty, v_stock_after,
      'Venta en punto de venta', v_code, v_user
    );
  end loop;

  -- El arqueo solo cuenta efectivo. Tarjeta, billetera, transferencia y la
  -- parte fiada no entran al cajón; el vuelto se descuenta topando el efectivo
  -- retenido contra lo que la venta realmente consumió en dinero.
  select
    coalesce(sum(sp.amount) filter (where pm.kind = 'efectivo'), 0),
    coalesce(sum(sp.amount) filter (where pm.kind <> 'efectivo'), 0)
    into v_cash_paid, v_other_paid
  from public.sale_payments sp
  join public.payment_methods pm on pm.id = sp.payment_method_id
  where sp.sale_id = v_sale_id
    and sp.status = 'completado';

  v_cash := round(greatest(0, least(v_cash_paid, v_total - v_other_paid - v_credit)), 2);

  update public.cash_sessions
     set sales_total = sales_total + v_total,
         expected_total = expected_total + v_cash
   where id = v_session.id;

  if v_cash > 0 then
    insert into public.cash_movements(cash_session_id, type, amount, description, reference, user_id)
    values (v_session.id, 'venta', v_cash, 'Venta ' || v_code, v_code, v_user);
  end if;

  if v_customer_id is not null then
    update public.customers
       set purchases_count = purchases_count + 1,
           total_spent = total_spent + v_total
     where id = v_customer_id;
  end if;

  perform public.log_audit(
    'create', 'sale', v_sale_id::text, null,
    jsonb_build_object(
      'code', v_code, 'total', v_total, 'items', v_idx,
      'cash_session_id', v_session.id, 'cash', v_cash, 'credit', v_credit
    )
  );

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'code', v_code,
    'series', v_series,
    'number', v_number,
    'subtotal', v_subtotal,
    'discount', v_discount_total,
    'tax', v_tax,
    'total', v_total,
    'profit', v_profit,
    'credit_amount', v_credit,
    'status', 'pagada'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. void_sale: revierte el crédito pendiente y solo devuelve el dinero real
-- -----------------------------------------------------------------------------
create or replace function public.void_sale(p_sale_id uuid, p_reason text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.sales%rowtype;
  v_item public.sale_items%rowtype;
  v_stock numeric(14, 3);
  v_cash_paid numeric(14, 2);
  v_other_paid numeric(14, 2);
  v_credit_paid numeric(14, 2);
  v_cash numeric(14, 2);
  v_credit_outstanding numeric(14, 2);
begin
  perform public.assert_permission('sales', 'update');

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'La venta no existe' using errcode = 'P0001';
  end if;
  if v_sale.status <> 'pagada' then
    raise exception 'Solo se pueden anular ventas pagadas' using errcode = 'P0001';
  end if;

  for v_item in select * from public.sale_items where sale_id = p_sale_id loop
    insert into public.inventory(product_id, warehouse_id, stock)
    values (v_item.product_id, v_sale.warehouse_id, v_item.base_qty)
    on conflict (product_id, warehouse_id) do update
      set stock = public.inventory.stock + excluded.stock,
          updated_at = now()
    returning stock into v_stock;

    insert into public.inventory_movements(
      product_id, warehouse_id, type, qty, stock_after, reason, reference, user_id
    ) values (
      v_item.product_id, v_sale.warehouse_id, 'devolucion', v_item.base_qty, v_stock,
      'Anulación de venta ' || v_sale.code, v_sale.code, auth.uid()
    );
  end loop;

  update public.sales
     set status = 'anulada',
         notes = concat_ws(' · ', nullif(notes, ''), nullif(p_reason, '')),
         updated_at = now()
   where id = p_sale_id;

  select
    coalesce(sum(sp.amount) filter (where pm.kind = 'efectivo'), 0),
    coalesce(sum(sp.amount) filter (where pm.kind <> 'efectivo'), 0)
    into v_cash_paid, v_other_paid
  from public.sale_payments sp
  join public.payment_methods pm on pm.id = sp.payment_method_id
  where sp.sale_id = p_sale_id
    and sp.status = 'completado';

  -- La parte fiada nunca entró al cajón, así que también topa el vuelto.
  select coalesce(sum(sp.amount), 0)
    into v_credit_paid
  from public.sale_payments sp
  join public.payment_methods pm on pm.id = sp.payment_method_id
  where sp.sale_id = p_sale_id
    and pm.kind = 'credito';

  v_cash := round(greatest(0, least(v_cash_paid, v_sale.total - v_other_paid - v_credit_paid)), 2);

  -- Deuda que la venta todavía tiene viva en el libro.
  select coalesce(sum(case when type = 'cargo' then amount else -amount end), 0)
    into v_credit_outstanding
  from public.customer_credit_movements
  where sale_id = p_sale_id;

  if v_credit_outstanding > 0 and v_sale.customer_id is not null then
    insert into public.customer_credit_movements(
      customer_id, sale_id, type, amount, notes, user_id
    ) values (
      v_sale.customer_id, p_sale_id, 'abono', v_credit_outstanding,
      'Anulación de venta ' || v_sale.code, auth.uid()
    );
  end if;

  if v_sale.cash_session_id is not null then
    update public.cash_sessions
       set sales_total = greatest(0, sales_total - v_sale.total),
           expected_total = greatest(0, expected_total - v_cash)
     where id = v_sale.cash_session_id and status = 'abierta';

    -- Si la caja ya se cerró, el efectivo se contó en ese arqueo y no se
    -- puede revertir: solo se corrige la venta, no el movimiento.
    if found and v_cash > 0 then
      insert into public.cash_movements(cash_session_id, type, amount, description, reference, user_id)
      values (v_sale.cash_session_id, 'ajuste', -v_cash,
              'Anulación de venta ' || v_sale.code, v_sale.code, auth.uid());
    end if;
  end if;

  if v_sale.customer_id is not null then
    update public.customers
       set purchases_count = greatest(0, purchases_count - 1),
           total_spent = greatest(0, total_spent - v_sale.total)
     where id = v_sale.customer_id;
  end if;

  perform public.log_audit('void', 'sale', p_sale_id::text,
    jsonb_build_object('status', v_sale.status),
    jsonb_build_object('status', 'anulada', 'reason', p_reason));

  return jsonb_build_object('sale_id', p_sale_id, 'status', 'anulada');
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. approve_sale_return: la devolución de una venta a crédito baja la deuda
-- -----------------------------------------------------------------------------
create or replace function public.approve_sale_return(p_return_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_return public.sale_returns%rowtype;
  v_sale public.sales%rowtype;
  v_item public.sale_return_items%rowtype;
  v_stock numeric(14, 3);
  v_credit_outstanding numeric(14, 2);
  v_debt numeric(14, 2) := 0;
  v_cash numeric(14, 2) := 0;
begin
  perform public.assert_permission('returns', 'approve');

  select * into v_return from public.sale_returns where id = p_return_id for update;
  if not found then
    raise exception 'La devolución no existe' using errcode = 'P0001';
  end if;
  if v_return.status <> 'pendiente' then
    raise exception 'La devolución ya fue procesada' using errcode = 'P0001';
  end if;

  if not p_approve then
    update public.sale_returns set status = 'rechazada', updated_at = now() where id = p_return_id;
    perform public.log_audit('reject', 'sale_return', p_return_id::text, null, null);
    return jsonb_build_object('return_id', p_return_id, 'status', 'rechazada');
  end if;

  select * into v_sale from public.sales where id = v_return.sale_id;

  for v_item in select * from public.sale_return_items where return_id = p_return_id loop
    insert into public.inventory(product_id, warehouse_id, stock)
    values (v_item.product_id, v_sale.warehouse_id, v_item.base_qty)
    on conflict (product_id, warehouse_id) do update
      set stock = public.inventory.stock + excluded.stock,
          updated_at = now()
    returning stock into v_stock;

    insert into public.inventory_movements(
      product_id, warehouse_id, type, qty, stock_after, reason, reference, user_id
    ) values (
      v_item.product_id, v_sale.warehouse_id, 'devolucion', v_item.base_qty, v_stock,
      'Devolución ' || v_return.code, v_return.code, auth.uid()
    );
  end loop;

  update public.sale_returns
     set status = 'aprobada', updated_at = now()
   where id = p_return_id;

  select coalesce(sum(case when type = 'cargo' then amount else -amount end), 0)
    into v_credit_outstanding
  from public.customer_credit_movements
  where sale_id = v_sale.id;

  -- Primero cancela deuda; lo que sobre se devuelve como dinero del turno.
  v_debt := round(least(v_return.total, greatest(0, v_credit_outstanding)), 2);
  v_cash := round(v_return.total - v_debt, 2);

  if v_debt > 0 and v_sale.customer_id is not null then
    insert into public.customer_credit_movements(
      customer_id, sale_id, sale_return_id, type, amount, notes, user_id
    ) values (
      v_sale.customer_id, v_sale.id, p_return_id, 'abono', v_debt,
      'Devolución ' || v_return.code, auth.uid()
    );
  end if;

  if v_cash > 0 and v_sale.cash_session_id is not null then
    insert into public.cash_movements(cash_session_id, type, amount, description, reference, user_id)
    values (v_sale.cash_session_id, 'ajuste', -v_cash,
            'Devolución ' || v_return.code, v_return.code, auth.uid());
  end if;

  perform public.log_audit('approve', 'sale_return', p_return_id::text, null,
    jsonb_build_object('total', v_return.total, 'debt', v_debt, 'cash', v_cash));

  return jsonb_build_object(
    'return_id', p_return_id,
    'status', 'aprobada',
    'total', v_return.total,
    'applied_to_debt', v_debt
  );
end;
$$;
