-- =============================================================================
-- VendiGo · Ajustes al reporte agregado
--
-- Dos correcciones sobre `report_overview` (20261108000200):
--
--   * `cashiers` se calculaba sobre las ventas ya filtradas por comprobante y
--     cajero. Al elegir un cajero, el filtro se quedaba con una sola opción y
--     no había forma de volver a otro sin pasar por "Todos". La lista ahora se
--     arma con las ventas del rango, independiente de los filtros.
--   * `p_sales_limit <= 0` (o null) ahora significa "sin límite", en lugar de
--     devolver cero filas. La tabla y la exportación de reportes piden el
--     detalle completo del rango; el dashboard sí pide un tope chico.
-- =============================================================================

create or replace function public.report_overview(
  p_from date,
  p_to date,
  p_doc_type text default null,
  p_user_id uuid default null,
  p_sales_limit integer default 5,
  p_top_limit integer default 8
) returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with bounds as (
  select
    p_from as from_day,
    p_to as to_day,
    (p_to - p_from + 1) as days,
    (p_from::timestamp at time zone 'America/Lima') as from_ts,
    ((p_to + 1)::timestamp at time zone 'America/Lima') as to_ts
),
previous_bounds as (
  select
    (b.from_ts - (b.days * interval '1 day')) as from_ts,
    b.from_ts as to_ts,
    (p_from - b.days) as from_day,
    (p_from - 1) as to_day
  from bounds b
),
filtered as (
  select
    s.id,
    s.code,
    s.date,
    s.doc_type,
    s.customer_name,
    s.user_id,
    s.total,
    s.profit,
    s.tax
  from public.sales s
  where s.status = 'pagada'
    and s.deleted_at is null
    and s.date >= (select from_ts from bounds)
    and s.date < (select to_ts from bounds)
    and (p_doc_type is null or s.doc_type::text = p_doc_type)
    and (p_user_id is null or s.user_id = p_user_id)
),
previous_sales as (
  select s.id, s.total, s.profit
  from public.sales s
  where s.status = 'pagada'
    and s.deleted_at is null
    and s.date >= (select from_ts from previous_bounds)
    and s.date < (select to_ts from previous_bounds)
    and (p_doc_type is null or s.doc_type::text = p_doc_type)
    and (p_user_id is null or s.user_id = p_user_id)
),
period_expenses as (
  select e.id, e.amount, e.category_id
  from public.expenses e
  where e.deleted_at is null
    and e.date between p_from and p_to
),
previous_expenses as (
  select e.amount
  from public.expenses e
  where e.deleted_at is null
    and e.date between (select from_day from previous_bounds) and (select to_day from previous_bounds)
),
current_units as (
  select coalesce(sum(si.base_qty), 0) as units
  from public.sale_items si
  join filtered f on f.id = si.sale_id
),
previous_units as (
  select coalesce(sum(si.base_qty), 0) as units
  from public.sale_items si
  join previous_sales p on p.id = si.sale_id
),
summary as (
  select
    coalesce(sum(f.total), 0) as revenue,
    coalesce(sum(f.profit), 0) as profit,
    coalesce(sum(f.tax), 0) as tax,
    count(*)::integer as transactions,
    coalesce(round(avg(f.total), 2), 0) as ticket,
    (select units from current_units) as units,
    (select coalesce(sum(e.amount), 0) from period_expenses e) as expenses,
    (select count(*)::integer from period_expenses) as expense_count
  from filtered f
),
previous_summary as (
  select
    coalesce(sum(p.total), 0) as revenue,
    coalesce(sum(p.profit), 0) as profit,
    count(*)::integer as transactions,
    coalesce(round(avg(p.total), 2), 0) as ticket,
    (select units from previous_units) as units,
    (select coalesce(sum(e.amount), 0) from previous_expenses e) as expenses,
    (select count(*)::integer from previous_expenses) as expense_count
  from previous_sales p
),
daily_sales as (
  select
    (s.date at time zone 'America/Lima')::date as day,
    s.id,
    s.total,
    s.profit
  from public.sales s
  where s.status = 'pagada'
    and s.deleted_at is null
    and s.date >= (
      (greatest(p_from, p_to - 91) - 1)::timestamp at time zone 'America/Lima'
    )
    and s.date < (select to_ts from bounds)
    and (p_doc_type is null or s.doc_type::text = p_doc_type)
    and (p_user_id is null or s.user_id = p_user_id)
),
daily_raw as (
  select
    d::date as day,
    coalesce(sum(ds.total), 0) as revenue,
    coalesce(sum(ds.profit), 0) as profit,
    count(ds.id)::integer as sales_count
  from generate_series(
    (greatest(p_from, p_to - 91) - 1)::timestamp,
    p_to::timestamp,
    interval '1 day'
  ) d
  left join daily_sales ds on ds.day = d::date
  group by d
),
daily as (
  select
    day,
    revenue,
    profit,
    sales_count,
    coalesce(lag(revenue) over (order by day), 0) as previous_revenue
  from daily_raw
),
month_series as (
  select generate_series(
    date_trunc('month', p_to) - interval '5 months',
    date_trunc('month', p_to),
    interval '1 month'
  ) as month
),
month_sales as (
  select
    date_trunc('month', s.date at time zone 'America/Lima') as month,
    coalesce(sum(s.total), 0) as revenue,
    coalesce(sum(s.profit), 0) as profit
  from public.sales s
  where s.status = 'pagada'
    and s.deleted_at is null
    and s.date >= ((date_trunc('month', p_to) - interval '5 months') at time zone 'America/Lima')
    and s.date < ((date_trunc('month', p_to) + interval '1 month') at time zone 'America/Lima')
  group by 1
),
month_expenses as (
  select
    date_trunc('month', e.date) as month,
    coalesce(sum(e.amount), 0) as expenses
  from public.expenses e
  where e.deleted_at is null
    and e.date >= (date_trunc('month', p_to)::date - interval '5 months')
    and e.date < (date_trunc('month', p_to)::date + interval '1 month')
  group by 1
),
monthly as (
  select
    ms.month::date as month,
    coalesce(s.revenue, 0) as revenue,
    coalesce(s.profit, 0) as profit,
    coalesce(e.expenses, 0) as expenses
  from month_series ms
  left join month_sales s on s.month = ms.month
  left join month_expenses e on e.month = ms.month
),
category_totals as (
  select
    p.category_id as id,
    coalesce(c.name, 'Otros') as name,
    coalesce(c.color, '#94a3b8') as color,
    round(sum(si.unit_price * si.qty), 2) as total
  from filtered f
  join public.sale_items si on si.sale_id = f.id
  left join public.products p on p.id = si.product_id
  left join public.categories c on c.id = p.category_id
  group by 1, 2, 3
),
product_totals as (
  select
    si.product_id as id,
    si.name,
    si.sku,
    round(sum(coalesce(si.base_qty, 0)), 3) as units,
    round(sum(si.unit_price * si.qty), 2) as revenue
  from filtered f
  join public.sale_items si on si.sale_id = f.id
  group by 1, 2, 3
),
payment_totals as (
  select
    coalesce(pm.code::text, 'efectivo') as method,
    round(sum(sp.amount), 2) as total
  from filtered f
  join public.sale_payments sp on sp.sale_id = f.id
  left join public.payment_methods pm on pm.id = sp.payment_method_id
  group by 1
),
period_cashiers as (
  select s.user_id
  from public.sales s
  where s.status = 'pagada'
    and s.deleted_at is null
    and s.date >= (select from_ts from bounds)
    and s.date < (select to_ts from bounds)
),
cashier_list as (
  select distinct
    pc.user_id as id,
    coalesce(pr.full_name, pr.email, 'Sin usuario') as name
  from period_cashiers pc
  left join public.profiles pr on pr.id = pc.user_id
),
expense_totals as (
  select
    coalesce(ec.name, 'Otros') as category,
    round(sum(e.amount), 2) as amount,
    count(*)::integer as count
  from period_expenses e
  left join public.expense_categories ec on ec.id = e.category_id
  group by 1
),
item_counts as (
  select si.sale_id, count(*)::integer as items_count
  from public.sale_items si
  join filtered f on f.id = si.sale_id
  group by si.sale_id
),
sales_rows as (
  select
    f.id,
    f.code,
    f.date,
    f.doc_type::text as doc_type,
    f.customer_name,
    coalesce(pr.full_name, pr.email, 'Sin usuario') as cashier_name,
    coalesce(ic.items_count, 0) as items_count,
    f.total,
    f.profit
  from filtered f
  left join public.profiles pr on pr.id = f.user_id
  left join item_counts ic on ic.sale_id = f.id
),
today_sales as (
  select coalesce(sum(s.total), 0) as revenue
  from public.sales s
  where s.status = 'pagada'
    and s.deleted_at is null
    and s.date >= (date_trunc('day', now() at time zone 'America/Lima')::timestamp at time zone 'America/Lima')
    and s.date < ((date_trunc('day', now() at time zone 'America/Lima') + interval '1 day')::timestamp at time zone 'America/Lima')
    and (p_doc_type is null or s.doc_type::text = p_doc_type)
    and (p_user_id is null or s.user_id = p_user_id)
)
select jsonb_build_object(
  'from', p_from,
  'to', p_to,
  'summary', (select to_jsonb(s) from summary s),
  'previous', (select to_jsonb(p) from previous_summary p),
  'today_revenue', (select revenue from today_sales),
  'daily', (
    select coalesce(jsonb_agg(to_jsonb(d) order by d.day), '[]'::jsonb)
    from daily d
    where d.day >= greatest(p_from, p_to - 91)
  ),
  'monthly', (
    select coalesce(jsonb_agg(to_jsonb(m) order by m.month), '[]'::jsonb)
    from monthly m
  ),
  'categories', (
    select coalesce(jsonb_agg(to_jsonb(c) order by c.total desc), '[]'::jsonb)
    from category_totals c
    where c.total > 0
  ),
  'products', (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.revenue desc), '[]'::jsonb)
    from (
      select * from product_totals
      order by revenue desc
      limit greatest(p_top_limit, 1)
    ) t
  ),
  'payments', (
    select coalesce(jsonb_agg(to_jsonb(p) order by p.total desc), '[]'::jsonb)
    from payment_totals p
  ),
  'cashiers', (
    select coalesce(jsonb_agg(to_jsonb(c) order by c.name), '[]'::jsonb)
    from cashier_list c
  ),
  'expenses', (
    select coalesce(jsonb_agg(to_jsonb(e) order by e.amount desc), '[]'::jsonb)
    from expense_totals e
  ),
  'sales', (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.date desc), '[]'::jsonb)
    from (
      select * from sales_rows
      order by date desc
      limit case
        when p_sales_limit is null or p_sales_limit <= 0 then null
        else p_sales_limit
      end
    ) r
  )
);
$$;

grant execute on function public.report_overview(date, date, text, uuid, integer, integer) to authenticated;
