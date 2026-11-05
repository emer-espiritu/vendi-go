-- =============================================================================
-- VendiGo · 0011 · Datos base y demo
--
-- Idempotente: se puede aplicar sobre una base existente sin duplicar filas.
-- Los usuarios de Auth se crean aparte con el script server-side
-- (`scripts/seed-auth.mjs`), que usa la service_role key.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
insert into public.roles (code, name, description) values
  ('administrador', 'Administrador', 'Control total del sistema y la configuración'),
  ('gerente', 'Gerente', 'Administración operativa del negocio'),
  ('supervisor', 'Supervisor', 'Supervisión de ventas, caja y devoluciones'),
  ('cajero', 'Cajero', 'Punto de venta y caja de su turno'),
  ('almacenero', 'Almacenero', 'Catálogo, inventario y compras')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
insert into public.permissions (code, module, action, description) values
  ('dashboard.view', 'dashboard', 'view', 'Ver el dashboard'),
  ('pos.view', 'pos', 'view', 'Ver el punto de venta'),
  ('pos.create', 'pos', 'create', 'Registrar ventas'),
  ('products.view', 'products', 'view', 'Ver productos'),
  ('products.create', 'products', 'create', 'Crear productos'),
  ('products.update', 'products', 'update', 'Editar productos y presentaciones'),
  ('products.delete', 'products', 'delete', 'Eliminar productos'),
  ('inventory.view', 'inventory', 'view', 'Ver inventario y movimientos'),
  ('inventory.create', 'inventory', 'create', 'Registrar ajustes de inventario'),
  ('inventory.update', 'inventory', 'update', 'Modificar inventario'),
  ('customers.view', 'customers', 'view', 'Ver clientes'),
  ('customers.create', 'customers', 'create', 'Crear clientes'),
  ('customers.update', 'customers', 'update', 'Editar clientes'),
  ('customers.delete', 'customers', 'delete', 'Eliminar clientes'),
  ('suppliers.view', 'suppliers', 'view', 'Ver proveedores'),
  ('suppliers.create', 'suppliers', 'create', 'Crear proveedores'),
  ('suppliers.update', 'suppliers', 'update', 'Editar proveedores'),
  ('suppliers.delete', 'suppliers', 'delete', 'Eliminar proveedores'),
  ('purchases.view', 'purchases', 'view', 'Ver compras'),
  ('purchases.create', 'purchases', 'create', 'Registrar compras'),
  ('purchases.update', 'purchases', 'update', 'Recibir compras y devoluciones'),
  ('purchases.delete', 'purchases', 'delete', 'Anular compras'),
  ('expenses.view', 'expenses', 'view', 'Ver gastos'),
  ('expenses.create', 'expenses', 'create', 'Registrar gastos'),
  ('expenses.update', 'expenses', 'update', 'Editar gastos y categorías'),
  ('expenses.delete', 'expenses', 'delete', 'Eliminar gastos'),
  ('returns.view', 'returns', 'view', 'Ver devoluciones'),
  ('returns.create', 'returns', 'create', 'Registrar devoluciones'),
  ('returns.approve', 'returns', 'approve', 'Aprobar o rechazar devoluciones'),
  ('cash.view', 'cash', 'view', 'Ver su propia caja'),
  ('cash.view_all', 'cash', 'view_all', 'Ver todas las cajas'),
  ('cash.create', 'cash', 'create', 'Abrir caja'),
  ('cash.update', 'cash', 'update', 'Mover y cerrar caja'),
  ('sales.view', 'sales', 'view', 'Ver sus propias ventas'),
  ('sales.view_all', 'sales', 'view_all', 'Ver todas las ventas'),
  ('sales.update', 'sales', 'update', 'Anular ventas'),
  ('sales.delete', 'sales', 'delete', 'Eliminar ventas'),
  ('receipts.view', 'receipts', 'view', 'Ver comprobantes'),
  ('reports.view', 'reports', 'view', 'Ver reportes'),
  ('roles.view', 'roles', 'view', 'Ver usuarios y roles'),
  ('roles.update', 'roles', 'update', 'Administrar usuarios y roles'),
  ('settings.view', 'settings', 'view', 'Ver configuración'),
  ('settings.update', 'settings', 'update', 'Modificar configuración'),
  ('audit.view', 'audit', 'view', 'Ver auditoría')
