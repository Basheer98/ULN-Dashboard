"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  isUnread: boolean;
  isOpen: boolean;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function typeIcon(type: string) {
  switch (type) {
    case "job_started":
      return "▶";
    case "job_completed":
      return "✓";
    case "expense_submitted":
      return "$";
    case "mileage_submitted":
      return "↗";
    default:
      return "•";
  }
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications?limit=25");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setOpenCount(data.openCount ?? 0);
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/v1/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read" }),
    });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isUnread: false } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function resolve(id: string) {
    await fetch(`/api/v1/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve" }),
    });
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, isUnread: false, isOpen: false } : n
      )
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    setOpenCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    setLoading(true);
    await fetch("/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, isUnread: false })));
    setUnreadCount(0);
    setLoading(false);
  }

  async function resolveAll() {
    setLoading(true);
    await fetch("/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve_all" }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, isUnread: false, isOpen: false })));
    setUnreadCount(0);
    setOpenCount(0);
    setLoading(false);
  }

  async function handleOpen(item: NotificationItem) {
    if (item.isUnread) await markRead(item.id);
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="relative rounded-lg p-2 text-muted transition hover:bg-surface-hover hover:text-foreground"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="h-5 w-5"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              {openCount > 0 && (
                <p className="text-xs text-muted-foreground">{openCount} need attention</p>
              )}
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  Mark read
                </button>
              )}
              {openCount > 0 && (
                <button
                  type="button"
                  onClick={resolveAll}
                  disabled={loading}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={`flex gap-3 border-b border-border/60 px-4 py-3 last:border-0 ${
                    item.isUnread ? "bg-accent/5" : ""
                  } ${item.isOpen ? "" : "opacity-60"}`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-sm text-muted-foreground">
                    {typeIcon(item.type)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpen(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </button>
                  {item.isOpen && (
                    <button
                      type="button"
                      onClick={() => resolve(item.id)}
                      title="Mark as handled"
                      className="mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-success"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-4 w-4"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
