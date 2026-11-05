# VendiGo — Frontend POS (login + dashboard + módulos)

Objetivo: interfaz completa frontend-only para POS de minimarket sobre el scaffold Vite de `vendiGo`.
Branch: sin repositorio git (no se inicializa). Runner: `bun run build` (tsc -b + vite build), `bun run lint` (oxlint).
Entrega: sin backend, datos demo en memoria, preparada para conectar API después.

## Specs

- **S1** Pantalla de LOGIN "profesional, moderna y elegante para un sistema de gestión de minimarket grande o centro comercial".
- **S2** "todo el proyecto debe ser únicamente FRONTEND, sin backend ni conexión a bases de datos".
- **S3** React + TypeScript + Tailwind CSS en toda la interfaz.
- **S4** Color principal obligatorio `oklch(71.5% 0.143 215.221)` en "botones, detalles, elementos activos y componentes destacados" (equivale a `#00b8db` para SVG/canvas).
- **S5** LOGIN con: usuario o correo electrónico, contraseña, mostrar/ocultar contraseña, recordar sesión y recuperación de contraseña.
- **S6** Validaciones con Zod y React Hook Form, "incluyendo mensajes de error profesionales".
- **S7** Autenticación "visualmente atractiva, con identidad corporativa, iconografía y diseño responsive".
- **S8** Selector de modo DARK y LIGHT "utilizando el color principal en ambos temas".
- **S9** Dashboard post-login con estadísticas de ventas, ingresos, ganancias, gastos y productos vendidos.
- **S10** Gráficos interactivos: ventas diarias, mensuales, ganancias y rendimiento comercial.
- **S11** Módulo de productos con CRUD visual, categorías, códigos de barras, SKU, precios, costos y fotografías.
- **S12** Inventario con stock mínimo, alertas de agotados, vencimientos y movimientos.
- **S13** Módulo POS: buscar productos, escanear códigos de barras, agregar cantidades y aplicar descuentos.
- **S14** Métodos de pago: efectivo, VISA, Mastercard, Yape, Plin y pagos mixtos.
- **S15** Boletas y facturas con vista previa e impresión para impresoras térmicas de 58 mm y 80 mm.
- **S16** Módulos visuales de clientes, proveedores, compras, gastos, devoluciones y cierres de caja.
- **S17** Reportes avanzados con filtros y exportación a PDF y Excel.
- **S18** Roles visuales administrador, gerente, cajero, supervisor y almacenero, con navegación según permisos simulados.
- **S19** Componentes reutilizables, sidebar dinámico, navbar, tablas avanzadas, buscadores, notificaciones y animaciones sutiles.
- **S20** Interfaz completa y funcional a nivel frontend, datos demo realistas, código limpio y arquitectura escalable.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Fundaciones (deps, tokens Tailwind v4, tema, tipos, datos demo, store, permisos, router, UI kit, layout) | S2-S4, S8, S19, S20 | inline | done | src/index.css, src/types, src/data, src/store, src/components/ui, src/components/layout |
| T2 Login completo | S1, S5-S8 | inline | done | src/pages/login.tsx |
| T3 Dashboard + gráficos | S9, S10 | inline | done | src/pages/dashboard.tsx, src/components/charts |
| T4 Productos CRUD | S11 | delegated | done | src/pages/products.tsx |
| T5 Inventario | S12 | delegated | done | src/pages/inventory.tsx |
| T6 POS + pagos | S13, S14 | inline | done | src/pages/pos.tsx, src/components/pos |
| T7 Comprobantes + impresión térmica | S15 | inline | done | src/pages/receipts.tsx, src/components/receipts |
| T8 Clientes, proveedores, compras, gastos, devoluciones, cierres | S16 | delegated | done | src/pages/customers.tsx, suppliers.tsx, purchases.tsx, expenses.tsx, returns.tsx, cash-closings.tsx |
| T9 Reportes + exportación | S17 | delegated | done | src/pages/reports.tsx, src/lib/export.ts |
| T10 Roles y permisos | S18 | inline | done | src/pages/roles.tsx, src/lib/permissions.ts |
| T11 Verificación build + lint + flujos E2E | S20 | inline | done | ver L3 y L4 |

## Log

