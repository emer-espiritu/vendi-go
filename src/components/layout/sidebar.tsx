import {
  BarChart3,
  Boxes,
  ChevronLeft,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Undo2,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import type { ModuleKey, Role } from "@/types";
import { MODULES, canAccess } from "@/lib/permissions";
import { useDemoStore } from "@/store/demo-store";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand";

const ICONS: Record<ModuleKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  pos: ScanLine,
  receipts: ReceiptText,
  cash: Wallet,
  products: Package,
  inventory: Boxes,
  customers: Users,
  suppliers: Truck,
  purchases: ShoppingBag,
  expenses: ReceiptText,
  returns: Undo2,
  reports: BarChart3,
  roles: ShieldCheck,
};

const GROUPS = ["Operación", "Gestión", "Sistema"] as const;

export function Sidebar({
  role,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  role: Role;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { products, returns, purchases } = useDemoStore();

  const alerts = {
    inventory: products.filter((product) => product.stock <= product.minStock)
      .length,
    returns: returns.filter((item) => item.status === "pendiente").length,
    purchases: purchases.filter((item) => item.status === "pendiente").length,
  } as Partial<Record<ModuleKey, number>>;

  const content = (isMobile: boolean) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center border-b border-line px-3.5 py-3.5",
          collapsed && !isMobile ? "justify-center" : "justify-between",
        )}
      >
        <BrandLogo compact={collapsed && !isMobile} />
        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
            aria-label="Cerrar menú"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground",
              collapsed && "hidden",
            )}
            aria-label="Colapsar menú"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4 no-scrollbar">
        {GROUPS.map((group) => {
          const modules = MODULES.filter(
            (module) => module.group === group && canAccess(role, module.key),
          );
          if (modules.length === 0) return null;
          return (
            <div key={group}>
              {!collapsed || isMobile ? (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/80">
                  {group}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-line" />
              )}
              <ul className="space-y-0.5">
                {modules.map((module) => {
                  const Icon = ICONS[module.key];
                  const badge = alerts[module.key];
                  return (
                    <li key={module.key}>
                      <NavLink
                        to={module.path}
                        onClick={isMobile ? onCloseMobile : undefined}
                        title={
                          collapsed && !isMobile
                            ? module.label
                            : module.description
                        }
                        className={({ isActive }) =>
                          cn(
                            "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-200",
                            collapsed && !isMobile && "justify-center px-0",
                            isActive
                              ? "bg-brand/12 text-brand-700 dark:text-brand-300"
                              : "text-muted hover:bg-surface-2 hover:text-foreground",
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive ? (
                              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-500" />
                            ) : null}
                            <Icon
                              className={cn(
                                "size-4 shrink-0 transition-transform group-hover:scale-105",
                                isActive &&
                                  "text-brand-600 dark:text-brand-400",
                              )}
                            />
                            {!collapsed || isMobile ? (
                              <>
                                <span className="min-w-0 flex-1 truncate">
                                  {module.label}
                                </span>
                                {badge ? (
                                  <span
                                    className={cn(
                                      "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                                      isActive
                                        ? "bg-brand-500 text-brand-950"
                                        : "bg-surface-3 text-muted",
                                    )}
                                  >
                                    {badge}
                                  </span>
                                ) : null}
                              </>
                            ) : badge ? (
                              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-500" />
                            ) : null}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {!collapsed || isMobile ? (
        <div className="p-2.5">
          <div className="relative overflow-hidden rounded-xl border border-brand/20 bg-gradient-to-br from-brand/12 via-brand/5 to-transparent p-3">
            <div className="absolute -right-4 -top-6 size-16 rounded-full bg-brand/20 blur-2xl" />
            <p className="relative text-[11px] font-bold text-foreground">
              VendiGo Retail Suite
            </p>
            <p className="relative mt-0.5 text-[10px] leading-snug text-muted">
              Sistema de gestión con datos en tiempo real.
            </p>
            <span className="relative mt-2 inline-flex items-center gap-1 rounded-md bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold text-brand-950">
              v1.0 · DEMO
            </span>
          </div>
        </div>
      ) : null}

      {collapsed && !isMobile ? (
        <div className="flex justify-center border-t border-line p-2.5">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
            aria-label="Expandir menú"
          >
            <ChevronLeft className="size-4 rotate-180" />
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-surface transition-all duration-300 lg:flex lg:flex-col",
          collapsed ? "w-[4.75rem]" : "w-[17rem]",
        )}
      >
        {content(false)}
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-overlay backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={onCloseMobile}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[17rem] flex-col border-r border-line bg-surface shadow-2xl transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {content(true)}
        </aside>
      </div>
    </>
  );
}
