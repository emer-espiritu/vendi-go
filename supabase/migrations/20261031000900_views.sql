-- =============================================================================
-- VendiGo · 0009 · Vistas de reportería
--
-- Todas usan `security_invoker = true`: heredan las políticas RLS del usuario
-- que consulta. Un cajero solo agrega sus propias ventas; gerencia ve todo.
-- =============================================================================

create or replace view public.v_daily_sales
with (security_invoker = true)
as
select
  (s.date at time zone 'America/Lima')::date as day,
  count(*)::integer as sales_count,
  round(sum(s.total), 2) as total,
  round(sum(s.profit), 2) as profit,
  round(avg(s.total), 2) as avg_ticket
from public.sales s
where s.status = 'pagada'
  and s.deleted_at is null
group by 1;

create or replace view public.v_monthly_sales
with (security_invoker = true)
as
select
  date_trunc('month', s.date at time zone 'America/Lima')::date as month,
  count(*)::integer as sales_count,
  round(sum(s.total), 2) as total,
  round(sum(s.profit), 2) as profit,
  round(sum(s.tax), 2) as tax,
  round(avg(s.total), 2) as avg_ticket
from public.sales s
where s.status = 'pagada'
  and s.deleted_at is null
group by 1;

create or replace view public.v_top_products
with (security_invoker = true)
as
select
  si.product_id,
  si.name,
  si.sku,
  round(sum(si.base_qty), 3) as base_qty,
  round(sum(si.qty), 3) as presentation_qty,
  round(sum(si.subtotal), 2) as revenue,
  round(sum(si.profit), 2) as profit,
  count(distinct si.sale_id)::integer as sales_count
from public.sale_items si
join public.sales s on s.id = si.sale_id
where s.status = 'pagada'
  and s.deleted_at is null
group by si.product_id, si.name, si.sku;

create or replace view public.v_low_stock
with (security_invoker = true)
as
select
  p.id as product_id,
  p.name,
  p.sku,
  p.base_unit,
  p.min_stock,
  w.id as warehouse_id,
  w.name as warehouse_name,
  i.stock,
  round(greatest(p.min_stock - i.stock, 0), 3) as missing_qty,
  case
    when i.stock <= 0 then 'agotado'
    when i.stock <= p.min_stock then 'bajo'
    else 'ok'
  end as status
from public.inventory i
join public.products p on p.id = i.product_id
join public.warehouses w on w.id = i.warehouse_id
where p.active
  and p.deleted_at is null
  and i.stock <= p.min_stock;

create or replace view public.v_cashier_performance
with (security_invoker = true)
as
select
  s.user_id,
  coalesce(pr.full_name, pr.email, 'Sin usuario') as cashier_name,
  count(*)::integer as sales_count,
  round(sum(s.total), 2) as total,
  round(avg(s.total), 2) as avg_ticket,
  round(sum(s.profit), 2) as profit,
  max(s.date) as last_sale_at
from public.sales s
left join public.profiles pr on pr.id = s.user_id
where s.status = 'pagada'
  and s.deleted_at is null
group by s.user_id, pr.full_name, pr.email;

create or replace view public.v_expenses_summary
with (security_invoker = true)
as
select
  e.category_id,
  coalesce(ec.name, 'Sin categoría') as category_name,
  count(*)::integer as expense_count,
  round(sum(e.amount), 2) as total,
  max(e.date) as last_expense_at
from public.expenses e
left join public.expense_categories ec on ec.id = e.category_id
where e.deleted_at is null
group by e.category_id, ec.name;

create or replace view public.v_purchases_summary
with (security_invoker = true)
as
select
  po.supplier_id,
  coalesce(sup.name, 'Sin proveedor') as supplier_name,
  count(*)::integer as orders_count,
  round(sum(po.total), 2) as total,
  max(po.date) as last_purchase_at,
  count(*) filter (where po.status = 'pendiente')::integer as pending_count
from public.purchase_orders po
left join public.suppliers sup on sup.id = po.supplier_id
where po.deleted_at is null
group by po.supplier_id, sup.name;

create or replace view public.v_inventory_valuation
with (security_invoker = true)
as
select
  w.id as warehouse_id,
  w.name as warehouse_name,
  count(distinct i.product_id)::integer as products_count,
  round(sum(i.stock), 3) as total_stock,
  round(sum(i.stock * p.cost), 2) as cost_value,
  round(sum(i.stock * p.price), 2) as retail_value
from public.inventory i
join public.products p on p.id = i.product_id
join public.warehouses w on w.id = i.warehouse_id
where p.deleted_at is null
group by w.id, w.name;

create or replace view public.v_cash_sessions
with (security_invoker = true)
as
select
  cs.id,
  cs.cash_register_id,
  cr.code as register_code,
  cr.name as register_name,
  cs.user_id,
  coalesce(pr.full_name, pr.email, 'Sin usuario') as cashier_name,
  cs.opened_at,
  cs.closed_at,
  cs.opening_amount,
  cs.sales_total,
  cs.expenses_total,
  cs.expected_total,
  cs.counted_total,
  cs.difference,
  cs.status
from public.cash_sessions cs
join public.cash_registers cr on cr.id = cs.cash_register_id
left join public.profiles pr on pr.id = cs.user_id;

create or replace view public.v_sales_daily_profit
with (security_invoker = true)
as
select
  (s.date at time zone 'America/Lima')::date as day,
  coalesce(sum(s.total) filter (where s.status = 'pagada'), 0)::numeric(14, 2) as revenue,
  coalesce(sum(s.profit) filter (where s.status = 'pagada'), 0)::numeric(14, 2) as profit,
  coalesce(sum(s.total) filter (where s.status = 'anulada'), 0)::numeric(14, 2) as voided
from public.sales s
where s.deleted_at is null
group by 1;

grant select on
  public.v_daily_sales,
  public.v_monthly_sales,
  public.v_top_products,
  public.v_low_stock,
  public.v_cashier_performance,
  public.v_expenses_summary,
  public.v_purchases_summary,
  public.v_inventory_valuation,
  public.v_cash_sessions,
  public.v_sales_daily_profit
to authenticated;