**L1** (30/10/2026, verbatim): "usa el proyecto vendiGo que esta lenavantado un proyecto bun create vite no modifiques ni detales de lo que ya esta desintalada: y haste fronted: 1. Lo primero que debes desarrollar es una pantalla de LOGIN profesional, moderna y elegante para un sistema de gestión de minimarket grande o centro comercial. 2. Por el momento, todo el proyecto debe ser únicamente FRONTEND, sin backend ni conexión a bases de datos. 3. Utiliza React, TypeScript y Tailwind CSS para desarrollar toda la interfaz. 4. Establece como color principal obligatorio: oklch(71.5% 0.143 215.221), utilizándolo en botones, detalles, elementos activos y componentes destacados. 5. El LOGIN debe incluir usuario o correo electrónico, contraseña, mostrar/ocultar contraseña, recordar sesión y recuperación de contraseña. 6. Implementa validaciones de formularios con Zod y React Hook Form, incluyendo mensajes de error profesionales. 7. Diseña una experiencia de autenticación visualmente atractiva, con identidad corporativa, iconografía y diseño responsive. 8. Incluye selector de modo DARK y LIGHT, utilizando el color principal en ambos temas. 9. Después del LOGIN, desarrolla un Dashboard principal con estadísticas de ventas, ingresos, ganancias, gastos y productos vendidos. 10. Implementa gráficos interactivos para visualizar ventas diarias, mensuales, ganancias y rendimiento comercial. 11. Crea un módulo de productos con CRUD visual, categorías, códigos de barras, SKU, precios, costos y fotografías. 12. Implementa inventario con stock mínimo, alertas de productos agotados, vencimientos y movimientos. 13. Desarrolla un módulo POS moderno para buscar productos, escanear códigos de barras, agregar cantidades y aplicar descuentos. 14. Incluye métodos de pago como efectivo, VISA, Mastercard, Yape, Plin y pagos mixtos. 15. Diseña un módulo de boletas y facturas con vista previa e impresión para impresoras térmicas de 58 mm y 80 mm. 16. Implementa módulos visuales de clientes, proveedores, compras, gastos, devoluciones y cierres de caja. 17. Desarrolla reportes avanzados con filtros y opciones de exportación a PDF y Excel. 18. Incluye roles visuales de administrador, gerente, cajero, supervisor y almacenero, con navegación según permisos simulados. 19. Utiliza componentes reutilizables, sidebar dinámico, navbar, tablas avanzadas, buscadores, notificaciones y animaciones sutiles. 20. Entrega una interfaz completa, funcional a nivel frontend, con datos de demostración realistas, código limpio y arquitectura escalable, preparada para conectar un backend posteriormente."

**L2** Decisiones de arquitectura:
- Dependencias agregadas sin tocar las existentes: react-router-dom, zod, react-hook-form, @hookform/resolvers, recharts, lucide-react, clsx, tailwindcss, @tailwindcss/vite.
- Alias `@/*` → `src/*` en tsconfig.app.json + vite.config.ts.
- Tailwind v4 con tokens semánticos en `@theme inline` (background, card, line, muted, brand, success/warn/danger/info) y `dark` por clase en `<html>`.
- Estado demo centralizado en `DemoStoreProvider` (en memoria) para que POS, inventario, comprobantes, reportes y dashboard compartan datos.
- Autenticación simulada con 5 cuentas demo (una por rol), contraseña común `vendigo123`, persistida en localStorage.
- Exportación: Excel real vía SpreadsheetML 2003 (`.xls`, sin dependencias), PDF vía vista de impresión optimizada (Guardar como PDF del navegador) reutilizando el CSS de impresión térmica/A4.
- Sin backend, sin base de datos, sin red: todas las imágenes de producto son subidas por el usuario (data URL) o fallback con emoji por categoría.

**L3** Verificación estática: `bun run build` (tsc -b + vite build) OK y `bun run lint` OK (solo warnings de React Compiler, exit 0); revisión manual de login, dashboard, POS, comprobantes 58/80 mm, CRUDs y reportes en dev server.

**L4** (30/10/2026) Verificación funcional E2E con WebDriver/Firefox headless sobre el dev server: **21/21 flujos OK**.
- Login: campos requeridos, formato de correo, mostrar/ocultar contraseña, recuperación de contraseña (validación + envío simulado), login válido y persistencia de sesión.
- Tema: dark/light conmuta el fondo y conserva la marca `oklch(71.5% 0.143 215.221)`; tokens verificados por `getComputedStyle`.
- Dashboard: 5 StatCards (Ventas, Ingresos, Ganancias, Gastos, Productos vendidos) y 4 gráficos Recharts renderizados.
- POS: doble clic rápido suma cantidad en la misma línea (sin duplicar), producto agotado deshabilitado, error de monto cero en pagos, pago mixto Efectivo + VISA registrado en el comprobante, conmutación 80 mm → 58 mm del `@page`, deep link `/comprobantes?code=` abre el modal del comprobante.
- Productos: alta y edición vía modal (SKU con patrón AAA-AAA-000, barcode 8–14 dígitos) con toast y listado actualizado.
- Inventario: pestañas Stock/Alertas/Vencimientos/Movimientos, tarjetas Agotados y Bajo mínimo, tabla de movimientos con filas.
- Compras: recepción de orden pendiente (2 → 1 pendientes) con entrada de stock. Devoluciones: aprobación con reposición. Cierres: cierre de caja con contado = esperado y toast. Roles: cambio de rol actualiza el sidebar y `/reportes` queda denegado para almacenero. Logout: acceso sin sesión a `/dashboard` redirige a `/login`.
- Sin errores de consola desde la corrección de `addProduct` en `pos.tsx` (el único `console.error` del dev server fue la clave duplicada `p06` del bug de doble clic, previa al fix).
- Riesgo residual: sin backend real ni git; todas las pruebas de navegador se hicieron en una sola sesión en memoria.
