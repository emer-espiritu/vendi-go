-- =============================================================================
-- VendiGo · 0002 · Identidad, catálogo, clientes y almacenes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles y permisos
-- -----------------------------------------------------------------------------
create table if not exists public.roles (
  code public.app_role primary key,
  name text not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  code text primary key,
  module text not null,
  action text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  unique (module, action)
);

create table if not exists public.role_permissions (
  role_code public.app_role not null references public.roles(code) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_code, permission_code)
);

-- -----------------------------------------------------------------------------
-- Perfiles ligados a auth.users
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  role_code public.app_role not null default 'cajero' references public.roles(code),
  avatar_url text,
  active boolean not null default true,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists profiles_role_idx on public.profiles(role_code);
create index if not exists profiles_email_idx on public.profiles(lower(email));

-- -----------------------------------------------------------------------------
-- Catálogo
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text not null default '📦',
  color text not null default '#0ea5e9',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.units (
  code text primary key,
  name text not null,
  kind text not null check (kind in ('base', 'purchase', 'presentation')),
  base_unit public.base_unit,
  factor numeric(14, 3) not null default 1 check (factor > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ruc text unique,
  contact text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  category text not null default 'General',
  rating numeric(3, 2) not null default 5 check (rating >= 0 and rating <= 5),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text not null default '',
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists warehouses_one_default
  on public.warehouses ((is_default)) where is_default and deleted_at is null;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  barcode text,
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  base_unit public.base_unit not null default 'und',
  purchase_unit public.purchase_unit,
  pack_size numeric(14, 3) check (pack_size is null or pack_size > 0),
  -- Precio de la presentación base (factor 1), con IGV incluido.
  price numeric(12, 2) not null default 0 check (price >= 0),
  -- Costo por unidad base.
  cost numeric(12, 4) not null default 0 check (cost >= 0),
  min_stock numeric(14, 3) not null default 0 check (min_stock >= 0),
  tax_rate numeric(5, 4) not null default 0.1800 check (tax_rate >= 0 and tax_rate <= 1),
  image_url text,
  emoji text not null default '📦',
  expires_at date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_supplier_idx on public.products(supplier_id);
create index if not exists products_active_idx on public.products(active) where deleted_at is null;
create unique index if not exists products_barcode_unique
  on public.products(barcode) where barcode is not null;
create index if not exists products_name_search_idx on public.products using gin (to_tsvector('spanish', name));

create table if not exists public.product_presentations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,
  -- Unidades base contenidas en una unidad de esta presentación.
  factor numeric(14, 3) not null check (factor > 0),
  price numeric(12, 2) not null check (price >= 0),
  barcode text,
  is_base boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, label)
);

create unique index if not exists product_presentations_one_base
  on public.product_presentations(product_id) where is_base;
create unique index if not exists product_presentations_barcode_unique
  on public.product_presentations(barcode) where barcode is not null;
create index if not exists product_presentations_product_idx
  on public.product_presentations(product_id);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  doc_type public.identity_doc_type not null default 'DNI',
  doc_number text,
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  segment public.customer_segment not null default 'minorista',
  purchases_count integer not null default 0 check (purchases_count >= 0),
  total_spent numeric(14, 2) not null default 0 check (total_spent >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists customers_doc_unique
  on public.customers(doc_number) where doc_number is not null;
create index if not exists customers_name_idx on public.customers(lower(name));

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles', 'categories', 'brands', 'suppliers', 'warehouses', 'products',
    'product_presentations', 'customers'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', tbl, tbl);
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      tbl, tbl
    );
  end loop;
end $$;
