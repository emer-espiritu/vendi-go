# VendiGo — Presentaciones por producto (unidad base + unidad de compra)

Objetivo: un mismo producto vendible en varias presentaciones (CAJA / 1/2 CAJA / UND, SACO / 1/2 SACO / KG, DOCENA) con stock y conversiones en unidad base, sin duplicar productos.
Branch: sin repositorio git (no se inicializa). Runner: `bun test tests` (core), `bun run build`, `bun run lint`, E2E `/tmp/opencode/e2e-presentations.mjs` (Firefox + geckodriver).
Entrega: frontend-only, datos demo en memoria.

## Specs

- **S1** Cada producto debe tener una **unidad base**: UND, KG, LT, etc.
- **S2** Debe permitir definir una **unidad de compra**: CAJA, SACO, BOLSA, PAQUETE, etc.
- **S3** Debe permitir indicar cuántas unidades contiene cada presentación; "por ejemplo: 1 CAJA = 12 UND o 1 SACO = 50 KG".
- **S4** El sistema debe calcular automáticamente las equivalencias y el precio según la presentación.
- **S5** En el POS, un mismo producto debe poder venderse como **CAJA, MEDIA CAJA, UND, SACO, MEDIA SACO, KG, etc.**
- **S6** El cajero debe seleccionar fácilmente la presentación al momento de agregar el producto a la venta.
- **S7** "si un saco contiene 50 KG, permitir vender 1 SACO, 1/2 SACO, 1 KG o cualquier cantidad en KG".
- **S8** "si una caja contiene 12 UND, permitir vender 1 CAJA, 1/2 CAJA, 1 DOCENA o unidades sueltas".
- **S9** El stock debe manejarse en una **unidad base**, realizando automáticamente las conversiones.
- **S10** No crear productos duplicados para cada presentación; todas las presentaciones deben pertenecer al mismo producto.
- **S11** Permitir configurar un precio diferente para cada presentación: precio por SACO, MEDIA SACO, KG, CAJA, MEDIA CAJA y UND.
- **S12** En el POS mostrar el producto y debajo botones/opciones como: **[CAJA] [1/2 CAJA] [UND]** o **[SACO] [1/2 SACO] [KG]** según corresponda.
- **S13** El sistema debe calcular automáticamente cantidad, precio, subtotal y descuento según la presentación seleccionada.
- **S14** Mantener una interfaz simple para que el cajero pueda realizar una venta rápidamente.
- **S15** React, TypeScript, Tailwind CSS, componente de UI reutilizable y validaciones con Zod. (Supuesto declarado: el proyecto ya tiene un UI kit propio equivalente a shadcn/ui —Button, Input, Select, Field, Modal, Badge, Card, SegmentedControl—; se reutiliza y extiende en lugar de instalar un segundo sistema de componentes. Ver L2.)

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Modelo de presentaciones + helpers puros (`types`, `lib/presentations.ts`, `lib/sales.ts`, store) | S1-S4, S9-S11, S13 | inline | done | `tests/presentations.test.ts` RED (`Cannot find module '../src/lib/presentations'`) → GREEN 10/10 |
| T2 Datos demo: 26 productos con unidad base/compra/pack y ventas históricas en unidad base | S1-S4, S9, S10 | inline | done | `src/data/products.ts` (factory + `buildPresentations`); `src/data/sales.ts` con `presentationId`, `baseQty` y `baseUnit` |
| T3 Productos: formulario con unidad base, unidad de compra, pack y editor de precios por presentación; listado | S1-S4, S10, S11, S15 | inline | done | `src/pages/products.tsx`; E2E: editar Arroz 12→6 recalcula chips y alta con CAJA 12 muestra 4 presentaciones |
| T4 POS: chips de presentación por producto, carrito por presentación, cantidad/subtotal/descuento, escaneo por código de presentación | S5-S8, S12-S14 | inline | done | `src/pages/pos.tsx`; E2E: Leche CAJA+2 UND = S/ 65.66; Azúcar SACO+2,5 KG = S/ 280.00 |
| T5 Comprobantes/impresión: presentación, cantidad y equivalencia en unidad base | S13 | inline | done | `src/components/receipts/receipt-preview.tsx`; E2E: `CAJA · x12 UND = 12 UND`, `SACO · x50 KG = 50 KG` |
| T6 Inventario/analytics/reportes: etiquetas en unidad base y unidades vendidas convertidas | S9 | inline | done | `src/pages/inventory.tsx` (`BASE_UNIT_LABELS`); `src/lib/analytics.ts` (`item.baseQty`) |
| T7 Verificación: `bun test`, build, lint, E2E navegador | S15 | inline | done | `bun test tests` 10/10; `bun run build` OK; `bun run lint` exit 0; E2E 28/28 (ver L3) |

## Log

**L1** (31/10/2026, verbatim): "Quiero simplificar el módulo de productos para que un mismo producto pueda venderse en diferentes presentaciones desde el POS.