on conflict (code) do nothing;

-- Administrador: todo.
insert into public.role_permissions (role_code, permission_code)
select 'administrador', p.code from public.permissions p
on conflict do nothing;

-- Gerente: todo salvo administración de roles, configuración y borrado de ventas.
insert into public.role_permissions (role_code, permission_code)
select 'gerente', p.code
from public.permissions p
where p.code not in ('roles.update', 'settings.update', 'sales.delete')
on conflict do nothing;

-- Supervisor: lectura amplia, anulación de ventas y aprobación de devoluciones.
insert into public.role_permissions (role_code, permission_code)
select 'supervisor', p.code
from public.permissions p
where p.code in (
  'dashboard.view', 'pos.view', 'products.view', 'inventory.view',
  'customers.view', 'suppliers.view', 'purchases.view', 'expenses.view',
  'returns.view', 'returns.approve', 'cash.view', 'cash.view_all',
  'sales.view', 'sales.view_all', 'sales.update', 'receipts.view', 'reports.view'
)
on conflict do nothing;

-- Cajero: POS, su caja y sus comprobantes. Sin precios, inventario ni configuración.
insert into public.role_permissions (role_code, permission_code)
select 'cajero', p.code
from public.permissions p
where p.code in (
  'dashboard.view', 'pos.view', 'pos.create', 'products.view', 'inventory.view',
  'customers.view', 'customers.create', 'cash.view', 'cash.create', 'cash.update',
  'sales.view', 'receipts.view', 'returns.view', 'returns.create'
)
on conflict do nothing;

-- Almacenero: catálogo, inventario y compras.
insert into public.role_permissions (role_code, permission_code)
select 'almacenero', p.code
from public.permissions p
where p.code in (
  'dashboard.view', 'products.view', 'products.create', 'products.update',
  'inventory.view', 'inventory.create', 'inventory.update',
  'suppliers.view', 'suppliers.create', 'suppliers.update',
  'purchases.view', 'purchases.create', 'purchases.update'
)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Unidades
-- -----------------------------------------------------------------------------
insert into public.units (code, name, kind, base_unit, factor) values
  ('und', 'Unidad', 'base', 'und', 1),
  ('kg', 'Kilogramo', 'base', 'kg', 1),
  ('lt', 'Litro', 'base', 'lt', 1),
  ('ml', 'Mililitro', 'base', 'ml', 1),
  ('g', 'Gramo', 'base', 'g', 1),
  ('caja', 'Caja', 'purchase', 'und', 12),
  ('saco', 'Saco', 'purchase', 'kg', 50),
  ('bolsa', 'Bolsa', 'purchase', 'und', 1),
  ('paquete', 'Paquete', 'purchase', 'und', 1),
  ('docena', 'Docena', 'presentation', 'und', 12),
  ('media_caja', 'Media caja', 'presentation', 'und', 6),
  ('medio_saco', 'Medio saco', 'presentation', 'kg', 25)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Métodos de pago
-- -----------------------------------------------------------------------------
insert into public.payment_methods (code, name, kind, requires_reference) values
  ('efectivo', 'Efectivo', 'efectivo', false),
  ('visa', 'VISA', 'tarjeta', false),
  ('mastercard', 'Mastercard', 'tarjeta', false),
  ('yape', 'Yape', 'billetera', false),
  ('plin', 'Plin', 'billetera', false),
  ('transferencia', 'Transferencia', 'transferencia', true)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Almacenes y cajas
-- -----------------------------------------------------------------------------
insert into public.warehouses (code, name, address, is_default) values
  ('ALM-01', 'Almacén principal', 'Av. Argentina 2200, Callao', true),
  ('ALM-02', 'Tienda principal', 'Av. Los Álamos 452, San Juan de Lurigancho', false)
on conflict (code) do nothing;

