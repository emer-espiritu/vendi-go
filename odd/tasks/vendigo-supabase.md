# VendiGo — Migración a Supabase + Zustand (sin cambiar el diseño)

Objetivo: convertir el frontend demo de minimarket en un sistema completo sobre Supabase (PostgreSQL, Auth, Storage, RLS, Realtime, RPC) con estado global Zustand, preservando exactamente el diseño y la UI actual.
Branch: sin repositorio git. Runner: `bun test tests`, `bun run build`, `bun run lint`, `supabase db push`, E2E navegador.
Entrega: migraciones SQL ordenadas, tipos TS, servicios/hooks, stores Zustand, README y verificación en vivo contra el proyecto Supabase hospedado del usuario.

## Specs

- **S1** Supabase como backend principal (PostgreSQL, Auth, Storage, RLS, Realtime, Database Functions); sin backend Express/Node salvo necesidad estricta.
- **S2** `@supabase/supabase-js` + `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` vía `.env`.
- **S3** Auth real con Supabase Auth: login, logout, recuperación de contraseña, sesión persistente y rutas protegidas.
- **S4** Perfiles relacionados con `auth.users` mediante `profiles` y roles: administrador, gerente, supervisor, cajero, almacenero.
- **S5** RLS en TODAS las tablas públicas; políticas por usuario, rol y operación; nunca confiar solo en el frontend.
- **S6** Tablas: `profiles`, `roles`, `permissions`, `role_permissions`, `categories`, `brands`, `suppliers`, `units`, `products`, `product_presentations`, `customers`, `warehouses`.
- **S7** `product_presentations` permite UND, KG, CAJA, SACO, MEDIA CAJA, MEDIO SACO, DOCENA, etc., con equivalencias y precios independientes.
- **S8** Inventario en unidad base con conversiones automáticas; 1 SACO = 50 KG y 1 CAJA = 12 UND.
- **S9** Tablas: `inventory`, `inventory_movements`, `stock_adjustments`, `purchase_orders`, `purchase_items`, `expenses`, `expense_categories`.
- **S10** POS con `sales`, `sale_items`, `sale_payments`, `payment_methods`, `cash_registers`, `cash_sessions`, `cash_movements`.
- **S11** Una venta guarda usuario/cajero, caja, cliente, fecha, serie, número, subtotal, descuentos, impuestos, total, método de pago y estado.
- **S12** Cada `sale_item` guarda producto, presentación vendida, cantidad, unidad, equivalencia aplicada, precio unitario, descuento, subtotal y costo para utilidad.
- **S13** RPC PostgreSQL para registrar ventas transaccionalmente, descontar stock, registrar pagos, actualizar caja y rechazar stock insuficiente.
- **S14** Funciones para compras (aumentan inventario), ajustes de stock, devoluciones de ventas y devoluciones de compras.
- **S15** Numeración de comprobantes/documentos por series y correlativos, sin duplicados, con restricciones únicas.
- **S16** Tablas para invoices/receipts, `document_series` y `document_sequences`, preparadas para facturación electrónica futura.
- **S17** Storage para imágenes de productos, logos y archivos, con buckets y políticas de seguridad apropiadas.
- **S18** Zustand para auth, carrito POS, producto seleccionado, cliente seleccionado, caja activa, sesión de caja, filtros, tema dark/light y preferencias.
- **S19** El carrito Zustand permite el mismo producto en distintas presentaciones, calcula cantidades/equivalencias/descuentos/subtotal/total, pero la venta definitiva se ejecuta en Supabase con función transaccional.
- **S20** Realtime para inventario, ventas, caja y Dashboard sin polling innecesario.
- **S21** Dashboards/vistas SQL: ventas diarias y mensuales, utilidad, productos más vendidos, stock bajo, compras, gastos y rendimiento por cajero.
- **S22** Índices, foreign keys, constraints, CHECK, UNIQUE, timestamps y soft delete donde convenga.
- **S23** Auditoría con `audit_logs`: login, creación/modificación/eliminación de productos, cambios de precios, ajustes de inventario, ventas, anulaciones y movimientos de caja.
- **S24** RLS diferenciado: administrador total; gerente administración operativa; supervisor gestión limitada; cajero POS/caja/ventas; almacenero productos/inventario/compras.
- **S25** Un cajero no puede modificar precios, eliminar ventas, alterar inventario ni acceder a configuración administrativa sin permiso explícito.
- **S26** Triggers para crear perfil tras registrar en `auth.users`, actualizar timestamps y auditar.
- **S27** Operaciones críticas vía Database Functions; nada de múltiples updates críticos desde el navegador.
- **S28** TODO el SQL en migraciones Supabase ordenadas y reproducibles: tablas, enums, funciones, triggers, índices, RLS, policies, vistas y datos iniciales.
- **S29** Tipos TypeScript de todas las tablas y servicios/hooks para products, inventory, purchases, sales, POS, cash registers, customers, suppliers y reports.
- **S30** Mantener Tailwind CSS, shadcn/ui, Zod, React Hook Form, Zustand, dark/light y el color principal `oklch(71.5% 0.143 215.221)`.
- **S31** Manejo global de errores, loading states, optimistic UI solo cuando sea seguro, validaciones Zod y mensajes claros.
- **S32** Múltiples cajas y cajeros simultáneos sin mezclar sesiones.
- **S33** Apertura de caja, fondo inicial, ingresos, retiros, ventas, cierre, arqueo y diferencia de efectivo.
- **S34** Métodos de pago: efectivo, VISA, Mastercard, Yape, Plin, transferencia y pago mixto.
- **S35** Impresión de boletas/tickets para térmicas 58 mm y 80 mm sin guardar HTML como fuente de verdad.
- **S36** Permisos y seguridad en interfaz y RLS; no se puede saltar permisos modificando solicitudes.
- **S37** Nunca `service_role`/secret keys en el frontend; secretos solo en servidor/Edge Function.
- **S38** Seeds de categorías, unidades, métodos de pago, roles, permisos y productos demo para el POS.
- **S39** README completo: crear proyecto Supabase, migraciones, `.env`, primer administrador y ejecutar frontend.
- **S40** Probar login, RLS, CRUD de productos, presentaciones, compras, conversiones, inventario, POS, carrito Zustand, ventas, pagos, caja, cierre, reportes y recuperación de contraseña.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Migraciones: enums, tablas, FKs, checks, índices, soft delete | S1, S6-S16, S22, S28 | inline | done | `supabase/migrations/20261031*.sql` — 14 migraciones, `supabase db reset` limpio |
| T2 RLS + policies por rol/permiso + storage buckets | S5, S7, S17, S24-S26, S36 | inline | done | `20261031000800_rls.sql`, `20261031001000_storage.sql`, `20261031001300_profile_privilege_guard.sql`, `20261031001400_product_price_sync.sql`; RLS verificado en E2E (items de cajero) |
| T3 RPC/triggers: venta, compra, ajuste, devoluciones, caja, numeración, auditoría | S11-S15, S23, S26-S27, S32-S34 | inline | done | `20261031000600_rpc_sales_cash.sql`, `20261031000700_rpc_purchasing_returns.sql`, `20261031001200_void_purchase.sql`; 38/38 E2E |
| T4 Vistas SQL + seeds de catálogo y demo | S21, S38 | inline | done | `20261031000900_views.sql` (10 vistas), `20261031001100_seed.sql` (roles, permisos, catálogo, 20 productos demo) |
| T5 Tipos TS + cliente Supabase + env | S2, S29, S37 | inline | done | `src/types/database.ts` (1309 líneas), `src/lib/supabase.ts`, `.env.example` |
| T6 Stores Zustand: auth, carrito, POS, caja, UI/preferencias | S18-S19, S30 | inline | done | `src/stores/auth.ts`, `ui.ts`, `pos-cart.ts`, `data.ts` |
| T7 Servicios/hooks + Realtime | S20, S29, S31 | inline | done | `src/services/*`, `src/store/demo-store.tsx` (Realtime con debounce 250 ms) |
| T8 Auth real, rutas protegidas, logout, recuperación | S3, S4, S24 | inline | done | login/logout/recuperación con Supabase Auth; sesión persistente (local/sessionStorage); rutas protegidas |
| T9 Productos: CRUD, presentaciones, categorías, imágenes Storage | S6-S8, S17, S25 | inline | done | CRUD + presentaciones + categorías; imágenes a bucket `product-images`; `create_stock_adjustment` para stock inicial |
| T10 POS: carrito Zustand, RPC venta, pagos mixtos, caja y comprobantes | S10-S13, S19, S32-S35 | inline | done | carrito multi-presentación en Zustand; `create_sale` transaccional con pagos mixtos; ticket 58/80 mm |
| T11 Inventario, compras, devoluciones, gastos, clientes, proveedores | S9, S14, S25 | inline | done | compras (crear/recibir/anular), devoluciones, gastos, clientes y proveedores con errores de Supabase |
| T12 Dashboard/reportes/realtime + README + verificación | S20-S21, S39-S40 | inline | done | `README.md`, `scripts/verify-e2e.mjs` (41/41), `bunx tsc -b`/`build`/`test`/`lint` OK |

