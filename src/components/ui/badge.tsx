import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  brand: "border-brand/30 bg-brand/12 text-brand-700 dark:text-brand-300",
  neutral: "border-line bg-surface-2 text-muted",
  success: "border-success/30 bg-success/12 text-success",
  warning: "border-warning/35 bg-warning/15 text-warning",
  danger: "border-danger/30 bg-danger/12 text-danger",
  violet: "border-violet/30 bg-violet/12 text-violet",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 whitespace-nowrap",
        TONES[tone],
        className,
      )}
    />
  );
}