insert into public.cash_registers (code, name, warehouse_id)
select v.code, v.name, w.id
from (values
  ('CAJA-01', 'Caja principal', 'ALM-01'),
  ('CAJA-02', 'Caja secundaria', 'ALM-01'),
  ('CAJA-03', 'Caja almacén', 'ALM-02')
) as v(code, name, warehouse_code)
join public.warehouses w on w.code = v.warehouse_code
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Series de documentos
-- -----------------------------------------------------------------------------
insert into public.document_series (doc_type, series, description) values
  ('boleta', 'B001', 'Boleta de venta electrónica'),
  ('boleta', 'D001', 'Boleta de venta demo'),
  ('boleta', 'BC01', 'Boleta de caja secundaria'),
  ('boleta', 'BD01', 'Boleta de caja almacén'),
  ('factura', 'F001', 'Factura electrónica'),
  ('guia', 'G001', 'Guía de remisión')
on conflict (series) do nothing;

-- -----------------------------------------------------------------------------
-- Categorías, marcas, proveedores, clientes, gastos
-- -----------------------------------------------------------------------------
insert into public.categories (name, emoji, color) values
  ('Abarrotes', '🍚', '#f59e0b'),
  ('Bebidas', '🥤', '#0ea5e9'),
  ('Lácteos', '🥛', '#6366f1'),
  ('Limpieza', '🧼', '#14b8a6'),
  ('Cuidado personal', '🧴', '#ec4899'),
  ('Snacks', '🍪', '#f97316'),
  ('Frutas y verduras', '🍎', '#22c55e'),
  ('Panadería', '🥖', '#a16207')
on conflict (name) do nothing;

insert into public.brands (name) values
  ('Costeño'), ('Primor'), ('Don Vittorio'), ('Cartavio'), ('Florida'),
  ('Gloria'), ('Laive'), ('Bonlé'), ('Inca Kola'), ('Coca-Cola'),
  ('San Mateo'), ('Pilsen'), ('Bolívar'), ('Clorox'), ('Elite'),
  ('Dove'), ('Sedal'), ('Field'), ('Sublime'), ('Lays'), ('Oreo')
on conflict (name) do nothing;

insert into public.suppliers (name, ruc, contact, phone, email, address, category, rating, active) values
  ('Distribuidora Andina S.A.', '20100047218', 'Silvia Ramos', '+51 987 220 110', 'ventas@distandina.pe', 'Av. Argentina 2200, Callao', 'Abarrotes', 4.8, true),
  ('Lácteos del Norte E.I.R.L.', '20481237765', 'Diego Paredes', '+51 955 118 220', 'pedidos@lacteosnorte.pe', 'Carretera Panamericana Norte km 32', 'Lácteos', 4.5, true),
  ('Bebidas Perú Distribución', '20512398764', 'Karla Medina', '+51 941 552 887', 'cuentas@bebidasperu.pe', 'Av. Los Frutales 340, Ate', 'Bebidas', 4.2, true),
  ('Limpieza Total S.A.C.', '20601239877', 'Hugo Salazar', '+51 932 778 430', 'ventas@limpiezatotal.pe', 'Jr. Cusco 780, Lima', 'Limpieza y cuidado', 3.9, true),
  ('Snacks del Pacífico', '20456781234', 'Paola Herrera', '+51 978 663 201', 'comercial@snackspacifico.pe', 'Av. Elmer Faucett 890, Callao', 'Snacks', 4.6, true),
  ('Mercado Mayorista Santa Anita', '20123456789', 'Raúl Campos', '+51 990 334 112', 'contacto@mayoristasanta.pe', 'Av. Los Chancas 1200, Santa Anita', 'Frescos', 4.1, false)
on conflict (ruc) do nothing;

