-- =============================================================================
-- VendiGo · 0004 · POS, caja, ventas, pagos y devoluciones de venta
-- =============================================================================

create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  cash_register_id uuid not null references public.cash_registers(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(14, 2) not null default 0 check (opening_amount >= 0),
  sales_total numeric(14, 2) not null default 0,
  expenses_total numeric(14, 2) not null default 0,
  expected_total numeric(14, 2) not null default 0,
  counted_total numeric(14, 2),
  difference numeric(14, 2),
  status public.cash_session_status not null default 'abierta',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una sola sesión abierta por caja: soporta múltiples cajas en paralelo.
create unique index if not exists cash_sessions_one_open
  on public.cash_sessions(cash_register_id) where status = 'abierta';
create index if not exists cash_sessions_user_idx on public.cash_sessions(user_id, opened_at desc);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references public.cash_sessions(id) on delete cascade,
  type public.cash_movement_type not null,
  amount numeric(14, 2) not null,
  description text not null default '',
  reference text,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cash_movements_session_idx
  on public.cash_movements(cash_session_id, created_at desc);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  series text not null,
  number text not null,
  doc_type public.document_type not null default 'boleta',
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null default 'Clientes varios',
  customer_doc text not null default '—',
  user_id uuid references public.profiles(id) on delete set null,
  cash_register_id uuid references public.cash_registers(id) on delete set null,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  date timestamptz not null default now(),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  tax numeric(14, 2) not null default 0 check (tax >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  profit numeric(14, 2) not null default 0,
  status public.sale_status not null default 'pagada',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (series, number)
);

create index if not exists sales_date_idx on public.sales(date desc);
create index if not exists sales_user_idx on public.sales(user_id, date desc);
create index if not exists sales_customer_idx on public.sales(customer_id);
create index if not exists sales_status_idx on public.sales(status);
create index if not exists sales_session_idx on public.sales(cash_session_id);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  presentation_id uuid not null references public.product_presentations(id) on delete restrict,
  name text not null,
  sku text not null,
  base_unit public.base_unit not null,
  presentation_label text not null,
  factor numeric(14, 3) not null check (factor > 0),
  qty numeric(14, 3) not null check (qty > 0),
  base_qty numeric(14, 3) not null check (base_qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  unit_cost numeric(12, 4) not null default 0,
  total_cost numeric(14, 2) not null default 0,
  profit numeric(14, 2) not null default 0
);

create index if not exists sale_items_sale_idx on public.sale_items(sale_id);
create index if not exists sale_items_product_idx on public.sale_items(product_id);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  reference text,
  status public.payment_status not null default 'completado',
  created_at timestamptz not null default now()
);

create index if not exists sale_payments_sale_idx on public.sale_payments(sale_id);

create table if not exists public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  sale_id uuid not null references public.sales(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  date date not null default current_date,
  total numeric(14, 2) not null default 0 check (total >= 0),
  reason text not null default '',
  status public.return_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sale_returns_sale_idx on public.sale_returns(sale_id);
create index if not exists sale_returns_date_idx on public.sale_returns(date desc);

create table if not exists public.sale_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sale_returns(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(14, 3) not null check (qty > 0),
  base_qty numeric(14, 3) not null check (base_qty > 0),
  unit_price numeric(12, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0
);

-- -----------------------------------------------------------------------------
-- Documentos, series y auditoría
-- -----------------------------------------------------------------------------
create table if not exists public.document_series (
  id uuid primary key default gen_random_uuid(),
  doc_type public.document_type not null,
  series text not null unique,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.document_sequences (
  series_id uuid primary key references public.document_series(id) on delete cascade,
  current_number bigint not null default 0 check (current_number >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references public.sales(id) on delete cascade,
  doc_type public.document_type not null default 'boleta',
  series text not null,
  number text not null,
  status text not null default 'emitida' check (status in ('emitida', 'enviada', 'aceptada', 'rechazada', 'anulada')),
  xml_url text,
  pdf_url text,
  hash text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  unique (series, number)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on public.audit_logs(entity, entity_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['cash_registers', 'cash_sessions', 'sales', 'sale_returns'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', tbl, tbl);
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      tbl, tbl
    );
  end loop;
end $$;
