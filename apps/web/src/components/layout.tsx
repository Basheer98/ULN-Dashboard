"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@uln/database";
import { FINANCE_NAV, NAV_BY_ROLE } from "@uln/shared";
import { NotificationBell } from "@/components/notification-bell";
import { useMobileNav } from "@/components/mobile-nav-context";
import { NAV_ICONS } from "@/components/nav-icons";

const NAV_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projects",
  "/schedule": "Schedule",
  "/clients": "Clients",
  "/fielders": "Fielders",
  "/invoices": "Invoices",
  "/finance": "Finance",
  "/payments": "Payments",
  "/reports": "Reports",
  "/rates": "Rates",
  "/team": "Team",
};

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function Sidebar({
  role,
  mobileOpen = false,
  onNavigate,
}: {
  role: UserRole;
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const navItems = (NAV_BY_ROLE[role] ?? NAV_BY_ROLE.admin).map((href) => ({
    href,
    label: NAV_LABELS[href] ?? href,
  }));

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out print:hidden lg:static lg:z-auto lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="border-b border-border px-5 py-5 lg:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">ULN</p>
        <p className="mt-1 text-sm font-semibold text-foreground">Urbanlink Networks</p>
        <p className="text-xs text-muted-foreground">Operations</p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = NAV_ICONS[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              {Icon && (
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition ${
                    active
                      ? "bg-accent/15 text-accent"
                      : "bg-surface-elevated text-muted-foreground group-hover:bg-surface-hover group-hover:text-foreground"
                  }`}
                >
                  <Icon />
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4 text-xs text-muted-foreground">
        Urbanlink Networks LLC
      </div>
    </aside>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  const mobileNav = useMobileNav();

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {mobileNav && (
            <button
              type="button"
              onClick={mobileNav.openMenu}
              className="btn-ghost -ml-1 shrink-0 p-2 lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl lg:text-2xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <button onClick={handleLogout} className="btn-secondary text-sm">
            <span className="hidden sm:inline">Sign out</span>
            <span className="sm:hidden">Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function FinanceSubnav() {
  const pathname = usePathname();
  if (!pathname.startsWith("/finance")) return null;

  return (
    <nav className="scrollbar-none border-b border-border bg-surface/50 px-4 py-2 sm:px-6 lg:px-8 print:hidden">
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {FINANCE_NAV.map((item) => {
          const moreSpecificActive = FINANCE_NAV.some(
            (other) =>
              other.href !== item.href &&
              other.href.startsWith(`${item.href}/`) &&
              (pathname === other.href || pathname.startsWith(`${other.href}/`))
          );
          const active =
            item.href === "/finance"
              ? pathname === "/finance"
              : !moreSpecificActive &&
                (pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "badge-neutral",
    assigned: "badge-info",
    in_progress: "badge-warning",
    complete: "badge-success",
    invoiced: "badge-accent",
    paid: "badge-success",
    cancelled: "badge-danger",
    pending: "badge-warning",
    approved: "badge-info",
    sent: "badge-info",
    overdue: "badge-danger",
    partial: "badge-warning",
    submitted: "badge-warning",
    pending_review: "badge-warning",
    rejected: "badge-danger",
    reimbursed: "badge-success",
    voided: "badge-neutral",
    verified: "badge-success",
    balanced: "badge-success",
    active: "badge-info",
    paid_off: "badge-success",
    defaulted: "badge-danger",
    reopened: "badge-warning",
  };

  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={`badge ${colors[status] ?? "badge-neutral"}`}>{label}</span>;
}