insert into public.customers (name, doc_type, doc_number, email, phone, address, segment, purchases_count, total_spent) values
  ('María Fernández Rojas', 'DNI', '45781203', 'maria.fernandez@gmail.com', '+51 987 112 334', 'Av. Los Álamos 452, San Juan de Lurigancho', 'minorista', 34, 1284.60),
  ('Bodega Doña Rosa E.I.R.L.', 'RUC', '20548712361', 'ventas@bodegadonarosa.pe', '+51 998 445 220', 'Jr. Puno 128, Cercado de Lima', 'mayorista', 58, 8940.25),
  ('Luis Alberto Paredes', 'DNI', '09876543', 'luis.paredes@hotmail.com', '+51 955 332 118', 'Calle Las Begonias 210, Surco', 'minorista', 12, 486.90),
  ('Corporación Andina Foods S.A.C.', 'RUC', '20601234578', 'compras@andinafoods.pe', '+51 941 220 887', 'Av. Argentina 3455, Callao', 'corporativo', 21, 15320.40),
  ('Juana Quispe Mamani', 'DNI', '72145980', 'juana.quispe@gmail.com', '+51 932 778 001', 'Av. Grau 890, Ate', 'minorista', 27, 962.30),
  ('Minimarket El Sol', 'RUC', '20451237896', 'admin@minimarkelelsol.pe', '+51 913 445 660', 'Av. Próceres 1220, San Juan de Lurigancho', 'mayorista', 44, 6410.75),
  ('Pedro Sánchez Villalobos', 'DNI', '41237856', 'pedro.sanchez@gmail.com', '+51 978 110 442', 'Jr. Huallaga 320, Lima', 'minorista', 8, 321.40),
  ('Rosa Elena Chávez', 'DNI', '40339871', 'rosa.chavez@gmail.com', '+51 967 552 301', 'Calle Los Cedros 78, Miraflores', 'minorista', 19, 704.15),
  ('Restaurante Sabor Criollo', 'RUC', '20567890123', 'pedidos@saborcriollo.pe', '+51 990 221 445', 'Av. Universitaria 1780, Los Olivos', 'corporativo', 37, 11205.80),
  ('Carmen Ríos Aguilar', 'DNI', '70981234', 'carmen.rios@gmail.com', '+51 954 887 003', 'Av. Colonial 2100, Callao', 'minorista', 6, 214.50)
on conflict (doc_number) where doc_number is not null do nothing;

insert into public.expense_categories (name) values
  ('Alquiler'), ('Servicios'), ('Sueldos'), ('Transporte'), ('Mantenimiento'), ('Marketing'), ('Seguridad'), ('Otros')
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- Productos demo
-- -----------------------------------------------------------------------------
insert into public.products (
  sku, name, barcode, category_id, supplier_id, base_unit, purchase_unit,
  pack_size, price, cost, min_stock, emoji, expires_at, active
)
select
  v.sku, v.name, v.barcode, c.id, s.id,
  v.base_unit::public.base_unit,
  nullif(v.purchase_unit, '')::public.purchase_unit,
  nullif(v.pack_size, 0)::numeric,
  v.price, v.cost, v.min_stock, v.emoji,
  nullif(v.expires_at, '')::date,
  v.active
