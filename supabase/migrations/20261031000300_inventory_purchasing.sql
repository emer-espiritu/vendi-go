-- =============================================================================
-- VendiGo · 0003 · Inventario, compras, gastos y devoluciones
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Inventario (siempre en unidad base)
-- -----------------------------------------------------------------------------
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  stock numeric(14, 3) not null default 0 check (stock >= 0),
  reserved numeric(14, 3) not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now(),
  unique (product_id, warehouse_id)
);

create index if not exists inventory_warehouse_idx on public.inventory(warehouse_id);
create index if not exists inventory_low_stock_idx on public.inventory(stock);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  type public.movement_type not null,
  -- Cantidad firmada expresada en unidad base.
  qty numeric(14, 3) not null,
  stock_after numeric(14, 3) not null,
  reason text not null default '',
  reference text,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_product_idx
  on public.inventory_movements(product_id, created_at desc);
create index if not exists inventory_movements_created_idx
  on public.inventory_movements(created_at desc);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  qty numeric(14, 3) not null,
  reason text not null default '',
  status public.adjustment_status not null default 'aprobado',
  user_id uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- -----------------------------------------------------------------------------
-- Compras
-- -----------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  date date not null default current_date,
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  tax numeric(14, 2) not null default 0 check (tax >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  status public.purchase_status not null default 'pendiente',
  document_type public.document_type not null default 'factura',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists purchase_orders_supplier_idx on public.purchase_orders(supplier_id);
create index if not exists purchase_orders_date_idx on public.purchase_orders(date desc);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  presentation_id uuid references public.product_presentations(id) on delete set null,
  name text not null default '',
  qty numeric(14, 3) not null check (qty > 0),
  unit text not null default 'UND',
  factor numeric(14, 3) not null default 1 check (factor > 0),
  base_qty numeric(14, 3) not null check (base_qty > 0),
  unit_cost numeric(12, 4) not null default 0 check (unit_cost >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0)
);

create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_id);

create table if not exists public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  purchase_id uuid not null references public.purchase_orders(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  date date not null default current_date,
  total numeric(14, 2) not null default 0 check (total >= 0),
  reason text not null default '',
  status public.return_status not null default 'pendiente',
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.purchase_returns(id) on delete cascade,
  purchase_item_id uuid not null references public.purchase_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14, 3) not null check (qty > 0),
  base_qty numeric(14, 3) not null check (base_qty > 0),
  unit_cost numeric(12, 4) not null default 0,
  subtotal numeric(14, 2) not null default 0
);

-- -----------------------------------------------------------------------------
-- Gastos
-- -----------------------------------------------------------------------------
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null check (kind in ('efectivo', 'tarjeta', 'billetera', 'transferencia')),
  requires_reference boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category_id uuid references public.expense_categories(id) on delete set null,
  cash_session_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  date date not null default current_date,
  description text not null default '',
  amount numeric(14, 2) not null check (amount > 0),
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists expenses_date_idx on public.expenses(date desc);
create index if not exists expenses_category_idx on public.expenses(category_id);

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['purchase_orders', 'expenses'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', tbl, tbl);
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      tbl, tbl
    );
  end loop;
end $$;
