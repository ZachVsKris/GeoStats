"use client";

import type { DailyDifficulty } from "./gameRules";

export type AnalyticsEventName =
  | "page_view"
  | "game_started"
  | "game_completed"
  | "share_clicked"
  | "source_opened"
  | "account_username_saved"
  | "account_signin_requested";

type AnalyticsPayload = {
  difficulty?: DailyDifficulty;
  challengeDate?: string;
  value?: number;
  metadata?: Record<string, unknown>;
};

const STORAGE_KEY = "geostats-analytics-session";
let inMemorySession = "";

function sessionId() {
  if (inMemorySession) return inMemorySession;
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return (inMemorySession = existing);
  } catch {
    // Some privacy modes block localStorage. An in-memory session still keeps analytics non-disruptive.
  }
  const created = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `gs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  inMemorySession = created;
  try { localStorage.setItem(STORAGE_KEY, created); } catch { /* optional persistence */ }
  return created;
}

export function trackAnalytics(eventName: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      eventName,
      sessionId: sessionId(),
      path: `${window.location.pathname}${window.location.search}`,
      ...payload,
    });
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon("/api/analytics/events", new Blob([body], { type: "application/json" }));
      if (queued) return;
    }
    void fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics never interrupts gameplay.
  }
}
