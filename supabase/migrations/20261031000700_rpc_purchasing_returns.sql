-- =============================================================================
-- VendiGo · 0007 · RPC de compras, ajustes, devoluciones y datos demo
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registrar orden de compra (no mueve stock todavía)
-- payload:
-- {
--   "supplier_id": uuid,
--   "warehouse_id": uuid | null,
--   "date": "2026-10-31",
--   "document_type": "factura",
--   "notes": null,
--   "items": [{ "product_id": uuid, "presentation_id": uuid, "qty": 2, "unit_cost": 100, "discount": 0 }]
-- }
-- -----------------------------------------------------------------------------
create or replace function public.create_purchase(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_supplier uuid;
  v_warehouse uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_pres public.product_presentations%rowtype;
  v_factor numeric(14, 3);
  v_qty numeric(14, 3);
  v_unit_cost numeric(12, 4);
  v_discount numeric(12, 2);
  v_base_qty numeric(14, 3);
  v_subtotal numeric(14, 2);
  v_total numeric(14, 2) := 0;
  v_subtotal_net numeric(14, 2);
  v_tax numeric(14, 2);
begin
  perform public.assert_permission('purchases', 'create');

  if p_payload is null or jsonb_typeof(p_payload -> 'items') <> 'array'
     or jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'La orden no tiene productos' using errcode = '22023';
  end if;

  v_supplier := nullif(p_payload ->> 'supplier_id', '')::uuid;
  if v_supplier is null or not exists (select 1 from public.suppliers where id = v_supplier and deleted_at is null) then
    raise exception 'Selecciona un proveedor válido' using errcode = '22023';
  end if;

  v_warehouse := coalesce(nullif(p_payload ->> 'warehouse_id', '')::uuid, public.default_warehouse_id());
  if v_warehouse is null then
    raise exception 'No hay un almacén configurado' using errcode = 'P0001';
  end if;

  v_code := 'OC-' || to_char(now(), 'YYYY') || '-'
            || lpad(nextval('public.purchase_order_seq')::text, 4, '0');

  insert into public.purchase_orders(
    code, supplier_id, warehouse_id, user_id, date, status, document_type, notes
  ) values (
    v_code, v_supplier, v_warehouse, auth.uid(),
    coalesce((p_payload ->> 'date')::date, current_date),
    'pendiente',
    coalesce((p_payload ->> 'document_type')::public.document_type, 'factura'),
    nullif(p_payload ->> 'notes', '')
  ) returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items') loop
    v_qty := coalesce((v_item ->> 'qty')::numeric, 0);
    v_unit_cost := coalesce((v_item ->> 'unit_cost')::numeric, 0);
    v_discount := coalesce((v_item ->> 'discount')::numeric, 0);

    if v_qty <= 0 or v_unit_cost < 0 or v_discount < 0 then
      raise exception 'Cantidad, costo y descuento deben ser válidos' using errcode = '22023';
    end if;

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid and deleted_at is null;
    if not found then
      raise exception 'Producto inexistente: %', (v_item ->> 'product_id') using errcode = 'P0001';
    end if;

    v_factor := 1;
    if (v_item ->> 'presentation_id') is not null then
      select * into v_pres
      from public.product_presentations
      where id = (v_item ->> 'presentation_id')::uuid and product_id = v_product.id;
      if not found then
        raise exception 'Presentación inválida para %', v_product.name using errcode = 'P0001';
      end if;
      v_factor := v_pres.factor;
    end if;

    v_base_qty := round(v_qty * v_factor, 3);
    v_subtotal := round(v_qty * v_unit_cost - v_discount, 2);

    insert into public.purchase_items(
      purchase_id, product_id, presentation_id, name, qty, unit, factor, base_qty,
      unit_cost, discount, subtotal
    ) values (
      v_id, v_product.id, nullif(v_item ->> 'presentation_id', '')::uuid,
      v_product.name, v_qty,
      coalesce((select label from public.product_presentations where id = nullif(v_item ->> 'presentation_id', '')::uuid), v_product.base_unit::text),
      v_factor, v_base_qty, v_unit_cost, v_discount, v_subtotal
    );

    v_total := v_total + v_subtotal;
  end loop;

  v_subtotal_net := round(v_total / 1.18, 2);
  v_tax := round(v_total - v_subtotal_net, 2);

  update public.purchase_orders
     set subtotal = v_subtotal_net,
         tax = v_tax,
         total = v_total
   where id = v_id;

  perform public.log_audit('create', 'purchase_order', v_id::text, null,
    jsonb_build_object('code', v_code, 'total', v_total));

  return jsonb_build_object(
    'purchase_id', v_id, 'code', v_code, 'total', v_total, 'status', 'pendiente'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Recibir orden de compra: aumenta inventario y recalcula costo promedio
-- -----------------------------------------------------------------------------
create or replace function public.receive_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_item public.purchase_items%rowtype;
  v_old_stock numeric(14, 3);
  v_stock_after numeric(14, 3);
  v_base_cost numeric(12, 4);
  v_new_cost numeric(12, 4);
begin
  perform public.assert_permission('purchases', 'update');

  select * into v_order from public.purchase_orders where id = p_purchase_id for update;
  if not found then
    raise exception 'La orden de compra no existe' using errcode = 'P0001';
  end if;
  if v_order.status not in ('pendiente', 'parcial') then
    raise exception 'La orden ya fue recibida o anulada' using errcode = 'P0001';
  end if;

  for v_item in select * from public.purchase_items where purchase_id = p_purchase_id loop
    select stock into v_old_stock
    from public.inventory
    where product_id = v_item.product_id and warehouse_id = v_order.warehouse_id
    for update;
    v_old_stock := coalesce(v_old_stock, 0);

    insert into public.inventory(product_id, warehouse_id, stock)
    values (v_item.product_id, v_order.warehouse_id, v_item.base_qty)
    on conflict (product_id, warehouse_id) do update
      set stock = public.inventory.stock + excluded.stock,
          updated_at = now()
    returning stock into v_stock_after;

    insert into public.inventory_movements(
      product_id, warehouse_id, type, qty, stock_after, reason, reference, user_id
    ) values (
      v_item.product_id, v_order.warehouse_id, 'entrada', v_item.base_qty, v_stock_after,
      'Recepción de compra ' || v_order.code, v_order.code, auth.uid()
    );

    v_base_cost := round(v_item.unit_cost / v_item.factor, 4);

    if v_old_stock + v_item.base_qty > 0 then
      select cost into v_new_cost from public.products where id = v_item.product_id;
      v_new_cost := round(
        ((v_old_stock * coalesce(v_new_cost, 0)) + (v_item.base_qty * v_base_cost))
        / (v_old_stock + v_item.base_qty),
        4
      );
      update public.products
         set cost = v_new_cost, updated_at = now()
       where id = v_item.product_id;
    end if;
  end loop;

  update public.purchase_orders
     set status = 'recibida', updated_at = now()
   where id = p_purchase_id;

  perform public.log_audit('receive', 'purchase_order', p_purchase_id::text, null,
    jsonb_build_object('code', v_order.code, 'status', 'recibida'));

  return jsonb_build_object('purchase_id', p_purchase_id, 'status', 'recibida');
end;
$$;

-- -----------------------------------------------------------------------------
-- Ajuste manual de inventario
-- -----------------------------------------------------------------------------
create or replace function public.create_stock_adjustment(
  p_product_id uuid,
  p_qty numeric,
  p_reason text,
  p_warehouse_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_warehouse uuid;
  v_stock_after numeric(14, 3);
  v_id uuid;
begin
  perform public.assert_permission('inventory', 'update');

  if p_qty is null or p_qty = 0 then
    raise exception 'El ajuste debe ser distinto de cero' using errcode = '22023';
  end if;

  v_warehouse := coalesce(p_warehouse_id, public.default_warehouse_id());
  if v_warehouse is null then
    raise exception 'No hay un almacén configurado' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.products where id = p_product_id and deleted_at is null) then
    raise exception 'El producto no existe' using errcode = 'P0001';
  end if;

  if p_qty > 0 then
    -- Alta de stock: crea la fila de inventario del almacén si aún no existe.
    insert into public.inventory(product_id, warehouse_id, stock)
    values (p_product_id, v_warehouse, p_qty)
    on conflict (product_id, warehouse_id) do update
      set stock = public.inventory.stock + p_qty,
          updated_at = now()
    returning stock into v_stock_after;
  else
    update public.inventory
       set stock = stock + p_qty,
           updated_at = now()
     where product_id = p_product_id
       and warehouse_id = v_warehouse
       and stock + p_qty >= 0
    returning stock into v_stock_after;

    if v_stock_after is null then
      raise exception 'El ajuste dejaría stock negativo o el producto no existe en el almacén'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.inventory_movements(
    product_id, warehouse_id, type, qty, stock_after, reason, user_id
  ) values (
    p_product_id, v_warehouse, 'ajuste', p_qty, v_stock_after,
    coalesce(p_reason, 'Ajuste de inventario'), auth.uid()
  );

  insert into public.stock_adjustments(
    product_id, warehouse_id, qty, reason, status, user_id, approved_by, approved_at
  ) values (
    p_product_id, v_warehouse, p_qty, coalesce(p_reason, 'Ajuste de inventario'),
    'aprobado', auth.uid(), auth.uid(), now()
  ) returning id into v_id;

  perform public.log_audit('create', 'stock_adjustment', v_id::text, null,
    jsonb_build_object('product_id', p_product_id, 'qty', p_qty, 'reason', p_reason));

  return jsonb_build_object('adjustment_id', v_id, 'stock_after', v_stock_after);
end;
$$;

-- -----------------------------------------------------------------------------
-- Devoluciones de venta
-- payload: { "sale_id": uuid, "reason": "...", "items": [{ "sale_item_id": uuid, "qty": 1 }] }
-- -----------------------------------------------------------------------------
create or replace function public.create_sale_return(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.sales%rowtype;
  v_return_id uuid;
  v_code text;
  v_item jsonb;
  v_sale_item public.sale_items%rowtype;
  v_qty numeric(14, 3);
  v_returned numeric(14, 3);
  v_subtotal numeric(14, 2);
  v_total numeric(14, 2) := 0;
begin
  perform public.assert_permission('returns', 'create');

  select * into v_sale from public.sales
  where id = nullif(p_payload ->> 'sale_id', '')::uuid and status = 'pagada';
  if not found then
    raise exception 'El comprobante no existe o no está vigente' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_payload -> 'items') <> 'array' or jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'La devolución no tiene productos' using errcode = '22023';
  end if;

  v_code := 'DEV-' || lpad(nextval('public.sale_return_seq')::text, 6, '0');

  insert into public.sale_returns(code, sale_id, customer_id, user_id, total, reason, status)
  values (v_code, v_sale.id, v_sale.customer_id, auth.uid(), 0,
          coalesce(p_payload ->> 'reason', ''), 'pendiente')
  returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items') loop
    v_qty := coalesce((v_item ->> 'qty')::numeric, 0);
    if v_qty <= 0 then
      raise exception 'La cantidad devuelta debe ser mayor a cero' using errcode = '22023';
    end if;

    select * into v_sale_item
    from public.sale_items
    where id = (v_item ->> 'sale_item_id')::uuid and sale_id = v_sale.id;
    if not found then
      raise exception 'El ítem no pertenece al comprobante' using errcode = 'P0001';
    end if;

    select coalesce(sum(sri.qty), 0) into v_returned
    from public.sale_return_items sri
    join public.sale_returns sr on sr.id = sri.return_id
    where sri.sale_item_id = v_sale_item.id and sr.status <> 'rechazada';

    if v_returned + v_qty > v_sale_item.qty then
      raise exception 'La cantidad devuelta de % supera lo vendido', v_sale_item.name
        using errcode = '22023';
    end if;

    v_subtotal := round(
      v_qty * v_sale_item.unit_price
      - (case when v_sale_item.qty > 0 then v_sale_item.discount / v_sale_item.qty else 0 end) * v_qty,
      2
    );

    insert into public.sale_return_items(
      return_id, sale_item_id, product_id, qty, base_qty, unit_price, subtotal
    ) values (
      v_return_id, v_sale_item.id, v_sale_item.product_id, v_qty,
      round(v_qty * v_sale_item.factor, 3), v_sale_item.unit_price, v_subtotal
    );

    v_total := v_total + v_subtotal;
  end loop;

  update public.sale_returns set total = v_total where id = v_return_id;

  perform public.log_audit('create', 'sale_return', v_return_id::text, null,
    jsonb_build_object('code', v_code, 'sale_id', v_sale.id, 'total', v_total));

  return jsonb_build_object('return_id', v_return_id, 'code', v_code, 'total', v_total, 'status', 'pendiente');
end;
$$;

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

  if v_return.total > 0 and v_sale.cash_session_id is not null then
    insert into public.cash_movements(cash_session_id, type, amount, description, reference, user_id)
    values (v_sale.cash_session_id, 'ajuste', -v_return.total,
            'Devolución ' || v_return.code, v_return.code, auth.uid());
  end if;

  perform public.log_audit('approve', 'sale_return', p_return_id::text, null,
    jsonb_build_object('total', v_return.total));

  return jsonb_build_object('return_id', p_return_id, 'status', 'aprobada', 'total', v_return.total);
end;
$$;

-- -----------------------------------------------------------------------------
-- Devoluciones de compra
-- payload: { "purchase_id": uuid, "reason": "...", "items": [{ "purchase_item_id": uuid, "qty": 1 }] }
-- -----------------------------------------------------------------------------
create or replace function public.create_purchase_return(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_return_id uuid;
  v_code text;
  v_item jsonb;
  v_purchase_item public.purchase_items%rowtype;
  v_qty numeric(14, 3);
  v_returned numeric(14, 3);
  v_base_qty numeric(14, 3);
  v_subtotal numeric(14, 2);
  v_total numeric(14, 2) := 0;
  v_stock numeric(14, 3);
begin
  perform public.assert_permission('purchases', 'update');

  select * into v_order from public.purchase_orders
  where id = nullif(p_payload ->> 'purchase_id', '')::uuid and status = 'recibida';
  if not found then
    raise exception 'La compra no existe o no fue recibida' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_payload -> 'items') <> 'array' or jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'La devolución no tiene productos' using errcode = '22023';
  end if;

  v_code := 'DVC-' || lpad(nextval('public.purchase_return_seq')::text, 6, '0');

  insert into public.purchase_returns(code, purchase_id, supplier_id, user_id, total, reason, status)
  values (v_code, v_order.id, v_order.supplier_id, auth.uid(), 0,
          coalesce(p_payload ->> 'reason', ''), 'aprobada')
  returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(p_payload -> 'items') loop
    v_qty := coalesce((v_item ->> 'qty')::numeric, 0);
    if v_qty <= 0 then
      raise exception 'La cantidad devuelta debe ser mayor a cero' using errcode = '22023';
    end if;

    select * into v_purchase_item
    from public.purchase_items
    where id = (v_item ->> 'purchase_item_id')::uuid and purchase_id = v_order.id;
    if not found then
      raise exception 'El ítem no pertenece a la compra' using errcode = 'P0001';
    end if;

    select coalesce(sum(pri.qty), 0) into v_returned
    from public.purchase_return_items pri
    where pri.purchase_item_id = v_purchase_item.id;

    if v_returned + v_qty > v_purchase_item.qty then
      raise exception 'La cantidad devuelta de % supera lo comprado', v_purchase_item.name
        using errcode = '22023';
    end if;

    v_base_qty := round(v_qty * v_purchase_item.factor, 3);
    v_subtotal := round(v_qty * v_purchase_item.unit_cost, 2);

    update public.inventory
       set stock = stock - v_base_qty, updated_at = now()
     where product_id = v_purchase_item.product_id
       and warehouse_id = v_order.warehouse_id
       and stock >= v_base_qty
    returning stock into v_stock;

    if v_stock is null then
      raise exception 'Stock insuficiente para devolver %', v_purchase_item.name
        using errcode = 'P0001';
    end if;

    insert into public.purchase_return_items(
      return_id, purchase_item_id, product_id, qty, base_qty, unit_cost, subtotal
    ) values (
      v_return_id, v_purchase_item.id, v_purchase_item.product_id, v_qty, v_base_qty,
      v_purchase_item.unit_cost, v_subtotal
    );

    insert into public.inventory_movements(
      product_id, warehouse_id, type, qty, stock_after, reason, reference, user_id
    ) values (
      v_purchase_item.product_id, v_order.warehouse_id, 'devolucion', -v_base_qty, v_stock,
      'Devolución de compra ' || v_code, v_code, auth.uid()
    );

    v_total := v_total + v_subtotal;
  end loop;

  update public.purchase_returns set total = v_total where id = v_return_id;

  perform public.log_audit('create', 'purchase_return', v_return_id::text, null,
    jsonb_build_object('code', v_code, 'total', v_total));

  return jsonb_build_object('return_id', v_return_id, 'code', v_code, 'total', v_total, 'status', 'aprobada');
end;
$$;

-- -----------------------------------------------------------------------------
-- Datos demo: histórico de ventas (solo service_role)
-- -----------------------------------------------------------------------------
create or replace function public.seed_demo_history(
  p_user_id uuid,
  p_days integer default 30,
  p_count integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_warehouse uuid := public.default_warehouse_id();
  v_i integer;
  v_j integer;
  v_lines integer;
  v_product public.products%rowtype;
  v_pres public.product_presentations%rowtype;
  v_qty numeric(14, 3);
  v_base_qty numeric(14, 3);
  v_total numeric(14, 2);
  v_subtotal numeric(14, 2);
  v_tax numeric(14, 2);
  v_profit numeric(14, 2);
  v_sale_id uuid;
  v_series text;
  v_number text;
  v_code text;
  v_date timestamptz;
  v_method uuid;
  v_stock numeric(14, 3);
  v_created integer := 0;
begin
  if v_warehouse is null then
    raise exception 'No hay almacén configurado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'El perfil % no existe', p_user_id using errcode = 'P0001';
  end if;

  select id into v_method from public.payment_methods where code = 'efectivo';

  for v_i in 1..greatest(1, p_count) loop
    v_date := now() - (random() * greatest(1, p_days) || ' days')::interval;
    v_lines := 1 + floor(random() * 3)::integer;
    v_total := 0;
    v_profit := 0;

    select ds.series, ds.number, ds.code into v_series, v_number, v_code
    from public.next_document_number('boleta', 'D001') ds;

    insert into public.sales(
      code, series, number, doc_type, customer_name, customer_doc, user_id,
      warehouse_id, date, subtotal, discount, tax, total, profit, status
    ) values (
      v_code, v_series, v_number, 'boleta', 'Clientes varios', '—', p_user_id,
      v_warehouse, v_date, 0, 0, 0, 0, 0, 'pagada'
    ) returning id into v_sale_id;

    for v_j in 1..v_lines loop
      select p.* into v_product
      from public.products p
      join public.inventory i on i.product_id = p.id and i.warehouse_id = v_warehouse
      where p.active and p.deleted_at is null and i.stock > 1
      order by random()
      limit 1;

      if not found then
        continue;
      end if;

      select * into v_pres
      from public.product_presentations
      where product_id = v_product.id and active
      order by random()
      limit 1;

      if not found then
        continue;
      end if;

      v_qty := 1 + floor(random() * 2)::integer;
      v_base_qty := round(v_qty * v_pres.factor, 3);

      update public.inventory
         set stock = stock - v_base_qty, updated_at = now()
       where product_id = v_product.id and warehouse_id = v_warehouse and stock >= v_base_qty
      returning stock into v_stock;

      if v_stock is null then
        continue;
      end if;

      insert into public.sale_items(
        sale_id, product_id, presentation_id, name, sku, base_unit, presentation_label,
        factor, qty, base_qty, unit_price, discount, subtotal, unit_cost, total_cost, profit
      ) values (
        v_sale_id, v_product.id, v_pres.id, v_product.name, v_product.sku, v_product.base_unit,
        v_pres.label, v_pres.factor, v_qty, v_base_qty, v_pres.price, 0,
        round(v_qty * v_pres.price, 2), v_product.cost,
        round(v_base_qty * v_product.cost, 2),
        round(v_qty * (v_pres.price - v_product.cost * v_pres.factor), 2)
      );

      insert into public.inventory_movements(
        product_id, warehouse_id, type, qty, stock_after, reason, reference, user_id
      ) values (
        v_product.id, v_warehouse, 'salida', -v_base_qty, v_stock,
        'Venta histórica demo', v_code, p_user_id
      );

      v_total := v_total + round(v_qty * v_pres.price, 2);
      v_profit := v_profit + round(v_qty * (v_pres.price - v_product.cost * v_pres.factor), 2);
    end loop;

    v_subtotal := round(v_total / 1.18, 2);
    v_tax := round(v_total - v_subtotal, 2);

    update public.sales
       set subtotal = v_subtotal, tax = v_tax, total = v_total, profit = v_profit
     where id = v_sale_id;

    if v_total > 0 and v_method is not null then
      insert into public.sale_payments(sale_id, payment_method_id, amount, status)
      values (v_sale_id, v_method, v_total, 'completado');
      v_created := v_created + 1;
    end if;
  end loop;

  perform public.log_audit('seed', 'demo_history', null, null,
    jsonb_build_object('sales', v_created, 'days', p_days));

  return jsonb_build_object('created_sales', v_created);
end;
$$;

create or replace function public.seed_open_cash_session(
  p_user_id uuid,
  p_register_code text default 'CAJA-01',
  p_opening_amount numeric default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_register uuid;
  v_session uuid;
begin
  select id into v_register from public.cash_registers where code = p_register_code and active;
  if v_register is null then
    raise exception 'No existe la caja %', p_register_code using errcode = 'P0001';
  end if;

  select id into v_session from public.cash_sessions where cash_register_id = v_register and status = 'abierta';
  if v_session is not null then
    return jsonb_build_object('cash_session_id', v_session, 'status', 'abierta', 'existing', true);
  end if;

  insert into public.cash_sessions(cash_register_id, user_id, opening_amount, expected_total)
  values (v_register, p_user_id, p_open_amount_or_default(p_opening_amount), p_open_amount_or_default(p_opening_amount))
  returning id into v_session;

  insert into public.cash_movements(cash_session_id, type, amount, description, user_id)
  values (v_session, 'apertura', p_open_amount_or_default(p_opening_amount), 'Fondo inicial demo', p_user_id);

  return jsonb_build_object('cash_session_id', v_session, 'status', 'abierta', 'existing', false);
end;
$$;

-- Helper para el seed (evita null).
create or replace function public.p_open_amount_or_default(p_amount numeric)
returns numeric
language sql
immutable
as $$ select coalesce(p_amount, 0); $$;

revoke all on function public.seed_demo_history(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.seed_open_cash_session(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.seed_demo_history(uuid, integer, integer) to service_role;
grant execute on function public.seed_open_cash_session(uuid, text, numeric) to service_role;
