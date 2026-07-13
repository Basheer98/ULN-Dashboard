"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@uln/database";
import { canAccessRoute } from "@uln/shared";

export function RouteGuard({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!canAccessRoute(role, pathname)) {
      router.replace("/dashboard");
    }
  }, [role, pathname, router]);

  return children;
}
