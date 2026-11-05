-- =============================================================================
-- VendiGo · 0006 · RPC de ventas, caja y gastos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registrar venta (transaccional)
-- payload:
-- {
--   "doc_type": "boleta" | "factura",
--   "series": "B001" (opcional),
--   "customer_id": uuid | null,
--   "customer_name": "Clientes varios",
--   "customer_doc": "—",
--   "warehouse_id": uuid | null,
--   "cash_register_id": uuid | null,
--   "cash_session_id": uuid | null,
--   "global_discount": 0,
--   "notes": null,
--   "items": [{ "product_id": uuid, "presentation_id": uuid, "qty": 1, "discount": 0 }],
--   "payments": [{ "method": "efectivo", "amount": 10, "reference": null }]
-- }
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

  if v_paid + 0.01 < v_total then
    raise exception 'Los pagos (%) no cubren el total de la venta (%)', v_paid, v_total
      using errcode = '22023';
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
    values (v_sale_id, v_method_id, (v_payment ->> 'amount')::numeric,
            nullif(v_payment ->> 'reference', ''), 'completado');
  end loop;

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

  update public.cash_sessions
     set sales_total = sales_total + v_total,
         expected_total = expected_total + v_total
   where id = v_session.id;

  insert into public.cash_movements(cash_session_id, type, amount, description, reference, user_id)
  values (v_session.id, 'venta', v_total, 'Venta ' || v_code, v_code, v_user);

  if v_customer_id is not null then
    update public.customers
       set purchases_count = purchases_count + 1,
           total_spent = total_spent + v_total
     where id = v_customer_id;
  end if;

  perform public.log_audit(
    'create', 'sale', v_sale_id::text, null,
    jsonb_build_object('code', v_code, 'total', v_total, 'items', v_idx, 'cash_session_id', v_session.id)
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
    'status', 'pagada'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Anular venta (solo con permiso; repone stock y revierte caja)
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

  if v_sale.cash_session_id is not null then
    update public.cash_sessions
       set sales_total = greatest(0, sales_total - v_sale.total),
           expected_total = expected_total - v_sale.total
     where id = v_sale.cash_session_id and status = 'abierta';

    insert into public.cash_movements(cash_session_id, type, amount, description, reference, user_id)
    values (v_sale.cash_session_id, 'ajuste', -v_sale.total,
            'Anulación de venta ' || v_sale.code, v_sale.code, auth.uid());
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
-- Caja
-- -----------------------------------------------------------------------------
create or replace function public.open_cash_session(
  p_cash_register_id uuid,
  p_opening_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  perform public.assert_permission('cash', 'create');

  if not exists (select 1 from public.cash_registers where id = p_cash_register_id and active) then
    raise exception 'La caja no existe o está inactiva' using errcode = 'P0001';
  end if;

  begin
    insert into public.cash_sessions(cash_register_id, user_id, opening_amount, expected_total)
    values (p_cash_register_id, v_user, coalesce(p_opening_amount, 0), coalesce(p_opening_amount, 0))
    returning id into v_session_id;
  exception when unique_violation then
    raise exception 'La caja ya tiene una sesión abierta' using errcode = 'P0001';
  end;

  insert into public.cash_movements(cash_session_id, type, amount, description, user_id)
  values (v_session_id, 'apertura', coalesce(p_opening_amount, 0), 'Fondo inicial de caja', v_user);

  perform public.log_audit('open', 'cash_session', v_session_id::text, null,
    jsonb_build_object('opening_amount', p_opening_amount, 'cash_register_id', p_cash_register_id));

  return jsonb_build_object('cash_session_id', v_session_id, 'status', 'abierta');
end;
$$;

create or replace function public.register_cash_movement(
  p_cash_session_id uuid,
  p_type public.cash_movement_type,
  p_amount numeric,
  p_description text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.cash_sessions%rowtype;
begin
  perform public.assert_permission('cash', 'update');

  if p_type not in ('ingreso', 'retiro', 'gasto', 'ajuste') then
    raise exception 'Tipo de movimiento no permitido: %', p_type using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero' using errcode = '22023';
  end if;

  select * into v_session from public.cash_sessions where id = p_cash_session_id for update;
  if not found or v_session.status <> 'abierta' then
    raise exception 'La sesión de caja no está abierta' using errcode = 'P0001';
  end if;
  if v_session.user_id <> auth.uid() and not public.has_permission('cash', 'view_all') then
    raise exception 'No puedes operar una caja de otro cajero' using errcode = '42501';
  end if;

  insert into public.cash_movements(cash_session_id, type, amount, description, user_id)
  values (p_cash_session_id, p_type, p_amount, coalesce(p_description, ''), auth.uid());

  update public.cash_sessions
     set expected_total = expected_total
       + case when p_type in ('ingreso', 'ajuste') then p_amount else -p_amount end
   where id = p_cash_session_id;

  perform public.log_audit('create', 'cash_movement', p_cash_session_id::text, null,
    jsonb_build_object('type', p_type, 'amount', p_amount));

  return jsonb_build_object('cash_session_id', p_cash_session_id, 'type', p_type, 'amount', p_amount);
end;
$$;

create or replace function public.close_cash_session(
  p_cash_session_id uuid,
  p_counted_total numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_sales numeric(14, 2);
  v_expenses numeric(14, 2);
  v_expected numeric(14, 2);
  v_difference numeric(14, 2);
begin
  perform public.assert_permission('cash', 'update');

  select * into v_session from public.cash_sessions where id = p_cash_session_id for update;
  if not found then
    raise exception 'La sesión de caja no existe' using errcode = 'P0001';
  end if;
  if v_session.status <> 'abierta' then
    raise exception 'La caja ya está cerrada' using errcode = 'P0001';
  end if;
  if v_session.user_id <> auth.uid() and not public.has_permission('cash', 'view_all') then
    raise exception 'No puedes cerrar una caja de otro cajero' using errcode = '42501';
  end if;
  if p_counted_total is null or p_counted_total < 0 then
    raise exception 'El monto contado debe ser igual o mayor a cero' using errcode = '22023';
  end if;

  select coalesce(sum(total), 0) into v_sales
  from public.sales
  where cash_session_id = p_cash_session_id and status = 'pagada';

  select coalesce(sum(amount), 0) into v_expenses
  from public.expenses
  where cash_session_id = p_cash_session_id and deleted_at is null;

  select coalesce(sum(
    case
      when type in ('apertura', 'venta', 'ingreso', 'ajuste') then amount
      when type in ('retiro', 'gasto') then -amount
      else 0
    end
  ), 0) into v_expected
  from public.cash_movements
  where cash_session_id = p_cash_session_id;

  v_difference := round(p_counted_total - v_expected, 2);

  insert into public.cash_movements(cash_session_id, type, amount, description, user_id)
  values (p_cash_session_id, 'cierre', 0, 'Cierre y arqueo de caja', auth.uid());

  update public.cash_sessions
     set status = 'cerrada',
         closed_at = now(),
         sales_total = v_sales,
         expenses_total = v_expenses,
         expected_total = v_expected,
         counted_total = p_counted_total,
         difference = v_difference,
         notes = coalesce(p_notes, notes)
   where id = p_cash_session_id;

  perform public.log_audit('close', 'cash_session', p_cash_session_id::text, null,
    jsonb_build_object('expected', v_expected, 'counted', p_counted_total, 'difference', v_difference));

  return jsonb_build_object(
    'cash_session_id', p_cash_session_id,
    'status', 'cerrada',
    'sales_total', v_sales,
    'expenses_total', v_expenses,
    'expected_total', v_expected,
    'counted_total', p_counted_total,
    'difference', v_difference
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Gastos
-- -----------------------------------------------------------------------------
create or replace function public.record_expense(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_session public.cash_sessions%rowtype;
  v_session_id uuid;
  v_amount numeric(14, 2);
begin
  perform public.assert_permission('expenses', 'create');

  v_amount := coalesce((p_payload ->> 'amount')::numeric, 0);
  if v_amount <= 0 then
    raise exception 'El monto del gasto debe ser mayor a cero' using errcode = '22023';
  end if;

  v_code := 'GAS-' || lpad(nextval('public.expense_code_seq')::text, 4, '0');
  v_session_id := nullif(p_payload ->> 'cash_session_id', '')::uuid;

  if v_session_id is not null then
    select * into v_session from public.cash_sessions where id = v_session_id for update;
    if not found or v_session.status <> 'abierta' then
      raise exception 'La sesión de caja no está abierta' using errcode = 'P0001';
    end if;
    if v_session.user_id <> auth.uid() and not public.has_permission('cash', 'view_all') then
      raise exception 'No puedes registrar gastos en una caja ajena' using errcode = '42501';
    end if;
  end if;

  insert into public.expenses(
    code, category_id, cash_session_id, user_id, date, description, amount, payment_method_id
  ) values (
    v_code,
    nullif(p_payload ->> 'category_id', '')::uuid,
    v_session_id,
    auth.uid(),
    coalesce((p_payload ->> 'date')::date, current_date),
    coalesce(p_payload ->> 'description', ''),
    v_amount,
    nullif(p_payload ->> 'payment_method_id', '')::uuid
  ) returning id into v_id;

  if v_session_id is not null then
    insert into public.cash_movements(cash_session_id, type, amount, description, user_id)
    values (v_session_id, 'gasto', v_amount, coalesce(p_payload ->> 'description', 'Gasto operativo'), auth.uid());

    update public.cash_sessions
       set expenses_total = expenses_total + v_amount,
           expected_total = expected_total - v_amount
     where id = v_session_id;
  end if;

  perform public.log_audit('create', 'expense', v_id::text, null,
    jsonb_build_object('code', v_code, 'amount', v_amount));

  return jsonb_build_object('expense_id', v_id, 'code', v_code, 'amount', v_amount);
end;
$$;
