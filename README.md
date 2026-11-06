# VendiGo · Sistema de gestión para minimarket

Aplicación de punto de venta y administración para minimarket, construida con **React 19 + Vite + TypeScript + Tailwind CSS** en el frontend y **Supabase** (PostgreSQL, Auth, Storage, Realtime y RPC) como backend completo. No existe un servidor Node/Express intermedio: la lógica crítica vive en funciones de base de datos transaccionales y la seguridad en RLS.

## Índice

- [Stack](#stack)
- [Requisitos](#requisitos)
- [Puesta en marcha](#puesta-en-marcha-supabase-en-la-nube-unico-backend)
- [Variables de entorno](#variables-de-entorno)
- [Primer administrador y usuarios de prueba](#primer-administrador-y-usuarios-de-prueba)
- [Scripts](#scripts)
- [Arquitectura](#arquitectura)
- [Base de datos](#base-de-datos)
- [Roles y permisos](#roles-y-permisos)
- [Operaciones transaccionales (RPC)](#operaciones-transaccionales-rpc)
- [Almacenamiento](#almacenamiento)
- [Tiempo real](#tiempo-real)
- [Impresión térmica](#impresión-térmica)
- [Verificación funcional](#verificación-funcional)
- [Despliegue](#despliegue)
- [Solución de problemas](#solución-de-problemas)

## Stack

| Capa | Tecnología |
|------|------------|
| UI | React 19, React Router 7, Tailwind CSS 4, shadcn/ui, lucide-react, Recharts |
| Formularios | React Hook Form + Zod |
| Estado | Zustand (`auth`, `ui`, `pos-cart`, `data`) |
| Backend | Supabase: PostgreSQL 15, Auth, Storage, Realtime, RLS, RPC |
| Cliente | `@supabase/supabase-js` tipado con `src/types/database.ts` |
| Build | Vite 8 + TypeScript 7 + React Compiler |
| Tests | `bun test` (equivalencias de presentaciones) |

El color primario del tema es `oklch(71.5% 0.143 215.221)` y el diseño original se conserva sin cambios.

## Requisitos

- [Bun](https://bun.sh) 1.2+ (o Node 20+ con `npm`/`pnpm`)
- Docker Desktop o Docker Engine + Compose (solo para Supabase local)
- Supabase CLI (se usa vía `bunx supabase`, no hace falta instalarla globalmente)

```bash
bun install
```

## Puesta en marcha (Supabase en la nube, único backend)

1. Crea un proyecto en [supabase.com/dashboard](https://supabase.com/dashboard) y espera a que termine el aprovisionamiento.
2. Copia `.env.example` a `.env` y completa:

   ```env
   VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   SEED_DEMO_PASSWORD=<contraseña de las cuentas demo, mínimo 8 caracteres>
   ```

   La publishable key está en **Project Settings → API**. La `service_role` key solo se usa en el script de seed (server-side) y **nunca** se expone al navegador: no lleva prefijo `VITE_`. `SEED_DEMO_PASSWORD` es obligatoria cuando el proyecto no es local; el seed crea un administrador y se niega a usar la contraseña de demostración contra un Supabase remoto.

3. Vincula la carpeta con el proyecto y aplica las migraciones:

   ```bash
   bunx supabase login
   bunx supabase link --project-ref <project-ref>
   bunx supabase db push
   ```

   `db push` ejecuta en orden todas las migraciones de `supabase/migrations/` (tablas, enums, funciones, triggers, índices, RLS, políticas, vistas, storage y seeds).

4. Crea los usuarios (y opcionalmente el histórico de demostración):

   ```bash
   bun scripts/seed-auth.mjs
   ```

   El script crea los usuarios demo con `service_role`, sincroniza sus perfiles (rol y estado incluidos) y solo siembra ventas si la tabla `sales` está vacía. Para producción puedes editarlo o crear el administrador desde **Authentication → Users** y asignarle el rol con:

   ```sql
   update public.profiles
      set role_code = 'administrador', active = true
    where id = '<uuid-del-usuario>';
   ```

   El trigger `on_auth_user_created` crea el perfil automáticamente con rol `cajero` y la cuenta **inactiva**: el rol enviado en el metadata de Auth se ignora, así que un registro público no puede autoasignarse privilegios. La cuenta empieza a operar cuando un administrador la activa. El registro público está deshabilitado (`enable_signup = false` en `supabase/config.toml`); las cuentas del personal se crean desde el panel o con el script de seed.

5. Genera/actualiza los tipos TypeScript (opcional, ya están versionados):

   ```bash
   bunx supabase gen types typescript --linked > src/types/database.ts
   ```

6. Ejecuta el frontend:

   ```bash
   bun run dev
   ```

   Abre `http://localhost:5173`. Si faltan las variables de entorno, la app muestra una pantalla explícita de configuración en lugar de fallar de forma opaca.

## Variables de entorno

| Variable | Dónde | Uso |
|----------|-------|-----|
| `VITE_SUPABASE_URL` | `.env` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` | Clave pública (publishable/anon) usada por el navegador |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` | Solo scripts server-side (`seed-auth.mjs`, `verify-e2e.mjs` no la usa) |

Reglas de seguridad:

- El frontend únicamente usa la publishable key.
- La `service_role` omite RLS: no debe llegar al bundle ni a un repositorio público.
- `.env` y cualquier `.env.*` están en `.gitignore`; versiona solo `.env.example`.

## Primer administrador y usuarios de prueba

`scripts/seed-auth.mjs` es idempotente: crea los usuarios que falten, actualiza contraseña y metadatos de los existentes, sincroniza `profiles.role_code` y deja abierta la caja `CAJA-01`.

| Correo | Rol | Estado |
|--------|-----|--------|
| `admin@vendigo.pe` | administrador | activo |
| `gerente@vendigo.pe` | gerente | activo |
| `supervisor@vendigo.pe` | supervisor | activo |
| `cajero@vendigo.pe` | cajero | activo |
| `almacen@vendigo.pe` | almacenero | activo |
| `cajero2@vendigo.pe` | cajero | inactivo |

Contraseña de todos: `SEED_DEMO_PASSWORD`. Si no se define y el proyecto es local, el seed usa `vendigo123`; contra un proyecto remoto el script aborta. El panel de cuentas de prueba solo se muestra en desarrollo (`import.meta.env.DEV`).

## Scripts

```bash
bun run dev         # servidor de desarrollo (localhost, http)
bun run dev:lan     # dev con https:// autofirmado + host en la red: probá el escáner desde el celular abriendo la URL https:// que imprime la terminal
bun run build       # tipos + build de producción
bun run preview     # sirve el build
bun run lint        # oxlint
bun test tests      # tests unitarios
bun run verify:e2e  # verificación funcional contra el proyecto Supabase linkeado
bun scripts/seed-auth.mjs  # usuarios demo + datos iniciales
```

## Arquitectura

```text
src/
  components/          UI (layout, ui kit, POS, ventas, comprobantes)
  hooks/               hooks de datos y utilidades
  lib/                 supabase.ts, utils, auth-storage
  pages/               login, dashboard, pos, productos, inventario, compras,
                       devoluciones, caja, gastos, reportes, roles, clientes...
  services/            acceso a Supabase (queries, catalog, sales, purchases,
                       cash, people, storage, errores)
  stores/              Zustand: auth, ui, pos-cart, data
  store/               shims de compatibilidad (auth.tsx, theme.tsx, demo-store.tsx)
  types/               modelos de dominio + database.ts generado
supabase/migrations/   SQL ordenado y reproducible
scripts/               seed de auth y verificación E2E
```

Flujo de datos:

1. `DemoStoreProvider` restaura la sesión (`authStore.bootstrap()`), carga el snapshot (`fetchSnapshot`) y se suscribe a Realtime.
2. Las páginas leen el snapshot desde `useDemoStore()` (store Zustand `data`).
3. Las mutaciones son asíncronas: llaman a un servicio, esperan la RPC/tabla y vuelven a cargar el snapshot. Las recargas solapadas se coalescen.
4. El carrito del POS vive en `usePosCart` (Zustand) y solo se convierte en venta al confirmar `createSale`, que corre en Postgres dentro de una transacción.

No se guarda estado crítico solo en el navegador: precios, stock, totales, impuestos y numeración se resuelven en el servidor.

## Base de datos

### Migraciones

| Archivo | Contenido |
|---------|-----------|
| `20261031000100_extensions_enums.sql` | Extensiones y enums (`role_code`, `base_unit`, `purchase_unit`, estados, métodos) |
| `20261031000200_catalog.sql` | `profiles`, `roles`, `permissions`, `role_permissions`, categorías, marcas, proveedores, unidades, productos, presentaciones, clientes |
| `20261031000300_inventory_purchasing.sql` | Almacenes, inventario, movimientos, ajustes, compras, gastos |
| `20261031000400_pos.sql` | Ventas, ítems, pagos, métodos de pago, cajas, sesiones, movimientos de caja, series y correlativos |
| `20261031000500_helpers.sql` | Helpers de permisos, auditoría, numeración y triggers de timestamps |
| `20261031000600_rpc_sales_cash.sql` | `create_sale`, `void_sale`, apertura/cierre de caja, movimientos, `record_expense` |
| `20261031000700_rpc_purchasing_returns.sql` | Compras, recepción, anulación, ajustes de stock, devoluciones de venta y compra |
| `20261031000800_rls.sql` | RLS, políticas y privilegios por rol |
| `20261031000900_views.sql` | Vistas de reportes |
| `20261031001000_storage.sql` | Buckets y políticas de Storage |
| `20261031001100_seed.sql` | Roles, permisos, catálogo base, productos demo, series |
| `20261031001200_void_purchase.sql` | Anulación de compras con reversión de stock |
| `20261031001300_profile_privilege_guard.sql` | Bloquea la auto-escalada de rol/estado en `profiles` |
| `20261031001400_product_price_sync.sql` | Sincroniza `products.price` con la presentación base en ambos sentidos |
| `20261031001500_harden_new_user_profile.sql` | `handle_new_user` ignora el rol del metadata de Auth y crea el perfil inactivo |
| `20261031001600_restrict_function_execute.sql` | Revoca el `execute` masivo de funciones y concede solo las RPC de la aplicación |
| `20261031001700_guard_soft_delete.sql` | El borrado lógico exige el permiso `*.delete`; cierra el bypass vía UPDATE |
| `20261031001800_profile_directory.sql` | `profiles` solo se lee propio o con `roles.view`; `v_profile_directory` expone solo el nombre |

### Tablas principales

- **Identidad**: `profiles`, `roles`, `permissions`, `role_permissions`.
- **Catálogo**: `categories`, `brands`, `suppliers`, `units`, `products`, `product_presentations`.
- **Inventario y compras**: `warehouses`, `inventory`, `inventory_movements`, `stock_adjustments`, `purchase_orders`, `purchase_items`, `expense_categories`, `expenses`.
- **Ventas y caja**: `sales`, `sale_items`, `sale_payments`, `payment_methods`, `cash_registers`, `cash_sessions`, `cash_movements`, `sale_returns`, `sale_return_items`.
- **Documentos**: `document_series`, `document_sequences`, `audit_logs`.

Convenciones: UUID como clave primaria, `created_at`/`updated_at`, soft delete (`deleted_at`) en catálogo, FKs con `on delete restrict/set null`, CHECK para cantidades y montos, UNIQUE para SKU, códigos y correlativos.

### Presentaciones y equivalencias

`product_presentations` guarda la etiqueta visible (`UND`, `KG`, `CAJA`, `SACO`, `MEDIA CAJA`, `MEDIO SACO`, `DOCENA`, etc.), el `factor` de conversión a la unidad base y un precio propio. El inventario siempre se guarda en unidad base; las RPC multiplican la cantidad vendida o comprada por el factor.

Ejemplo: `CAJA` con `factor = 12` descuenta 12 unidades por cada caja vendida. Una compra de 1 caja con costo 36 suma 12 unidades al stock.

### Vistas de reportes

`v_daily_sales`, `v_monthly_sales`, `v_top_products`, `v_low_stock`, `v_cashier_performance`, `v_expenses_summary`, `v_purchases_summary`, `v_inventory_valuation`, `v_cash_sessions`, `v_sales_daily_profit`.

### Auditoría

`audit_logs` registra login, altas/cambios de producto y precios, ajustes de inventario, ventas, anulaciones, devoluciones y movimientos de caja mediante `log_audit` y triggers.

## Roles y permisos

Los permisos se resuelven en Postgres con `has_permission(module, action)`; RLS y las RPC los verifican, no el frontend. La interfaz oculta acciones, pero el control real está en la base.

| Rol | Alcance |
|-----|---------|
| **administrador** | Todos los permisos, configuración, roles y borrado de ventas |
| **gerente** | Administración operativa; sin gestión de roles, configuración ni borrado de ventas |
| **supervisor** | Lectura amplia, anulación de ventas (`sales.update`) y aprobación de devoluciones |
| **cajero** | POS, su caja, sus ventas y comprobantes; sin precios, inventario, compras ni configuración |
| **almacenero** | Productos, inventario y compras |

El cajero no puede modificar precios, borrar ventas, alterar inventario ni cambiar su propio rol: el trigger `guard_profile_privileges` y las políticas RLS lo impiden incluso enviando requests manipulados.

## Operaciones transaccionales (RPC)

Todas reciben un `jsonb` y devuelven el documento creado. Son `security definer` con `search_path` fijo y verifican permisos al inicio.

| Función | Permiso | Efecto |
|---------|---------|--------|
| `create_sale(p_payload)` | `pos.create` | Resuelve precios/costos en servidor, descuenta stock, registra ítems y pagos, actualiza la sesión de caja y numera el comprobante. Rechaza stock insuficiente y pagos que no cubren el total. |
| `void_sale(p_sale_id, p_reason)` | `sales.update` | Anula la venta y repone stock. |
| `open_cash_session(register, amount)` | `cash.create` | Abre un turno por caja registradora. |
| `close_cash_session(session, counted, notes)` | `cash.update` | Cierra el turno y guarda diferencia de arqueo. |
| `register_cash_movement(session, type, amount)` | `cash.update` | Ingresos, retiros, gastos y ajustes de caja. |
| `record_expense(p_payload)` | `expenses.create` | Registra el gasto y lo descuenta de la caja abierta. |
| `create_purchase(p_payload)` | `purchases.create` | Crea la orden con ítems y totales. |
| `receive_purchase(purchase_id)` | `purchases.update` | Suma stock y recalcula el costo promedio. |
| `void_purchase(purchase_id, reason)` | `purchases.update` | Anula y revierte stock. |
| `create_stock_adjustment(product, qty, reason)` | `inventory.update` | Ajusta stock; crea la fila de inventario si es un alta. |
| `create_sale_return(p_payload)` | `returns.create` | Registra la devolución en estado pendiente. |
| `approve_sale_return(return_id, approve)` | `returns.approve` | Aprueba y repone stock, o rechaza. |
| `next_document_number(doc_type, series)` | interno | Correlativo atómico con lock de fila; sin duplicados. |
| `seed_demo_history(...)`, `seed_open_cash_session(...)` | `service_role` | Datos de demostración; revocadas para `anon`/`authenticated`. |

Payload de venta:

```json
{
  "doc_type": "boleta",
  "customer_name": "Clientes varios",
  "customer_doc": "—",
  "global_discount": 0,
  "items": [
    { "product_id": "<uuid>", "presentation_id": "<uuid>", "qty": 2, "discount": 0 }
  ],
  "payments": [
    { "method": "efectivo", "amount": 20, "reference": null },
    { "method": "visa", "amount": 44.5, "reference": "POS-01" }
  ]
}
```

`method` es el `code` de `payment_methods`: `efectivo`, `visa`, `mastercard`, `yape`, `plin`, `transferencia`. El impuesto es 18 % y se calcula sobre el total.

La venta se asocia automáticamente a la sesión de caja abierta del usuario. Si no existe, responde `Debes abrir una caja antes de cobrar`.

## Almacenamiento

| Bucket | Público | Límite | Formatos |
|--------|---------|--------|----------|
| `product-images` | sí | 5 MB | png, jpeg, webp, avif |
| `logos` | sí | 2 MB | png, jpeg, webp, svg |
| `documents` | no | 10 MB | pdf, xml, txt |

Las imágenes de producto se suben desde el formulario y se guarda la URL pública en `products.image_url`. Las políticas permiten lectura pública de imágenes y escritura solo con permiso de productos.

Formulario de producto acepta la imagen por tres caminos: el botón (diálogo de archivos), arrastrar el archivo sobre la tarjeta de vista previa y pegar con `Ctrl+V` desde el portapapeles. Todo archivo se procesa con `browser-image-compression` en un Web Worker (redimensionado a 1024 px, techo de ~0.5 MB, con watchdog de 20 s); los GIF pasan sin procesar para no perder la animación.

## Tiempo real

`DemoStoreProvider` abre un canal de Supabase sobre `inventory`, `sales`, `cash_sessions` y tablas relacionadas. Cada evento programa una recarga del snapshot con debounce de 250 ms, por lo que el dashboard, el POS y las alertas de stock se actualizan sin polling.

## Impresión térmica

Los comprobantes se generan en `src/components/receipts/receipt-preview.tsx` a partir del modelo de la venta (no de HTML persistido). El CSS de impresión define tamaños de 58 mm y 80 mm con `@page`, por lo que el ticket se reconstruye desde los datos y puede reimprimirse sin guardar markup como fuente de verdad.

## Verificación funcional

`bun run verify:e2e` ejecuta una batería contra el Supabase local usando solo la publishable key, igual que el navegador:

- login y perfil ligado a `auth.users`
- envío de correo de recuperación de contraseña
- RLS: cajero sin creación de productos, sin escalada de rol, sin compras, sin borrado de ventas, solo sus sesiones de caja
- CRUD de producto, presentaciones UND + CAJA, ajuste inicial de stock
- orden de compra y recepción con conversión CAJA → 12 und
- venta POS con pago mixto (efectivo + VISA + Yape), total e IGV calculados en servidor
- rechazo de venta por stock insuficiente
- multi-almacén: el stock de ALM-02 no se mezcla con el turno de CAJA-01 (ALM-01)
- actualización de totales de caja, cierre con arqueo y reapertura
- devolución de venta aprobada por supervisor con reposición de stock
- disponibilidad de las 9 vistas de reportes
- baja lógica del producto temporal

Antes de ejecutarlo por primera vez: `bun scripts/seed-auth.mjs` (requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env`).

El script deja datos de prueba (un producto desactivado, una compra recibida, una venta devuelta y la caja `CAJA-01` reabierta con S/ 200).

## Despliegue

1. `bun run build` genera `dist/`.
2. Publica `dist/` en el hosting estático de tu preferencia (Vercel, Netlify, Cloudflare Pages, S3 + CDN).
3. Configura las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en el entorno de build.
4. Agrega el dominio final en **Authentication → URL Configuration** (Site URL y Redirect URLs) para que funcione la recuperación de contraseña.
5. Revisa que RLS esté activo en todas las tablas y que `service_role` no aparezca en el bundle (`grep -r "service_role" dist/`).

## Solución de problemas

| Síntoma | Causa / solución |
|---------|------------------|
| Pantalla de configuración al abrir la app | Faltan `VITE_SUPABASE_URL` o `VITE_SUPABASE_PUBLISHABLE_KEY`; reinicia el dev server tras editar `.env` |
| `Debes abrir una caja antes de cobrar` | El cajero no tiene turno abierto; ábrelo en **Cierres de caja** |
| `new row violates row-level security policy` | El rol no tiene el permiso de esa operación; revisa `role_permissions` |
| `Los pagos no cubren el total de la venta` | Suma de pagos menor al total calculado en servidor |
| Recuperación de contraseña no llega | En local revisa **Authentication → URL Configuration** (Site URL y Redirect URLs del proyecto hospedado) |
| Tipos desactualizados | `bunx supabase gen types typescript --linked > src/types/database.ts` |

## Notas de arquitectura

- El stock que ve la sesión se resuelve con `resolveWarehouseId`: almacén del turno de caja abierto del usuario y, si no hay turno, el almacén por defecto. Así el POS cobra contra el mismo almacén que muestra.
- `products.price` y la presentación base se mantienen sincronizados por triggers en ambos sentidos; `create_sale` siempre usa el precio de la presentación.
