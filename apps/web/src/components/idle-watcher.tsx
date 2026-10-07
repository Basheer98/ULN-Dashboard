"use client";

import { useEffect, useState } from "react";
import { SESSION_IDLE_TIMEOUT_MS } from "@uln/shared";

/** Shared across tabs, so activity in any open tab keeps every tab signed in. */
const ACTIVITY_KEY = "uln:last-activity";
const WARNING_MS = 2 * 60 * 1000;
/** The server only sees requests; ping it while someone is working without navigating (e.g. a long form). */
const KEEPALIVE_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;

function readLastActivity() {
  try {
    return Number(window.localStorage.getItem(ACTIVITY_KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}

function writeLastActivity(value: number) {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(value));
  } catch {
    /* storage unavailable; this tab still tracks via the interval */
  }
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function IdleWatcher() {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    let lastWrite = 0;
    let lastPing = Date.now();
    let signingOut = false;

    function goToLogin(reason: "idle" | "expired") {
      window.location.assign(`/login?reason=${reason}`);
    }

    async function signOut() {
      if (signingOut) return;
      signingOut = true;
      await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
      goToLogin("idle");
    }

    function check() {
      if (signingOut) return;
      const remaining = SESSION_IDLE_TIMEOUT_MS - (Date.now() - readLastActivity());
      if (remaining <= 0) {
        void signOut();
        return;
      }
      setRemainingMs(remaining <= WARNING_MS ? remaining : null);
    }

    function markActive() {
      const now = Date.now();
      if (signingOut || now - lastWrite < 5000) return;
      lastWrite = now;
      writeLastActivity(now);
      setRemainingMs(null);

      if (now - lastPing > KEEPALIVE_MS) {
        lastPing = now;
        fetch("/api/v1/auth/me", { cache: "no-store" })
          .then((res) => {
            if (res.status === 401) goToLogin("expired");
          })
          .catch(() => {});
      }
    }

    writeLastActivity(Date.now());
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", check);
    const interval = window.setInterval(check, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(interval);
    };
  }, []);

  if (remainingMs === null) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-x-0 bottom-4 z-[60] mx-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border border-border bg-surface p-4 shadow-2xl print:hidden"
    >
      <p className="text-sm font-semibold text-foreground">Are you still there?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        For security you&apos;ll be signed out in{" "}
        <span className="font-mono font-semibold text-foreground">{formatRemaining(remainingMs)}</span>{" "}
        because of inactivity.
      </p>
      <button type="button" className="btn-primary mt-3 text-sm">
        Stay signed in
      </button>
    </div>
  );
}
