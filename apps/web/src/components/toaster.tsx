"use client";

import { useSyncExternalStore } from "react";
import {
  dismissToast,
  getServerToasts,
  getToasts,
  subscribeToasts,
  type ToastKind,
} from "@/lib/toast";

const STYLES: Record<ToastKind, { bar: string; icon: string; symbol: string }> = {
  success: { bar: "bg-success", icon: "text-success", symbol: "✓" },
  error: { bar: "bg-danger", icon: "text-danger", symbol: "!" },
  info: { bar: "bg-info", icon: "text-info", symbol: "i" },
};

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((item) => {
        const style = STYLES[item.kind];
        return (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className="toast-enter pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-lg border border-border bg-surface-elevated py-3 pl-4 pr-3 shadow-lg shadow-black/40"
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold ${style.icon}`}
            >
              {style.symbol}
            </span>
            <p className="flex-1 text-sm text-foreground">{item.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => dismissToast(item.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
