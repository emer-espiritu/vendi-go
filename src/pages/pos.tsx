import {
  ArrowRight,
  Barcode,
  CheckCircle2,
  CreditCard,
  Minus,
  Package,
  Plus,
  Printer,
  ScanLine,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { DocType, Payment, Presentation, Product, Sale } from "@/types";
import { computeTotals, PAYMENT_LABELS } from "@/lib/sales";
import {
  BASE_UNIT_LABELS,
  basePresentation,
  baseQty,
  productPresentations,
  presentationByBarcode,
  presentationStep,
  unitPrice,
} from "@/lib/presentations";
import { useAuth } from "@/store/auth";
import { cartKey, maxQtyOf, usePosCart } from "@/stores/pos-cart";
import { useScannerWedge } from "@/hooks/use-scanner-wedge";
import { messageOf } from "@/services/errors";
import { useDemoStore } from "@/store/demo-store";
import { useToast } from "@/store/toast";
import { cn, formatCurrency, formatNumber, round2 } from "@/lib/utils";
import { printDocument } from "@/lib/export";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Modal,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
} from "@/components/ui";
import { PaymentModal } from "@/components/pos/payment-modal";
import {
  PrintableReceipt,
  ReceiptPreview,
  type ReceiptWidth,
} from "@/components/receipts/receipt-preview";

/** Cámara QR (celular/webcam): chunk propio, se descarga solo al usarla. */
const ScannerModal = lazy(() => import("@/components/scanner/scanner-modal"));

const DOC_OPTIONS = [
  { value: "boleta", label: "Boleta" },
  { value: "factura", label: "Factura" },
] as const;

function stockTone(product: Product) {
  if (product.stock <= 0) return "danger" as const;
  if (product.stock <= product.minStock) return "warning" as const;
  return "success" as const;
}