from (values
  ('ABA-ARZ-005', 'Arroz Costeño Extra 5 kg', '7750182001234', 'Abarrotes', 'Distribuidora Andina S.A.', 'und', 'caja', 12, 24.90, 19.50, 12, '🍚', '2027-04-30', true),
  ('ABA-ACE-001', 'Aceite Primor Premium 1 L', '7751276002318', 'Abarrotes', 'Distribuidora Andina S.A.', 'und', 'caja', 12, 12.90, 10.20, 10, '🫒', '2027-02-15', true),
  ('ABA-FID-500', 'Fideos Don Vittorio 500 g', '7750243011013', 'Abarrotes', 'Distribuidora Andina S.A.', 'und', 'paquete', 10, 4.20, 3.10, 20, '🍝', '2027-06-30', true),
  ('ABA-AZU-001', 'Azúcar Rubia Cartavio 1 kg', '7750105003042', 'Abarrotes', 'Distribuidora Andina S.A.', 'kg', 'saco', 50, 5.60, 4.40, 15, '🍬', '2027-08-01', true),
  ('ABA-ATU-170', 'Atún Florida 170 g', '7750335001017', 'Abarrotes', 'Lácteos del Norte E.I.R.L.', 'und', 'caja', 12, 6.90, 5.30, 15, '🐟', '2028-03-01', true),
  ('LAC-LEC-400', 'Leche Gloria Entera 400 g', '7750204001029', 'Lácteos', 'Lácteos del Norte E.I.R.L.', 'und', 'caja', 12, 4.90, 3.80, 24, '🥛', '2026-11-12', true),
  ('LAC-YOG-001', 'Yogurt Laive Fresa 1 L', '7751835002091', 'Lácteos', 'Lácteos del Norte E.I.R.L.', 'lt', '', 0, 8.90, 6.60, 8, '🍶', '2026-11-04', true),
  ('LAC-QUE-250', 'Queso Fresco Bonlé 250 g', '7750209004011', 'Lácteos', 'Lácteos del Norte E.I.R.L.', 'und', '', 0, 9.50, 7.20, 6, '🧀', '2026-11-02', true),
  ('LAC-MAN-200', 'Mantequilla Gloria 200 g', '7750204005014', 'Lácteos', 'Lácteos del Norte E.I.R.L.', 'und', '', 0, 11.40, 8.90, 6, '🧈', '2026-12-20', true),
  ('BEB-INC-150', 'Inca Kola 1.5 L', '7750674001011', 'Bebidas', 'Bebidas Perú Distribución', 'und', 'caja', 12, 8.50, 6.20, 12, '🥤', '2027-01-30', true),
  ('BEB-COK-500', 'Coca-Cola Zero 500 ml', '7750674008034', 'Bebidas', 'Bebidas Perú Distribución', 'und', 'caja', 12, 3.50, 2.40, 20, '🥤', '2027-03-01', true),
  ('BEB-AGU-625', 'Agua San Mateo 625 ml', '7751276009010', 'Bebidas', 'Bebidas Perú Distribución', 'und', 'paquete', 12, 2.00, 1.20, 30, '💧', '2027-05-10', true),
  ('BEB-CER-650', 'Cerveza Pilsen 650 ml', '7750186004015', 'Bebidas', 'Bebidas Perú Distribución', 'und', 'caja', 12, 9.90, 7.40, 12, '🍺', '2027-02-28', true),
  ('LIM-DET-900', 'Detergente Bolívar 900 g', '7750242005016', 'Limpieza', 'Limpieza Total S.A.C.', 'und', '', 0, 9.90, 7.50, 10, '🧼', '2028-01-01', true),
  ('LIM-LEJ-001', 'Lejía Clorox 1 L', '7751276015080', 'Limpieza', 'Limpieza Total S.A.C.', 'lt', '', 0, 5.20, 3.80, 10, '🧴', '2027-09-15', true),
  ('LIM-PAP-004', 'Papel Higiénico Elite x4', '7750249002019', 'Limpieza', 'Limpieza Total S.A.C.', 'und', 'paquete', 4, 10.90, 8.30, 12, '🧻', '', true),
  ('CUI-JAB-090', 'Jabón Dove 90 g', '7750249011012', 'Cuidado personal', 'Limpieza Total S.A.C.', 'und', '', 0, 4.80, 3.30, 15, '🧼', '2027-07-20', true),
  ('CUI-SHA-340', 'Shampoo Sedal 340 ml', '7750249022015', 'Cuidado personal', 'Limpieza Total S.A.C.', 'und', '', 0, 13.90, 10.60, 8, '🧴', '2027-11-01', true),
  ('SNA-GAL-006', 'Galleta Soda Field 6 pack', '7750183003015', 'Snacks', 'Snacks del Pacífico', 'und', '', 0, 3.90, 2.70, 20, '🍪', '2026-12-05', true),
  ('SNA-CHO-030', 'Chocolate Sublime 30 g', '7750183007020', 'Snacks', 'Snacks del Pacífico', 'und', 'caja', 12, 2.50, 1.70, 25, '🍫', '2026-11-20', true),
  ('SNA-PAP-110', 'Papas Lays 110 g', '7750183009031', 'Snacks', 'Snacks del Pacífico', 'und', '', 0, 4.20, 3.00, 15, '🍟', '2026-12-15', true),
  ('SNA-ORE-036', 'Galleta Oreo 36 g', '7750183010020', 'Snacks', 'Snacks del Pacífico', 'und', 'caja', 12, 1.80, 1.10, 30, '🍪', '2027-01-10', true),
  ('FRU-PLA-001', 'Plátano de seda', '2000000000015', 'Frutas y verduras', 'Mercado Mayorista Santa Anita', 'kg', '', 0, 3.20, 2.10, 8, '🍌', '2026-11-01', true),
  ('FRU-MAN-001', 'Manzana Delicia', '2000000000022', 'Frutas y verduras', 'Mercado Mayorista Santa Anita', 'kg', 'caja', 20, 6.90, 5.10, 6, '🍎', '2026-11-06', true),
  ('FRU-POL-001', 'Pollo Entero fresco', '2000000000039', 'Frutas y verduras', 'Mercado Mayorista Santa Anita', 'kg', '', 0, 12.90, 10.10, 8, '🍗', '2026-10-30', true),
  ('PAN-FRA-001', 'Pan Francés', '2000000000046', 'Panadería', 'Mercado Mayorista Santa Anita', 'kg', '', 0, 8.00, 5.60, 5, '🥖', '2026-10-31', true)
) as v(
  sku, name, barcode, category_name, supplier_name, base_unit, purchase_unit,
  pack_size, price, cost, min_stock, emoji, expires_at, active
)
join public.categories c on c.name = v.category_name
left join public.suppliers s on s.name = v.supplier_name
on conflict (sku) do nothing;

