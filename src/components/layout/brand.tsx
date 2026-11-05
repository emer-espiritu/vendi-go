import logo from "@/assets/images/logo.png";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl",
        className,
      )}
      aria-hidden="true"
    >
      <img src={logo} alt="Logo" className="size-full object-contain" />
    </span>
  );
}

export function BrandLogo({
  compact = false,
  subtitle = "Minimarket | Reyna",
  inverted = false,
  className,
}: {
  compact?: boolean;
  subtitle?: string;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      {compact ? null : (
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-[15px] font-bold leading-tight tracking-tight",
              inverted ? "text-white" : "text-foreground",
            )}
          >
            Vendi
            <span
              className={
                inverted
                  ? "text-brand-300"
                  : "text-brand-600 dark:text-brand-400"
              }
            >
              Go
            </span>
          </p>
          <p
            className={cn(
              "truncate text-[10px] font-medium uppercase tracking-[0.16em]",
              inverted ? "text-white/55" : "text-muted",
            )}
          >
            {subtitle}
          </p>
        </div>
      )}
    </div>
  );
}
