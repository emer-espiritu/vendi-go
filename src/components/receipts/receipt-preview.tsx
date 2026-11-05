import { createPortal } from "react-dom";
import type { Sale } from "@/types";
import { PAYMENT_LABELS } from "@/lib/sales";
import { BASE_UNIT_LABELS } from "@/lib/presentations";
import { cn, formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

export type ReceiptWidth = 58 | 80;

const COMPANY = {
  name: "VENDIGO MINIMARKET S.A.C.",
  ruc: "RUC 20601234567",
  address: "Calle 30 de Agosto LT:2 MZ:V - Pangoa",
  phone: "+51 984 249 751",
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
  const fontSize = compact
    ? "text-[10px] leading-[1.45]"
    : "text-[11px] leading-[1.5]";
  const base = forPrint
    ? "bg-white text-black"
    : "bg-white text-black shadow-inner";

  return (
    <div
      className={cn("mx-auto font-mono", base, fontSize)}
      style={{
        width: `${width}mm`,
        padding: compact ? "3mm 3.5mm" : "4mm 5mm",
      }}
    >
      <div className="text-center">
        <p
          className={cn(
            "font-bold tracking-tight",
            compact ? "text-[12px]" : "text-[13px]",
          )}
        >
          {COMPANY.name}
        </p>
        <p>{COMPANY.ruc}</p>
        <p className="text-[9px] leading-snug">{COMPANY.address}</p>
        <p className="text-[9px]">{COMPANY.phone}</p>
      </div>

      <div className="my-2 border-t border-dashed border-black/40" />

      <div className="text-center">
        <p className="font-bold uppercase tracking-wide">
          {sale.docType === "factura"
            ? "Factura electrónica"
            : "Boleta electrónica"}
        </p>
        <p className={cn("font-bold", compact ? "text-[12px]" : "text-[13px]")}>
          {sale.code}
        </p>
      </div>

      <div className="my-2 border-t border-dashed border-black/40" />

      <div className="space-y-0.5">
        <div className="flex justify-between gap-2">
          <span>Fecha</span>
          <span className="text-right font-semibold">
            {formatDateTime(sale.date)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Cliente</span>
          <span className="max-w-[62%] text-right font-semibold">
            {sale.customerName}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{sale.docType === "factura" ? "RUC" : "DNI"}</span>
          <span className="text-right font-semibold">{sale.customerDoc}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Cajero</span>
          <span className="text-right font-semibold">{sale.cashier}</span>
        </div>
      </div>

      <div className="my-2 border-t border-dashed border-black/40" />

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[9px] uppercase">
            <th className="pb-1 text-left font-bold">Cant</th>
            <th className="pb-1 text-left font-bold">Descripción</th>
            <th className="pb-1 text-right font-bold">Importe</th>
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
                <td className="py-0.5 pr-1">{formatNumber(item.qty, 2)}</td>
                <td className="py-0.5 pr-1">
                  <span className="block">{item.name}</span>
                  <span className="block text-[9px] font-semibold text-black/70">
                    {item.presentationLabel}
                    {item.factor > 1
                      ? ` · x${formatNumber(item.factor, 2)} ${BASE_UNIT_LABELS[item.baseUnit]} = ${formatNumber(item.baseQty, 2)} ${BASE_UNIT_LABELS[item.baseUnit]}`
                      : ""}
                  </span>
                  <span className="block text-[9px] text-black/60">
                    {item.sku} · {formatCurrency(item.price)}
                    {item.discount > 0
                      ? ` · dcto ${formatCurrency(item.discount)}`
                      : ""}
                  </span>
                </td>
                <td className="py-0.5 text-right">
                  {formatCurrency(lineTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed border-black/40" />

      <div className="space-y-0.5">
        <div className="flex justify-between gap-2">
          <span>Subtotal</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 ? (
          <div className="flex justify-between gap-2">
            <span>Descuento</span>
            <span>-{formatCurrency(sale.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <span>IGV (18%)</span>
          <span>{formatCurrency(sale.igv)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-2 border-t border-black/30 pt-1 text-[13px] font-bold">
          <span>TOTAL</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>
      </div>

      <div className="my-2 border-t border-dashed border-black/40" />

      <div className="space-y-0.5">
        <p className="text-[9px] font-bold uppercase">Forma de pago</p>
        {sale.payments.map((payment, index) => (
          <div
            key={`${payment.method}-${index}`}
            className="flex justify-between gap-2"
          >
            <span>{PAYMENT_LABELS[payment.method]}</span>
            <span>{formatCurrency(payment.amount)}</span>
          </div>
        ))}
      </div>

      <div className="my-2 border-t border-dashed border-black/40" />

      <div className="text-center text-[9px] leading-snug">
        <p className="font-bold">¡Gracias por su compra!</p>
        <p>Conserve este comprobante para cualquier reclamo.</p>
        <p className="mt-1">
          Representación impresa del comprobante electrónico.
        </p>
        <p>Emitido con VendiGo Retail Suite</p>
        <p className="mt-1 font-mono">{sale.id.toUpperCase()}</p>
      </div>
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