export default function PosPage() {
  const { user } = useAuth();
  const { products, categories, customers, createSale } = useDemoStore();
  const lines = usePosCart((state) => state.lines);
  const globalDiscount = usePosCart((state) => state.globalDiscount);
  const docType = usePosCart((state) => state.docType);
  const customerId = usePosCart((state) => state.customerId);
  const setGlobalDiscount = usePosCart((state) => state.setGlobalDiscount);
  const setDocType = usePosCart((state) => state.setDocType);
  const setCustomerId = usePosCart((state) => state.setCustomerId);
  const addLine = usePosCart((state) => state.addLine);
  const setQty = usePosCart((state) => state.setQty);
  const setLineDiscount = usePosCart((state) => state.setLineDiscount);
  const removeLine = usePosCart((state) => state.removeLine);
  const clearCart = usePosCart((state) => state.clear);
  const search = usePosCart((state) => state.search);
  const category = usePosCart((state) => state.category);
  const setSearch = usePosCart((state) => state.setSearch);
  const setCategory = usePosCart((state) => state.setCategory);
  const resetFilters = usePosCart((state) => state.resetFilters);
  const { toast } = useToast();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [width, setWidth] = useState<ReceiptWidth>(80);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (!product.active) return false;
      if (category !== "todos" && product.categoryId !== category) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.barcode.toLowerCase().includes(term) ||
        productPresentations(product).some((item) =>
          item.barcode?.toLowerCase().includes(term),
        )
      );
    });
  }, [products, category, search]);

  const totals = useMemo(
    () => computeTotals(lines, globalDiscount),
    [lines, globalDiscount],
  );
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);

  const addProduct = (
    product: Product,
    presentation: Presentation = basePresentation(product),
  ) => {
    const result = addLine(product, presentation);
    if (result.ok) return;
    if (result.reason === "agotado") {
      toast({
        title: "Producto agotado",
        description: `${product.name} no tiene stock disponible.`,
        tone: "warning",
      });
      return;
    }
    toast({
      title: "Stock insuficiente",
      description: `Solo quedan ${formatNumber(product.stock, 2)} ${BASE_UNIT_LABELS[product.baseUnit]} (${formatNumber(Math.max(0, result.max), 2)} ${presentation.label}) de ${product.name}.`,
      tone: "warning",
    });
  };

  const resetSale = () => {
    clearCart();
    resetFilters();
    searchRef.current?.focus();
  };

  const [scannerOpen, setScannerOpen] = useState(false);

  /**
   * Único camino de alta por código escaneado: lo usan el lector físico
   * (tecla Enter del wedge o del campo), la cámara QR y la búsqueda manual.
   * La comparación es insensible a mayúsculas porque los lectores reportan el
   * código tal cual lo ven en la etiqueta.
   */
  const handleScan = (raw: string) => {
    const term = raw.trim().toLowerCase();
    if (!term) return;
    const match = products.find(
      (product) =>
        product.active &&
        (product.barcode.toLowerCase() === term ||
          product.sku.toLowerCase() === term ||
          productPresentations(product).some(
            (item) => item.barcode?.toLowerCase() === term,
          )),
    );
    if (!match) {
      toast({
        title: "Código no encontrado",
        description: `No existe un producto con el código ${raw.trim()}.`,
        tone: "error",
      });
      return;
    }
    const presentation =
      presentationByBarcode(match, term) ?? basePresentation(match);
    addProduct(match, presentation);
    setSearch("");
  };

  /** El lector USB del PC funciona sin foco en el buscador. */
  useScannerWedge({
    enabled: !paymentOpen && !successOpen && !clearOpen && !scannerOpen,
    onScan: handleScan,
  });

  const handleSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleScan(search);
  };

  const confirmSale = async (payments: Payment[]) => {
    try {
      const sale = await createSale({
        items: lines.map((line) => ({
          productId: line.product.id,
          name: line.product.name,
          sku: line.product.sku,
          baseUnit: line.product.baseUnit,
          presentationId: line.presentation.id,
          presentationLabel: line.presentation.label,
          factor: line.presentation.factor,
          price: line.presentation.price,
          cost: line.product.cost,
          qty: line.qty,
          baseQty: baseQty(line.presentation, line.qty),
          discount: line.discount,
        })),
        discount: globalDiscount,
        payments,
        docType,
        customer: selectedCustomer
          ? {
              id: selectedCustomer.id,
              name: selectedCustomer.name,
              doc: selectedCustomer.docNumber,
            }
          : undefined,
        cashier: user?.name ?? "Caja",
      });

      setLastSale(sale);
      setPaymentOpen(false);
      setSuccessOpen(true);
      resetSale();
      toast({
        title: "Venta registrada",
        description: `Se generó el comprobante ${sale.code} por ${formatCurrency(sale.total)}.`,
        tone: "success",
      });
    } catch (cause) {
      toast({
        title: "No se pudo cobrar la venta",
        description: messageOf(cause),
        tone: "error",
      });
      throw cause;
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operación"
        title="Punto de venta"
        description="Escanea un código de barras o busca productos para armar la venta. Los precios incluyen IGV."
        icon={ScanLine}
        actions={
          <>
            <Badge tone={lines.length ? "brand" : "neutral"}>
              {formatNumber(itemCount, 2)} ítems en el carrito
            </Badge>
            <Button
              variant="secondary"
              icon={<Trash2 className="size-4" />}
              onClick={() => setClearOpen(true)}
              disabled={lines.length === 0}
            >
              Cancelar venta
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-3.5 p-4">
            <div className="flex gap-2 sm:items-center">
              <div className="relative flex-1" onKeyDown={handleSearchKey}>
                <SearchInput
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Buscar por nombre, SKU o escanear código de barras / QR"
                  className="h-11 sm:text-[10px] text-[6px]"
                />
                <Barcode className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brand-600 dark:text-brand-300" />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="shrink-0"
                title="Escanear con la cámara (celular o webcam)"
                aria-label="Escanear con la cámara"
                onClick={() => setScannerOpen(true)}
              >
                <ScanLine className="size-4" />
              </Button>
              <span className="hidden items-center gap-1 rounded-lg border border-line bg-surface-2 px-2 py-1 text-[10px] font-semibold text-muted sm:inline-flex">
                <kbd className="rounded bg-surface px-1 py-0.5 font-mono text-[10px] text-foreground">
                  Enter
                </kbd>
                agrega el código
              </span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategory("todos")}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                  category === "todos"
                    ? "border-brand-500 bg-brand-500 text-brand-950"
                    : "border-line bg-surface text-muted hover:border-brand/40 hover:text-foreground",
                )}
              >
                Todos
              </button>
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                    category === item.id
                      ? "border-brand-500 bg-brand-500 text-brand-950"
                      : "border-line bg-surface text-muted hover:border-brand/40 hover:text-foreground",
                  )}
                >
                  <span className="mr-1">{item.emoji}</span>
                  {item.name}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-14 text-center">
                <Package className="size-6 text-muted" />
                <p className="text-sm font-semibold text-foreground">
                  Sin productos para esta búsqueda
                </p>
                <p className="text-xs text-muted">
                  Prueba con otro término, categoría o escanea un código de
                  barras.
                </p>
              </div>
            ) : (
              <div className="grid max-h-[80vh] grid-cols-1 gap-2.5 overflow-y-auto pr-0.5 sm:grid-cols-3 2xl:grid-cols-4">
                {filtered.map((product) => {
                  const presentations = productPresentations(product);
                  const productLines = lines.filter(
                    (line) => line.product.id === product.id,
                  );
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        "flex flex-col gap-2 rounded-xl border bg-surface p-2.5 transition-all duration-200",
                        productLines.length
                          ? "border-brand/60 ring-1 ring-brand/30"
                          : "border-line",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => addProduct(product)}
                        className="flex w-full items-start gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={product.stock <= 0}
                      >
                        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-lg">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt=""
                              className="size-11 object-contain"
                            />
                          ) : (
                            product.emoji
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold text-foreground">
                            {product.name}
                          </span>
                          <span className="block truncate text-[10px] text-muted">
                            {product.sku}
                          </span>
                        </span>
                        {productLines.length === 1 ? (
                          <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold text-brand-950">
                            {formatNumber(productLines[0].qty, 2)}
                          </span>
                        ) : productLines.length > 1 ? (
                          <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold text-brand-950">
                            {productLines.length}×
                          </span>
                        ) : null}
                      </button>

                      <div className="flex flex-wrap gap-1">
                        {presentations.map((presentation) => {
                          const key = cartKey(product.id, presentation.id);
                          const line = lines.find(
                            (item) =>
                              cartKey(item.product.id, item.presentation.id) ===
                              key,
                          );
                          const max = maxQtyOf(product, presentation);
                          return (
                            <button
                              key={presentation.id}
                              type="button"
                              onClick={() => addProduct(product, presentation)}
                              disabled={max <= 0}
                              title={`${formatCurrency(presentation.price)} · ${formatNumber(presentation.factor, 2)} ${BASE_UNIT_LABELS[product.baseUnit]} · ${formatCurrency(unitPrice(presentation))}/${BASE_UNIT_LABELS[product.baseUnit]}`}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40",
                                line
                                  ? "border-brand-500 bg-brand-500 text-brand-950"
                                  : "border-line bg-surface-2 text-muted hover:border-brand/50 hover:text-foreground",
                              )}
                            >
                              <span>{presentation.label}</span>
                              {line ? (
                                <span>{formatNumber(line.qty, 2)}</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex w-full items-center justify-between gap-1">
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(
                            presentations[0].factor > 1
                              ? presentations[0].price
                              : product.price,
                          )}
                          <span className="ml-1 text-[9px] font-normal text-muted">
                            /{" "}
                            {presentations[0].factor > 1
                              ? presentations[0].label
                              : BASE_UNIT_LABELS[product.baseUnit]}
                          </span>
                        </span>
                        <Badge tone={stockTone(product)} className="text-[9px]">
                          {product.stock <= 0
                            ? "Agotado"
                            : `${formatNumber(product.stock, product.stock % 1 === 0 ? 0 : 1)} ${BASE_UNIT_LABELS[product.baseUnit]}`}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-fit flex-col xl:sticky xl:top-20">
          <CardHeader>
            <div>
              <CardTitle className="inline-flex items-center gap-1.5">
                <ShoppingCart className="size-4 text-brand-600 dark:text-brand-300" />
                Carrito de venta
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                {lines.length} producto{lines.length === 1 ? "" : "s"} ·{" "}
                {formatNumber(itemCount, 2)} unidades
              </p>
            </div>
            <Badge tone="brand">{user?.name.split(" ")[0] ?? "Caja"}</Badge>
          </CardHeader>

          <CardContent className="space-y-3">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-12 text-center">
                <ShoppingCart className="size-6 text-muted" />
                <p className="text-sm font-semibold text-foreground">
                  El carrito está vacío
                </p>
                <p className="text-xs text-muted">
                  Agrega productos desde el catálogo o escanea un código de
                  barras.
                </p>
              </div>
            ) : (
              <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-0.5">
                {lines.map((line) => {
                  const key = cartKey(line.product.id, line.presentation.id);
                  const step = presentationStep(
                    line.product.baseUnit,
                    line.presentation,
                  );
                  const max = maxQtyOf(line.product, line.presentation);
                  const subtotal = round2(
                    line.presentation.price * line.qty - line.discount,
                  );
                  const equivalence = baseQty(line.presentation, line.qty);
                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-line/80 bg-surface-2/60 p-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface text-base">
                          {line.product.image ? (
                            <img
                              src={line.product.image}
                              alt=""
                              className="size-8 object-contain"
                            />
                          ) : (
                            line.product.emoji
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-foreground">
                            {line.product.name}
                          </p>
                          <p className="text-[10px] text-muted">
                            {formatCurrency(line.presentation.price)} ·{" "}
                            {line.presentation.label}
                            {line.presentation.factor > 1
                              ? ` · ${formatNumber(line.presentation.factor, 2)} ${BASE_UNIT_LABELS[line.product.baseUnit]}`
                              : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(key)}
                          className="rounded-md p-1 text-muted transition hover:bg-danger/10 hover:text-danger"
                          aria-label={`Quitar ${line.product.name} ${line.presentation.label}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="flex items-center rounded-lg border border-line bg-surface">
                          <button
                            type="button"
                            onClick={() => setQty(key, line.qty - step)}
                            className="grid size-7 place-items-center text-muted transition hover:text-foreground"
                            aria-label="Disminuir cantidad"
                          >
                            <Minus className="size-3" />
                          </button>
                          <input
                            type="number"
                            min={step}
                            step={step}
                            max={max}
                            value={line.qty}
                            onChange={(event) =>
                              setQty(key, Number(event.target.value))
                            }
                            className="h-7 w-11 border-x border-line bg-transparent text-center text-[11px] font-semibold text-foreground outline-none"
                            aria-label={`Cantidad de ${line.product.name} ${line.presentation.label}`}
                          />
                          <button
                            type="button"
                            onClick={() => setQty(key, line.qty + step)}
                            className="grid size-7 place-items-center text-muted transition hover:text-foreground"
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>

                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">
                            S/
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={line.discount}
                            onChange={(event) =>
                              setLineDiscount(key, Number(event.target.value))
                            }
                            className="h-7 w-20 rounded-lg border border-line bg-surface pl-5 pr-1.5 text-right text-[11px] text-foreground outline-none focus:border-brand-500"
                            aria-label={`Descuento de ${line.product.name} ${line.presentation.label}`}
                            title="Descuento de la línea"
                          />
                        </div>

                        <span className="ml-auto text-xs font-semibold text-foreground">
                          {formatCurrency(subtotal)}
                        </span>
                      </div>

                      {line.presentation.factor > 1 ? (
                        <p className="mt-1 text-right text-[10px] text-muted">
                          Equivale a {formatNumber(equivalence, 2)}{" "}
                          {BASE_UNIT_LABELS[line.product.baseUnit]}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-line bg-surface-2/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted">
                  Comprobante
                </span>
                <SegmentedControl
                  options={[...DOC_OPTIONS]}
                  value={docType}
                  onChange={(value) => setDocType(value as DocType)}
                />
              </div>

              <Select
                value={customerId}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomerId(value);
                  const customer = customers.find(
                    (candidate) => candidate.id === value,
                  );
                  if (customer)
                    setDocType(
                      customer.docType === "RUC" ? "factura" : "boleta",
                    );
                }}
                className="h-9 bg-surface text-xs"
                aria-label="Cliente"
              >
                <option value="">Clientes varios</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · {customer.docNumber}
                  </option>
                ))}
              </Select>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted">
                  Descuento global
                </span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">
                    S/
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={globalDiscount}
                    onChange={(event) =>
                      setGlobalDiscount(Math.max(0, Number(event.target.value)))
                    }
                    className="h-8 w-24 rounded-lg border border-line bg-surface pl-5 pr-1.5 text-right text-[11px] font-semibold text-foreground outline-none focus:border-brand-500"
                    aria-label="Descuento global"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>Subtotal</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.gross)}
                </span>
              </div>
              {totals.discount > 0 ? (
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Descuentos</span>
                  <span className="font-semibold text-danger">
                    -{formatCurrency(totals.discount)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>Subtotal sin IGV</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>IGV (18%)</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.igv)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-line pt-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Total a pagar
                </span>
                <span className="text-xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(totals.total)}
                </span>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={lines.length === 0}
              onClick={() => setPaymentOpen(true)}
              icon={<CreditCard className="size-4" />}
            >
              Cobrar {formatCurrency(totals.total)}
            </Button>
            <p className="flex items-center justify-center gap-1 text-[10px] text-muted">
              <CheckCircle2 className="size-3 text-success" />
              Stock y caja se actualizan al confirmar el cobro.
            </p>
          </CardContent>
        </Card>
      </div>

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        total={totals.total}
        onConfirm={confirmSale}
      />

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={resetSale}
        title="Cancelar la venta actual"
        description="Se quitarán todos los productos del carrito y los descuentos aplicados. Esta acción no afecta el stock."
        confirmLabel="Sí, cancelar venta"
      />

      {scannerOpen ? (
        <Suspense fallback={null}>
          <ScannerModal
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScan={handleScan}
          />
        </Suspense>
      ) : null}

      <Modal
        open={successOpen && Boolean(lastSale)}
        onClose={() => setSuccessOpen(false)}
        title="Venta registrada correctamente"
        description={
          lastSale
            ? `Comprobante ${lastSale.code} · ${lastSale.customerName}`
            : undefined
        }
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuccessOpen(false)}>
              Nueva venta
            </Button>
            <Button
              variant="outline"
              icon={<ArrowRight className="size-4" />}
              onClick={() =>
                navigate(`/comprobantes?code=${lastSale?.code ?? ""}`)
              }
            >
              Ver comprobante
            </Button>
            <Button
              icon={<Printer className="size-4" />}
              onClick={printDocument}
            >
              Imprimir
            </Button>
          </>
        }
      >
        {lastSale ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {lastSale.code}
                </p>
                <p className="text-[11px] text-muted">
                  {lastSale.items.length} productos ·{" "}
                  {lastSale.payments
                    .map((payment) => PAYMENT_LABELS[payment.method])
                    .join(" + ")}
                </p>
              </div>
              <p className="text-lg font-semibold text-success">
                {formatCurrency(lastSale.total)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Formato térmico
              </p>
              <SegmentedControl
                options={[
                  { value: "58", label: "58 mm" },
                  { value: "80", label: "80 mm" },
                ]}
                value={String(width)}
                onChange={(value) => setWidth(Number(value) as ReceiptWidth)}
              />
            </div>

            <ReceiptPreview sale={lastSale} width={width} />
            <PrintableReceipt sale={lastSale} width={width} />
          </div>
        ) : null}
      </Modal>

      {lastSale && !successOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[11px] text-muted">
          <span>
            Última venta:{" "}
            <strong className="text-foreground">{lastSale.code}</strong> por{" "}
            <strong className="text-foreground">
              {formatCurrency(lastSale.total)}
            </strong>
          </span>
          <Link
            to="/comprobantes"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-300"
          >
            Ir a comprobantes
          </Link>
        </div>
      ) : null}
    </div>
  );
}
