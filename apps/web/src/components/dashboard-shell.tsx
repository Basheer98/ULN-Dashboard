"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { UserRole } from "@uln/database";
import { Sidebar } from "@/components/layout";
import { MobileNavContext } from "@/components/mobile-nav-context";
import { RouteGuard } from "@/components/route-guard";
import { ProjectSearchBar } from "@/components/project-search-bar";

export { useMobileNav } from "@/components/mobile-nav-context";

export function DashboardShell({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <MobileNavContext.Provider value={{ openMenu: () => setOpen(true) }}>
      <div className="flex min-h-screen bg-background">
        {open && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          />
        )}

        <Sidebar
          role={role}
          mobileOpen={open}
          onNavigate={() => setOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border bg-surface/40 px-4 py-3 sm:px-6 lg:px-8 print:hidden">
            <ProjectSearchBar className="max-w-2xl" />
          </div>
          <RouteGuard role={role}>{children}</RouteGuard>
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}