## Log

**L1** (31/10/2026, verbatim): ver el mensaje del usuario "Quiero convertir el frontend actual de mi sistema de minimarket en un sistema completo conectado a Supabase y Zustand, manteniendo exactamente el diseño existente." con los 40 puntos numerados.

**L2** Decisión de infraestructura: el usuario eligió **proyecto Supabase hospedado**. Se construirán migraciones reproducibles y se aplicarán con el CLI usando credenciales del usuario; la publishable key vive en `.env` y jamás se usa `service_role` en el frontend. Sin credenciales todavía, el código debe fallar con un mensaje claro de configuración, no con un crash opaco.

**L3** (31/10/2026): sin credenciales del proyecto hospedado, se validó todo contra Supabase local (`bunx supabase start`). Se agregó `scripts/verify-e2e.mjs` (`bun run verify:e2e`) que usa solo la publishable key, como el navegador.

**L4** (31/10/2026): el primer E2E expuso tres defectos reales y se corrigieron:
1. `revoke all on all tables ... from authenticated` en `20261031000800_rls.sql` — Supabase concede `ALL` por defecto y el cajero podía ejecutar `DELETE` sobre ventas.
2. `create_stock_adjustment` fallaba en productos nuevos porque el `UPDATE` no encontraba fila de inventario; ahora un alta positiva hace `INSERT ... ON CONFLICT DO UPDATE`.
3. El payload de venta del test no cubría el total (faltaban S/ 0.50) y el precio de la presentación base no se sincronizaba al cambiar el producto. El servidor usa `product_presentations.price`, que es la fuente de verdad; la UI sincroniza la base con `products.price`.

**L5** (31/10/2026): verificación final. `bun run verify:e2e` → **41/41** (auth, recuperación, RLS, CRUD, presentaciones, conversión CAJA→12 und, venta con pago mixto S/ 65, rechazo por stock, multi-almacén (ALM-02 intacto), caja, devolución aprobada, 9 vistas). `bunx tsc -b` sin errores, `bun run build` OK, `bun test tests` 10/10, `bun run lint` solo warnings. Se escribió `README.md` completo (S39).

**L6** (31/10/2026): pendiente para cierre en producción — aplicar `supabase db push` y `bun scripts/seed-auth.mjs` contra el proyecto hospedado del usuario cuando entregue `project-ref`, publishable key y service role para el seed. El proyecto no es un repositorio git, por lo que no hay commits ni revisión nativa.

**L7** (31/10/2026): `product_presentations` es la fuente de verdad del precio en `create_sale`; se agregó `products_sync_base_presentation` para que `products.price` y la presentación base no diverjan, con guardas `when` que evitan la recursión. Los filtros del POS (búsqueda y categoría) se movieron al store Zustand `pos-cart`.