-- -----------------------------------------------------------------------------
-- Presentaciones (espejo de `buildPresentations` del frontend)
-- -----------------------------------------------------------------------------
do $$
declare
  p record;
  v_pack_price numeric(12, 2);
begin
  for p in select * from public.products loop
    insert into public.product_presentations
      (product_id, label, factor, price, is_base, sort_order)
    values
      (p.id, upper(p.base_unit::text), 1, p.price, true, 4)
    on conflict (product_id, label) do nothing;

    if p.purchase_unit is not null and p.pack_size is not null and p.pack_size > 1 then
      v_pack_price := round(p.price * p.pack_size * 0.95, 2);

      insert into public.product_presentations
        (product_id, label, factor, price, is_base, sort_order)
      values
        (p.id, upper(p.purchase_unit::text), p.pack_size, v_pack_price, false, 1)
      on conflict (product_id, label) do nothing;

      insert into public.product_presentations
        (product_id, label, factor, price, is_base, sort_order)
      values
        (p.id, '1/2 ' || upper(p.purchase_unit::text), p.pack_size / 2,
         round(v_pack_price / 2, 2), false, 2)
      on conflict (product_id, label) do nothing;

      if p.base_unit = 'und' and p.pack_size >= 12 then
        insert into public.product_presentations
          (product_id, label, factor, price, is_base, sort_order)
        values
          (p.id, 'DOCENA', 12, round(p.price * 12, 2), false, 3)
        on conflict (product_id, label) do nothing;
      end if;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Stock inicial en el almacén principal
-- -----------------------------------------------------------------------------
insert into public.inventory (product_id, warehouse_id, stock)
select p.id, w.id, v.stock
from (values
  ('ABA-ARZ-005', 48::numeric), ('ABA-ACE-001', 36), ('ABA-FID-500', 80),
  ('ABA-AZU-001', 60), ('ABA-ATU-170', 55), ('LAC-LEC-400', 72),
  ('LAC-YOG-001', 18), ('LAC-QUE-250', 0), ('LAC-MAN-200', 14),
  ('BEB-INC-150', 40), ('BEB-COK-500', 65), ('BEB-AGU-625', 120),
  ('BEB-CER-650', 24), ('LIM-DET-900', 32), ('LIM-LEJ-001', 28),
  ('LIM-PAP-004', 45), ('CUI-JAB-090', 50), ('CUI-SHA-340', 22),
  ('SNA-GAL-006', 70), ('SNA-CHO-030', 95), ('SNA-PAP-110', 38),
  ('SNA-ORE-036', 110), ('FRU-PLA-001', 25.5), ('FRU-MAN-001', 18),
  ('FRU-POL-001', 0), ('PAN-FRA-001', 12)
) as v(sku, stock)
join public.products p on p.sku = v.sku
join public.warehouses w on w.code = 'ALM-01'
on conflict (product_id, warehouse_id) do nothing;
