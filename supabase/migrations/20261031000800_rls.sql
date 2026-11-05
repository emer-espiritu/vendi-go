-- =============================================================================
-- VendiGo · 0008 · Seguridad a nivel de fila (RLS) y privilegios
--
-- Regla general:
--   * El catálogo se lee con permisos de módulo.
--   * Las tablas transaccionales (ventas, inventario, caja, compras) NO admiten
--     escritura directa: solo las funciones RPC `security definer`.
--   * Ningún rol puede saltarse los permisos modificando requests del navegador,
--     porque la decisión vive en Postgres, no en el frontend.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers de visibilidad (security definer para no recursar en RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_code() = 'administrador', false);
$$;

create or replace function public.can_view_sale(p_sale_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.sales s
    where s.id = p_sale_id
      and (s.user_id = auth.uid() or public.has_permission('sales', 'view_all'))
  );
$$;

create or replace function public.can_view_cash_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.cash_sessions cs
    where cs.id = p_session_id
      and (cs.user_id = auth.uid() or public.has_permission('cash', 'view_all'))
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_view_sale(uuid) to authenticated;
grant execute on function public.can_view_cash_session(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Habilitar RLS en todas las tablas públicas
-- -----------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'roles', 'permissions', 'role_permissions', 'profiles',
    'categories', 'brands', 'units', 'suppliers', 'warehouses',
    'products', 'product_presentations', 'customers',
    'inventory', 'inventory_movements', 'stock_adjustments',
    'purchase_orders', 'purchase_items', 'purchase_returns', 'purchase_return_items',
    'expense_categories', 'payment_methods', 'expenses',
    'cash_registers', 'cash_sessions', 'cash_movements',
    'sales', 'sale_items', 'sale_payments',
    'sale_returns', 'sale_return_items',
    'document_series', 'document_sequences', 'invoices', 'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    -- No se usa FORCE: las funciones `security definer` (owner) deben poder
    -- escribir las tablas transaccionales sin políticas de INSERT.
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Identidad y permisos
-- -----------------------------------------------------------------------------
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated using (true);

drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles
  for all to authenticated
  using (public.has_permission('roles', 'update'))
  with check (public.has_permission('roles', 'update'));

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select to authenticated using (true);

drop policy if exists permissions_write on public.permissions;
create policy permissions_write on public.permissions
  for all to authenticated
  using (public.has_permission('roles', 'update'))
  with check (public.has_permission('roles', 'update'));

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated using (true);

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (public.has_permission('roles', 'update'))
  with check (public.has_permission('roles', 'update'));

-- El perfil propio se edita; la administración de roles es privilegio aparte.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (deleted_at is null or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.has_permission('roles', 'update'))
  with check (public.has_permission('roles', 'update'));

-- -----------------------------------------------------------------------------
-- Catálogo
-- -----------------------------------------------------------------------------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated using (true);

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated with check (public.has_permission('products', 'create'));

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update to authenticated
  using (public.has_permission('products', 'update'))
  with check (public.has_permission('products', 'update'));

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete to authenticated using (public.has_permission('products', 'delete'));

drop policy if exists brands_select on public.brands;
create policy brands_select on public.brands for select to authenticated using (true);
drop policy if exists brands_write on public.brands;
create policy brands_write on public.brands
  for all to authenticated
  using (public.has_permission('products', 'update'))
  with check (public.has_permission('products', 'update'));

drop policy if exists units_select on public.units;
create policy units_select on public.units for select to authenticated using (true);
drop policy if exists units_write on public.units;
create policy units_write on public.units
  for all to authenticated
  using (public.has_permission('settings', 'update'))
  with check (public.has_permission('settings', 'update'));

drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
  for select to authenticated using (deleted_at is null);

drop policy if exists suppliers_insert on public.suppliers;
create policy suppliers_insert on public.suppliers
  for insert to authenticated with check (public.has_permission('suppliers', 'create'));

drop policy if exists suppliers_update on public.suppliers;
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (public.has_permission('suppliers', 'update'))
  with check (public.has_permission('suppliers', 'update'));

drop policy if exists suppliers_delete on public.suppliers;
create policy suppliers_delete on public.suppliers
  for delete to authenticated using (public.has_permission('suppliers', 'delete'));

drop policy if exists warehouses_select on public.warehouses;
create policy warehouses_select on public.warehouses
  for select to authenticated using (true);

drop policy if exists warehouses_write on public.warehouses;
create policy warehouses_write on public.warehouses
  for all to authenticated
  using (public.has_permission('settings', 'update'))
  with check (public.has_permission('settings', 'update'));

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (deleted_at is null or public.has_permission('products', 'update'));

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert to authenticated with check (public.has_permission('products', 'create'));

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update to authenticated
  using (public.has_permission('products', 'update'))
  with check (public.has_permission('products', 'update'));

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete to authenticated using (public.has_permission('products', 'delete'));

drop policy if exists product_presentations_select on public.product_presentations;
create policy product_presentations_select on public.product_presentations
  for select to authenticated using (true);

drop policy if exists product_presentations_insert on public.product_presentations;
create policy product_presentations_insert on public.product_presentations
  for insert to authenticated with check (public.has_permission('products', 'update'));

drop policy if exists product_presentations_update on public.product_presentations;
create policy product_presentations_update on public.product_presentations
  for update to authenticated
  using (public.has_permission('products', 'update'))
  with check (public.has_permission('products', 'update'));

drop policy if exists product_presentations_delete on public.product_presentations;
create policy product_presentations_delete on public.product_presentations
  for delete to authenticated using (public.has_permission('products', 'update'));

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated using (deleted_at is null);

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert to authenticated with check (public.has_permission('customers', 'create'));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (public.has_permission('customers', 'update'))
  with check (public.has_permission('customers', 'update'));

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete to authenticated using (public.has_permission('customers', 'delete'));

-- -----------------------------------------------------------------------------
-- Inventario (lectura; escritura solo por RPC)
-- -----------------------------------------------------------------------------
drop policy if exists inventory_select on public.inventory;
create policy inventory_select on public.inventory
  for select to authenticated
  using (
    public.has_permission('inventory', 'view')
    or public.has_permission('pos', 'create')
    or public.has_permission('purchases', 'view')
  );

drop policy if exists inventory_movements_select on public.inventory_movements;
create policy inventory_movements_select on public.inventory_movements
  for select to authenticated
  using (
    public.has_permission('inventory', 'view')
    or public.has_permission('reports', 'view')
    or public.has_permission('pos', 'create')
  );

drop policy if exists stock_adjustments_select on public.stock_adjustments;
create policy stock_adjustments_select on public.stock_adjustments
  for select to authenticated using (public.has_permission('inventory', 'view'));

-- -----------------------------------------------------------------------------
-- Compras (lectura; escritura solo por RPC)
-- -----------------------------------------------------------------------------
drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders
  for select to authenticated
  using (public.has_permission('purchases', 'view') or public.has_permission('reports', 'view'));

drop policy if exists purchase_items_select on public.purchase_items;
create policy purchase_items_select on public.purchase_items
  for select to authenticated
  using (public.has_permission('purchases', 'view') or public.has_permission('reports', 'view'));

drop policy if exists purchase_returns_select on public.purchase_returns;
create policy purchase_returns_select on public.purchase_returns
  for select to authenticated
  using (public.has_permission('purchases', 'view') or public.has_permission('returns', 'view'));

drop policy if exists purchase_return_items_select on public.purchase_return_items;
create policy purchase_return_items_select on public.purchase_return_items
  for select to authenticated
  using (public.has_permission('purchases', 'view') or public.has_permission('returns', 'view'));

-- -----------------------------------------------------------------------------
-- Gastos y métodos de pago
-- -----------------------------------------------------------------------------
drop policy if exists expense_categories_select on public.expense_categories;
create policy expense_categories_select on public.expense_categories
  for select to authenticated using (true);

drop policy if exists expense_categories_write on public.expense_categories;
create policy expense_categories_write on public.expense_categories
  for all to authenticated
  using (public.has_permission('expenses', 'update'))
  with check (public.has_permission('expenses', 'update'));

drop policy if exists payment_methods_select on public.payment_methods;
create policy payment_methods_select on public.payment_methods
  for select to authenticated using (true);

drop policy if exists payment_methods_write on public.payment_methods;
create policy payment_methods_write on public.payment_methods
  for all to authenticated
  using (public.has_permission('settings', 'update'))
  with check (public.has_permission('settings', 'update'));

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (
    public.has_permission('expenses', 'view')
    or public.has_permission('cash', 'view_all')
    or user_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- Caja
-- -----------------------------------------------------------------------------
drop policy if exists cash_registers_select on public.cash_registers;
create policy cash_registers_select on public.cash_registers
  for select to authenticated using (true);

drop policy if exists cash_registers_write on public.cash_registers;
create policy cash_registers_write on public.cash_registers
  for all to authenticated
  using (public.has_permission('settings', 'update'))
  with check (public.has_permission('settings', 'update'));

drop policy if exists cash_sessions_select on public.cash_sessions;
create policy cash_sessions_select on public.cash_sessions
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('cash', 'view_all'));

drop policy if exists cash_movements_select on public.cash_movements;
create policy cash_movements_select on public.cash_movements
  for select to authenticated
  using (public.can_view_cash_session(cash_session_id));

-- -----------------------------------------------------------------------------
-- Ventas
-- -----------------------------------------------------------------------------
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('sales', 'view_all'));