1. Cada producto debe tener una **unidad base**: UND, KG, LT, etc.
2. Debe permitir definir una **unidad de compra**: CAJA, SACO, BOLSA, PAQUETE, etc.
3. Debe permitir indicar cuántas unidades contiene cada presentación; por ejemplo: 1 CAJA = 12 UND o 1 SACO = 50 KG.
4. El sistema debe calcular automáticamente las equivalencias y el precio según la presentación.
5. En el POS, un mismo producto debe poder venderse como **CAJA, MEDIA CAJA, UND, SACO, MEDIA SACO, KG, etc.**
6. El cajero debe seleccionar fácilmente la presentación al momento de agregar el producto a la venta.
7. Ejemplo: si un saco contiene 50 KG, permitir vender 1 SACO, 1/2 SACO, 1 KG o cualquier cantidad en KG.
8. Ejemplo: si una caja contiene 12 UND, permitir vender 1 CAJA, 1/2 CAJA, 1 DOCENA o unidades sueltas.
9. El stock debe manejarse en una **unidad base**, realizando automáticamente las conversiones.
10. No crear productos duplicados para cada presentación; todas las presentaciones deben pertenecer al mismo producto.
11. Permitir configurar un precio diferente para cada presentación: precio por SACO, MEDIA SACO, KG, CAJA, MEDIA CAJA y UND.
12. En el POS mostrar el producto y debajo botones/opciones como: **[CAJA] [1/2 CAJA] [UND]** o **[SACO] [1/2 SACO] [KG]** según corresponda.
13. El sistema debe calcular automáticamente cantidad, precio, subtotal y descuento según la presentación seleccionada.
14. Mantener una interfaz simple para que el cajero pueda realizar una venta rápidamente.
15. Diseña esta funcionalidad usando React, TypeScript, Tailwind CSS, shadcn/ui y validaciones con Zod."

**L2** Decisiones de arquitectura:
- Un solo `Product` por mercancía; `presentations: Presentation[]` vive dentro del producto (S10).
- `stock`, `minStock` y `cost` permanecen en **unidad base**; cada presentación aporta `factor` (unidades base por presentación) y su `price`.
- La presentación base (`factor: 1`) es obligatoria; sus precios nunca se derivan del pack, para que el precio unitario siga siendo el ancla comercial.
- Equivalencias y precios se generan con `buildPresentations()`: pack a `basePrice × factor × 0.95` (5% de descuento por volumen, editable), media presentación a mitad del pack, docena a `basePrice × 12` cuando la unidad base es UND y el pack llega a 12. Todos los precios son editables y el formulario permite recalcularlos.
- `Presentation` puede tener `barcode` propio, de modo que escanear la caja agregue la caja y no la unidad.
- UI: se reutiliza el kit interno (equivalente a shadcn/ui) porque instalar un segundo sistema de componentes duplicaría Button/Input/Modal y rompería la consistencia visual ya entregada; los componentes nuevos (`PresentationChips`, editor de presentaciones) siguen el mismo patrón `cn(...)` + tokens de marca.
- Tests: `bun test` con `bun:test` (sin dependencias nuevas) sobre las funciones puras de `src/lib/presentations.ts` y `computeTotals`, en `tests/` fuera de `src` para que `tsc -b` no las compile.

**L3** (31/10/2026, verificación y cierre):
- Core: `bun test tests` → 10/10 (`33 expect()`), cubriendo derivación de presentaciones, equivalencias base, precio por presentación y totales.
- Build: `bun run build` → `tsc -b && vite build` OK (solo advertencia de chunk > 500 kB, preexistente).
- Lint: `bun run lint` → exit 0 (solo warnings de React Compiler preexistentes en `inventory.tsx` y `payment-modal.tsx`).
- E2E navegador (Firefox headless + geckodriver, `/tmp/opencode/e2e-presentations.mjs`) → 28/28 PASS:
  1. Login demo y POS: Leche Gloria muestra `[CAJA] [1/2 CAJA] [DOCENA] [UND]`; vender 1 CAJA + 2 UND totaliza S/ 65.66 (CAJA 55.86 + UND 9.80); comprobante imprime `CAJA · x12 UND = 12 UND`; stock en unidad base baja 72 → 58 UND.
  2. Azúcar muestra `[SACO] [1/2 SACO] [KG]`; 1 SACO + 2,5 KG totaliza S/ 280.00 (266.00 + 14.00); comprobante imprime `SACO · x50 KG = 50 KG`; stock baja 60 → 7,5 KG.
  3. Editar Arroz: pack 12 → 6 con "Recalcular precios" elimina DOCENA y el POS pasa a `[CAJA] [1/2 CAJA] [UND]`.
  4. Alta de producto con unidad de compra CAJA, pack 12 y "Recalcular precios" crea 4 presentaciones (`CAJA`, `1/2 CAJA`, `DOCENA`, `UND`) y el POS las muestra.
- Hallazgos: la equivalencia en el carrito solo se imprime cuando `factor > 1` (en KG suelto sería redundante); el separador decimal que muestra `Intl.NumberFormat` en Firefox headless cae a punto, por eso la aserción de stock acepta coma o punto (el valor es correcto: 7,5).
- Estado: T1-T7 cerradas. S1-S15 cubiertas. Sin repositorio git no hay commits ni revisión nativa; la entrega es el árbol de trabajo en `dist/` + fuentes.
