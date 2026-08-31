"use client";

import type { DailyDifficulty } from "./gameRules";

export type AnalyticsEventName =
  | "page_view"
  | "game_started"
  | "game_completed"
  | "share_clicked"
  | "source_opened"
  | "account_username_saved"
  | "account_signin_requested"
  | "account_gate_opened"
  | "account_authenticated";

type AnalyticsPayload = {
  difficulty?: DailyDifficulty;
  challengeDate?: string;
  value?: number;
  metadata?: Record<string, unknown>;
};

const STORAGE_KEY = "geostats-analytics-session";
const RETURNING_KEY = "geostats-returning-visitor";
let inMemorySession = "";
let visitorState: "new" | "returning" | "" = "";

function sessionId() {
  if (inMemorySession) return inMemorySession;
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return (inMemorySession = existing);
  } catch {
    // Some privacy modes block storage. In-memory analytics remains non-disruptive.
  }
  const created = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `gs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  inMemorySession = created;
  try { sessionStorage.setItem(STORAGE_KEY, created); } catch { /* optional */ }
  return created;
}

function newOrReturning() {
  if (visitorState) return visitorState;
  try {
    const prior = localStorage.getItem(RETURNING_KEY);
    visitorState = prior ? "returning" : "new";
    localStorage.setItem(RETURNING_KEY, "1");
  } catch {
    visitorState = "new";
  }
  return visitorState;
}

function acquisition() {
  const params = new URLSearchParams(window.location.search);
  const safe = (value: string | null) => value?.trim().slice(0, 160) || undefined;
  let referrer: string | undefined;
  try {
    if (document.referrer) {
      const parsed = new URL(document.referrer);
      referrer = parsed.hostname.slice(0, 160);
    }
  } catch { /* malformed referrer is ignored */ }
  return {
    referrer,
    utmSource: safe(params.get("utm_source")),
    utmMedium: safe(params.get("utm_medium")),
    utmCampaign: safe(params.get("utm_campaign")),
    visitorState: newOrReturning(),
  };
}

export function trackAnalytics(eventName: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  if (typeof window === "undefined") return;
  // Random is a private QA surface in v16.2.6 and must never pollute public product analytics.
  if (window.location.pathname.startsWith("/random")) return;
  try {
    const body = JSON.stringify({
      eventName,
      sessionId: sessionId(),
      path: `${window.location.pathname}${window.location.search}`,
      ...acquisition(),
      ...payload,
    });
    if (navigator.sendBeacon) {
      // WebKit can intermittently serialize a Blob beacon without its JSON
      // bytes, which makes the route reject an otherwise valid event with a
      // 400. A string is supported by sendBeacon and is parsed reliably by
      // every browser; the endpoint reads JSON independent of Content-Type.
      const queued = navigator.sendBeacon("/api/analytics/events", body);
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
