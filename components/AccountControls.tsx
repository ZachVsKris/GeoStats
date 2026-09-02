"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import type { DailyDifficulty } from "../lib/gameRules";
import { trackAnalytics } from "../lib/analytics";

type PendingScore = { challengeDate: string; difficulty: DailyDifficulty; assignments: Record<string, string> };
type AccountContext = "default" | "expert" | "leaderboard";
type Props = {
  pendingScore?: PendingScore;
  onScoreSaved?: (score: Pick<PendingScore, "challengeDate" | "difficulty">) => void;
  results?: boolean;
  difficulty?: DailyDifficulty;
  context?: AccountContext;
  ctaLabel?: string;
  hideLeaderboardLink?: boolean;
};

const pendingKey = (difficulty: DailyDifficulty) => `geostats-pending-daily-score-${difficulty}`;

export default function AccountControls({
  pendingScore,
  onScoreSaved,
  results = false,
  difficulty = "easy",
  context = "default",
  ctaLabel,
  hideLeaderboardLink = false,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameCustomized, setUsernameCustomized] = useState(true);
  const [savingUsername, setSavingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [signingInWithGoogle, setSigningInWithGoogle] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const usernameCustomizedRef = useRef(usernameCustomized);
  const pendingSignature = JSON.stringify(pendingScore ?? null);

  useEffect(() => {
    usernameCustomizedRef.current = usernameCustomized;
  }, [usernameCustomized]);

  useEffect(() => {
    if (pendingScore) localStorage.setItem(pendingKey(pendingScore.difficulty), JSON.stringify(pendingScore));
  }, [pendingSignature]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href]");
    focusable?.focus();
    function keepFocusInside(event: KeyboardEvent) {
      if (event.key === "Escape" && usernameCustomizedRef.current) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href]")];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", keepFocusInside);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  async function savePendingScore() {
    if (saving) return;
    setSaving(true);
    try {
      for (const difficulty of ["easy", "normal", "expert"] as const) {
        const key = pendingKey(difficulty);
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        let pending: PendingScore;
        try { pending = JSON.parse(raw) as PendingScore; } catch { continue; }
        if (!pending.challengeDate || Object.keys(pending.assignments ?? {}).length === 0) continue;
        const response = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          localStorage.removeItem(key);
          onScoreSaved?.({ challengeDate: pending.challengeDate, difficulty });
          const label = difficulty === "expert" ? "Expert" : difficulty === "easy" ? "Scout" : "Adventurer";
          setMessage(data.alreadyCompleted
            ? `${label} Daily was already completed. Your original score remains saved.`
            : `${label} Daily score saved to your account.`);
        } else if (response.status !== 401) {
          setMessage(data.error ?? "Score could not be saved.");
        }
      }
    } finally { setSaving(false); }
  }

  async function loadProfile(fallbackEmail?: string | null) {
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) return;
      const profile = await response.json() as {
        username?: string | null;
        displayName?: string | null;
        usernameCustomized?: boolean;
      };
      const nextUsername = profile.username ?? "";
      setUsername(nextUsername);
      setUsernameDraft(nextUsername);
      setUsernameCustomized(profile.usernameCustomized !== false);
      setUserLabel(profile.displayName || nextUsername || fallbackEmail?.split("@")[0] || "Account");
      if (profile.usernameCustomized === false) {
        setMessage("Choose the GeoStats username that will appear on leaderboards.");
        setOpen(true);
      }
      return profile.usernameCustomized !== false;
    } catch {
      setUserLabel(fallbackEmail?.split("@")[0] || "Account");
      return false;
    }
  }

  useEffect(() => {
    if (!supabase) return;
    let disposed = false;

    async function syncUser(user: { email?: string | null } | null) {
      if (disposed) return;
      if (!user) {
        setUserLabel(null);
        setUsername("");
        setUsernameDraft("");
        setUsernameCustomized(true);
        return;
      }
      const customized = await loadProfile(user.email);
      if (!disposed && customized) await savePendingScore();
    }

    void supabase.auth.getUser().then(({ data }) => {
      void syncUser(data.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Never await profile or network work inside the Supabase auth callback.
      window.setTimeout(() => {
        void syncUser(session?.user ?? null);
      }, 0);
    });

    return () => {
      disposed = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);
  async function saveUsername() {
    if (savingUsername || !usernameDraft.trim()) return;
    setSavingUsername(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameDraft.trim() }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; username?: string };
      if (!response.ok || !data.username) {
        setMessage(data.error ?? "Username could not be saved.");
        return;
      }
      setUsername(data.username);
      setUsernameDraft(data.username);
      setUsernameCustomized(true);
      setUserLabel(data.username);
      trackAnalytics("account_username_saved", { metadata: { updated: usernameCustomized } });
      setMessage("Username saved. This is how you will appear on GeoStats leaderboards.");
      await savePendingScore();
    } finally {
      setSavingUsername(false);
    }
  }

  async function sendMagicLink() {
    if (!supabase || !email.trim() || sendingLink || resendSeconds > 0) return;
    setSendingLink(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // signInWithOtp is the email sign-in and sign-up flow for GeoStats.
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}` || "/daily")}`,
        },
      });
      if (error) {
        const rateLimited = /rate limit|too many requests/i.test(error.message);
        if (rateLimited) {
          setResendSeconds(60);
          setMessage("Too many sign-in emails were requested. Wait a minute, then try once more.");
        } else {
          setMessage("GeoStats could not send that sign-in link. Check the address and try again.");
        }
        return;
      }
      setResendSeconds(60);
      trackAnalytics("account_signin_requested", { metadata: { context } });
      setMessage("Sign-in link sent. Check your inbox—and spam or junk if it doesn’t arrive.");
    } finally {
      setSendingLink(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase || signingInWithGoogle) return;
    setSigningInWithGoogle(true);
    setMessage("");
    const next = `${window.location.pathname}${window.location.search}` || "/daily";
    trackAnalytics("account_signin_requested", { metadata: { context, provider: "google" } });

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : String(caught);
      setMessage(/provider.*not enabled|unsupported provider/i.test(raw)
        ? "Google sign-in is temporarily unavailable. Use the email sign-in link for now."
        : "Google sign-in could not be started. Try again or use email instead.");
      setSigningInWithGoogle(false);
    }
  }
  async function signOut() {
    await supabase?.auth.signOut();
    setOpen(false);
    setMessage("");
    setUsername("");
    setUsernameDraft("");
    setUsernameCustomized(true);
  }

  function openAccount() {
    if (!userLabel) trackAnalytics("account_gate_opened", { metadata: { context } });
    setOpen(true);
  }

  const guestHeading = context === "expert"
    ? "Unlock Expert Daily"
    : context === "leaderboard"
      ? "Join the GeoStats leaderboard"
      : "Sign in or create an account";
  const guestButtonLabel = ctaLabel ?? (results && pendingScore ? "Sign in to save" : "Sign in / sign up");

  return <>
    <div className={results ? "resultsAccountActions" : "accountHeaderActions"}>
      {!hideLeaderboardLink && <a className={results ? "secondaryAction" : "headerButtonLink"} href={`/leaderboard?difficulty=${difficulty}`}>{results ? "View leaderboard" : "Leaderboard"}</a>}
      {userLabel ? <button type="button" onClick={openAccount}>{userLabel}</button> : <button type="button" onClick={openAccount}>{guestButtonLabel}</button>}
    </div>
    {open && <div className="modal accountModal" onClick={(event) => event.currentTarget === event.target && usernameCustomized && setOpen(false)}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`account-dialog-title-${context}`} aria-describedby={`account-dialog-description-${context}`} aria-busy={saving || savingUsername || sendingLink || signingInWithGoogle}>
        {usernameCustomized && <button type="button" className="modalClose" aria-label="Close" onClick={() => setOpen(false)}>×</button>}
        <span className="kicker">GeoStats account</span>
        <h2 id={`account-dialog-title-${context}`}>{userLabel ? `Signed in as ${userLabel}` : guestHeading}</h2>
        {userLabel ? <>
          {!usernameCustomized && <p className="usernameRequired">Before joining the leaderboard, choose a public GeoStats username.</p>}
          <label className="emailField"><span>GeoStats username</span><input type="text" inputMode="text" autoComplete="username" maxLength={20} placeholder="3–20 letters, numbers, or underscores" value={usernameDraft} onChange={(event) => setUsernameDraft(event.target.value.replace(/[^A-Za-z0-9_]/g, ""))} onKeyDown={(event) => event.key === "Enter" && saveUsername()} /></label>
          <div className="accountModalActions"><button type="button" onClick={saveUsername} disabled={savingUsername || usernameDraft.length < 3 || usernameDraft === username}>{savingUsername ? "Saving…" : usernameCustomized ? "Update username" : "Save username"}</button><button type="button" className="quietButton" onClick={signOut}>Sign out</button></div>
          <p id={`account-dialog-description-${context}`}>Your account unlocks Expert play and lets you join the public leaderboards. Verified Daily scores are saved automatically; your email stays private.</p>
          {saving && <p>Saving your completed Daily…</p>}
        </> : <>
          <p id={`account-dialog-description-${context}`}>Sign in to save verified scores, join the standings, and unlock Expert Daily. Use Google or a secure email link; email links automatically create an account for new players.</p>
          <ul className="accountBenefits">
            <li>Play the Expert Daily</li>
            <li>Join Scout, Adventurer, and Expert leaderboards</li>
            <li>Save one verified score per mode each day</li>
          </ul>
          <button type="button" className="googleSignInButton" onClick={signInWithGoogle} disabled={signingInWithGoogle || sendingLink}>{signingInWithGoogle ? "Opening Google…" : <><span aria-hidden="true" className="googleMark">G</span>Continue with Google</>}</button>
          <div className="accountAuthDivider"><span>or use email</span></div>
          <label className="emailField"><span>Email address</span><input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === "Enter" && resendSeconds === 0 && !sendingLink && sendMagicLink()} /></label>
          <button type="button" onClick={sendMagicLink} disabled={!email.trim() || sendingLink || resendSeconds > 0}>{sendingLink ? "Sending…" : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Continue with email"}</button>
          <small>New players are automatically signed up. Your public GeoStats username appears on leaderboards. Your email never does.</small>
        </>}
        {message && <p className="accountMessage" role="status" aria-live="polite">{message}</p>}
      </div>
    </div>}
  </>;
}
