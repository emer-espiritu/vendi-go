import { createPortal } from "react-dom";
import type { Sale } from "@/types";
import { PAYMENT_LABELS } from "@/lib/sales";
import { BASE_UNIT_LABELS } from "@/lib/presentations";
import { cn, formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";
import { ShoppingCart } from "lucide-react";

export type ReceiptWidth = 58 | 80;

const COMPANY = {
  name: "VENDIGO MINIMARKET S.A.C.",
  ruc: "RUC 20601234567",
  address: "Calle 30 de Agosto LT:2 MZ:V - Pangoa",
  phone: "+51 984 249 751",
};

type ReceiptExtraData = {
  customerAddress?: string;
  customerPhone?: string;
  seller?: string;
};

function ReceiptBody({
  sale,
  width,
  forPrint = false,
}: {
  sale: Sale;
  width: ReceiptWidth;
  forPrint?: boolean;
}) {
  const compact = width === 58;
  const extra = sale as Sale & ReceiptExtraData;

  const fontSize = compact
    ? "text-[8px] leading-[1.4]"
    : "text-[10px] leading-[1.45]";

  const money = (value: number) => formatCurrency(value);

  return (
    <div
      className={cn(
        "mx-auto bg-white font-mono text-black",
        fontSize,
        forPrint ? "" : "shadow-inner",
      )}
      style={{
        width: `${width}mm`,
        padding: compact ? "3mm 3mm" : "4mm 4.5mm",
      }}
    >
      {/* ENCABEZADO */}
      <header className="text-center">
        <div className="mb-1 flex items-center justify-center gap-2">
          <ShoppingCart size={compact ? 25 : 34} strokeWidth={2.5} />
          <div className="text-left">
            <h2
              className={cn(
                "font-black uppercase leading-none tracking-tight",
                compact ? "text-[15px]" : "text-[23px]",
              )}
            >
              MINIMARKET
            </h2>
            <p
              className={cn(
                "font-bold uppercase tracking-wide",
                compact ? "text-[7px]" : "text-[10px]",
              )}
            >
              TU TIENDA DE CONFIANZA
            </p>
          </div>
        </div>

        <p className="mt-2 font-bold">{COMPANY.name}</p>
        <p>{COMPANY.ruc}</p>
        <p>{COMPANY.address}</p>
        <p>{COMPANY.phone}</p>
      </header>

      <div className="my-2 border-t border-dashed border-black" />

      {/* DOCUMENTO */}
      <section>
        <div className="flex items-center justify-between gap-1 font-bold uppercase">
          <span>
            {sale.docType === "factura"
              ? "FACTURA ELECTRÓNICA"
              : "BOLETA DE VENTA ELECTRÓNICA"}
          </span>
          <span className="shrink-0">{sale.code}</span>
        </div>

        <div className="mt-1 space-y-0.5">
          <div className="flex justify-between gap-1">
            <span>Fecha:</span>
            <span className="text-right font-semibold">
              {formatDateTime(sale.date)}
            </span>
          </div>

          <div className="flex justify-between gap-1">
            <span>Cajero:</span>
            <span className="font-semibold">{sale.cashier}</span>
          </div>

          <div className="flex justify-between gap-1">
            <span>Vendedor:</span>
            <span className="font-semibold">
              {extra.seller || sale.cashier}
            </span>
          </div>
        </div>
      </section>

      <div className="my-2 border-t border-dashed border-black" />

      {/* CLIENTE */}
      <section>
        <p className="mb-1 font-black uppercase">DATOS DEL CLIENTE</p>

        <div className="space-y-0.5">
          <div className="flex gap-1">
            <span className="w-[23%] shrink-0">Nombre:</span>
            <span className="break-words font-semibold">
              {sale.customerName}
            </span>
          </div>

          <div className="flex gap-1">
            <span className="w-[23%] shrink-0">
              {sale.docType === "factura" ? "RUC:" : "DNI:"}
            </span>
            <span className="font-semibold">{sale.customerDoc}</span>
          </div>

          {extra.customerAddress && (
            <div className="flex gap-1">
              <span className="w-[23%] shrink-0">Dirección:</span>
              <span className="break-words">{extra.customerAddress}</span>
            </div>
          )}

          {extra.customerPhone && (
            <div className="flex gap-1">
              <span className="w-[23%] shrink-0">Teléfono:</span>
              <span>{extra.customerPhone}</span>
            </div>
          )}
        </div>
      </section>

      <div className="my-2 border-t border-dashed border-black" />

      {/* PRODUCTOS */}
      <section>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-dashed border-black text-[9px] font-bold">
              <th className="w-[10%] pb-1 text-left">Cant.</th>
              <th className="w-[44%] pb-1 pl-1 text-left">Producto</th>
              <th className="w-[21%] pb-1 text-right">P. Unit.</th>
              <th className="w-[25%] pb-1 text-right">Total</th>
            </tr>
          </thead>

          <tbody>
            {sale.items.map((item) => {
              const lineTotal = item.price * item.qty - item.discount;

              return (
                <tr
                  key={`${sale.id}-${item.productId}-${item.presentationId}`}
                  className="align-top"
                >
                  <td className="py-2 text-left">
                    {formatNumber(item.qty, 2)}
                  </td>

                  <td className="break-words py-1 pl-1">
                    <span className="block font-semibold">{item.name}</span>

                    <span className="block text-[8px]">
                      {item.presentationLabel}
                      {item.factor > 1
                        ? ` · x${formatNumber(item.factor, 2)} ${BASE_UNIT_LABELS[item.baseUnit]} = ${formatNumber(item.baseQty, 2)} ${BASE_UNIT_LABELS[item.baseUnit]}`
                        : ""}
                    </span>

                    {/* <span className="block text-[8px] text-black/60">
                      {item.sku}
                    </span>*/}
                  </td>

                  <td className="py-1 text-right whitespace-nowrap">
                    {money(item.price)}
                  </td>

                  <td className="py-1 text-right whitespace-nowrap font-semibold">
                    {money(lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="my-2 border-t border-dashed border-black" />

      {/* TOTALES */}
      <section className="ml-auto w-[72%] space-y-0.5">
        <div className="flex justify-between gap-2">
          <span>Subtotal:</span>
          <span>{money(sale.subtotal)}</span>
        </div>

        {sale.discount > 0 && (
          <div className="flex justify-between gap-2">
            <span>Descuento:</span>
            <span>-{money(sale.discount)}</span>
          </div>
        )}

        <div className="flex justify-between gap-2">
          <span>IGV (18%):</span>
          <span>{money(sale.igv)}</span>
        </div>

        <div
          className={cn(
            "mt-1 flex items-center justify-between gap-2 border-t border-black pt-1 font-black",
            compact ? "text-[12px]" : "text-[17px]",
          )}
        >
          <span>TOTAL:</span>
          <span>{money(sale.total)}</span>
        </div>
      </section>

      <div className="my-2 border-t border-dashed border-black" />

      {/* PAGOS */}
      <section>
        <p className="mb-1 font-bold uppercase">FORMA DE PAGO</p>

        {sale.payments.map((payment, index) => (
          <div
            key={`${payment.method}-${index}`}
            className="flex justify-between gap-2"
          >
            <span>{PAYMENT_LABELS[payment.method]}</span>
            <span className="font-semibold">{money(payment.amount)}</span>
          </div>
        ))}
      </section>

      <div className="my-2 border-t border-dashed border-black" />

      {/* PIE */}
      <footer className="text-center">
        <p className="font-black uppercase">¡Gracias por su compra!</p>

        <p>Vuelva pronto</p>

        <p className="mt-2 text-[8px]">
          Conserve este comprobante para cualquier reclamo.
        </p>

        <p className="mt-1 text-[8px]">
          Representación impresa del comprobante electrónico.
        </p>

        <p className="mt-1 font-bold">Emitido con VendiGo Retail Suite</p>

        {/*<div className="my-2 border-t border-dashed border-black" />

        <p className="break-all text-[8px]">{sale.id.toUpperCase()}</p>*/}
      </footer>
    </div>
  );
}

export function ReceiptPreview({
  sale,
  width = 80,
  className,
}: {
  sale: Sale;
  width?: ReceiptWidth;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-line bg-surface-2 p-3",
        className,
      )}
    >
      <div className="mx-auto w-fit rounded-md border border-line/60 bg-white text-black shadow-soft">
        <ReceiptBody sale={sale} width={width} />
      </div>
    </div>
  );
}

/**
 * Copia imprimible oculta. El CSS global muestra `.print-root` solo al imprimir
 * y oculta todo lo marcado con `.no-print`.
 */
export function PrintableReceipt({
  sale,
  width = 80,
}: {
  sale: Sale;
  width?: ReceiptWidth;
}) {
  return createPortal(
    <div className="print-root" aria-hidden="true">
      <style>{`@page { size: ${width}mm auto; margin: 3mm; }`}</style>
      <ReceiptBody sale={sale} width={width} forPrint />
    </div>,
    document.body,
  );
}