drop policy if exists sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items
  for select to authenticated using (public.can_view_sale(sale_id));

drop policy if exists sale_payments_select on public.sale_payments;
create policy sale_payments_select on public.sale_payments
  for select to authenticated using (public.can_view_sale(sale_id));

drop policy if exists sale_returns_select on public.sale_returns;
create policy sale_returns_select on public.sale_returns
  for select to authenticated
  using (
    public.has_permission('returns', 'view')
    or public.has_permission('returns', 'approve')
    or public.has_permission('sales', 'view_all')
    or user_id = auth.uid()
  );

drop policy if exists sale_return_items_select on public.sale_return_items;
create policy sale_return_items_select on public.sale_return_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.sale_returns sr
      where sr.id = return_id
        and (
          public.has_permission('returns', 'view')
          or public.has_permission('returns', 'approve')
          or public.has_permission('sales', 'view_all')
          or sr.user_id = auth.uid()
        )
    )
  );

-- -----------------------------------------------------------------------------
-- Documentos y auditoría
-- -----------------------------------------------------------------------------
drop policy if exists document_series_select on public.document_series;
create policy document_series_select on public.document_series
  for select to authenticated using (true);

drop policy if exists document_series_write on public.document_series;
create policy document_series_write on public.document_series
  for all to authenticated
  using (public.has_permission('settings', 'update'))
  with check (public.has_permission('settings', 'update'));

drop policy if exists document_sequences_select on public.document_sequences;
create policy document_sequences_select on public.document_sequences
  for select to authenticated using (public.has_permission('settings', 'view'));

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated using (public.can_view_sale(sale_id));

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Privilegios de tabla.
-- `anon` no accede a tablas públicas: el login usa GoTrue, no PostgREST.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon;
-- Supabase concede `all` por defecto a `authenticated`; se retira para que las
-- escrituras directas solo existan en las tablas del catálogo listadas abajo.
revoke all on all tables in schema public from authenticated;

grant select on all tables in schema public to authenticated;

-- Solo el catálogo admite escritura directa; el resto va por RPC.
grant insert, update, delete on
  public.categories, public.brands, public.units, public.suppliers,
  public.warehouses, public.products, public.product_presentations,
  public.customers, public.expense_categories, public.payment_methods,
  public.cash_registers, public.document_series, public.roles,
  public.permissions, public.role_permissions, public.profiles
to authenticated;

grant execute on all functions in schema public to authenticated;

-- Las funciones de seed son exclusivas del backend.
revoke all on function public.seed_demo_history(uuid, integer, integer) from anon, authenticated;
revoke all on function public.seed_open_cash_session(uuid, text, numeric) from anon, authenticated;
