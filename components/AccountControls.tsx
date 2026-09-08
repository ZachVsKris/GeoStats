"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import type { DailyDifficulty } from "../lib/gameRules";
import { trackAnalytics } from "../lib/analytics";
import { checkGoogleProvider, type GoogleProviderStatus } from "../lib/googleProvider";

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
  compact?: boolean;
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
  compact = false,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [signedInEmail, setSignedInEmail] = useState("");
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
  const [googleAvailable, setGoogleAvailable] = useState<GoogleProviderStatus>("checking");
  const [resendSeconds, setResendSeconds] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const usernameCustomizedRef = useRef(usernameCustomized);
  const scoreSaveInFlight = useRef(false);
  const profileRevision = useRef(0);
  const profileRequest = useRef<AbortController | null>(null);
  const currentUserId = useRef<string | null>(null);
  const usernameSaveInFlight = useRef(false);
  const [profileError, setProfileError] = useState(false);
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

  async function googleProviderIsEnabled() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return checkGoogleProvider(url, key);
  }

  useEffect(() => {
    if (!open || userLabel) return;
    let active = true;
    void googleProviderIsEnabled().then((enabled) => active && setGoogleAvailable(enabled));
    return () => { active = false; };
  }, [open, userLabel]);

  async function savePendingScore() {
    if (scoreSaveInFlight.current) return;
    scoreSaveInFlight.current = true;
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
    } catch {
      setMessage("Your result is kept on this browser. Score saving will retry when you return or sign in again.");
    } finally { scoreSaveInFlight.current = false; setSaving(false); }
  }

  async function loadProfile(fallbackEmail?: string | null) {
    if (usernameSaveInFlight.current) return false;
    profileRequest.current?.abort();
    const controller = new AbortController();
    profileRequest.current = controller;
    const revision = ++profileRevision.current;
    const timer = window.setTimeout(() => controller.abort(), 12_000);
    setSignedInEmail(fallbackEmail ?? "");
    setUserLabel((previous) => previous || fallbackEmail?.split("@")[0] || "Account");
    setProfileError(false);
    try {
      const response = await fetch("/api/profile", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Profile unavailable");
      const profile = await response.json() as {
        username?: string | null;
        usernameCustomized?: boolean;
      };
      if (revision !== profileRevision.current) return false;
      const nextUsername = profile.username ?? "";
      setUsername(nextUsername);
      setUsernameDraft(nextUsername);
      setUsernameCustomized(profile.usernameCustomized !== false);
      // The chosen public username takes precedence over a Google display name.
      setUserLabel(nextUsername || fallbackEmail?.split("@")[0] || "Account");
      if (profile.usernameCustomized === false) {
        setMessage("Choose the GeoStats username that will appear on leaderboards.");
        setOpen(true);
      }
      return profile.usernameCustomized !== false;
    } catch {
      if (revision === profileRevision.current) setProfileError(true);
      return false;
    } finally {
      window.clearTimeout(timer);
      if (profileRequest.current === controller) profileRequest.current = null;
    }
  }

  useEffect(() => {
    if (!supabase) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (!user) {
        currentUserId.current = null;
        profileRevision.current++;
        profileRequest.current?.abort();
        setUserLabel(null);
        setSignedInEmail("");
        setUsername("");
        setUsernameDraft("");
        setUsernameCustomized(true);
        setProfileError(false);
        return;
      }
      // Session data is a display hint only; the profile and score APIs authorize
      // every request. INITIAL_SESSION avoids a duplicate getUser round trip.
      if (currentUserId.current === user.id) return;
      currentUserId.current = user.id;
      setSignedInEmail(user.email ?? "");
      setUserLabel(user.email?.split("@")[0] || "Account");
      const timer = setTimeout(() => {
        timers.delete(timer);
        void loadProfile(user.email).then((customized) => {
          if (customized) return savePendingScore();
        });
      }, 0);
      timers.add(timer);
    });
    function profileUpdated(event: Event) {
      const detail = (event as CustomEvent<{ userId: string; username: string }>).detail;
      if (!detail || detail.userId !== currentUserId.current) return;
      profileRevision.current++;
      profileRequest.current?.abort();
      setUsername(detail.username);
      setUsernameDraft(detail.username);
      setUsernameCustomized(true);
      setUserLabel(detail.username);
      setProfileError(false);
    }
    window.addEventListener("geostats-profile-updated", profileUpdated);
    return () => {
      listener.subscription.unsubscribe();
      timers.forEach(clearTimeout);
      profileRevision.current++;
      profileRequest.current?.abort();
      currentUserId.current = null;
      window.removeEventListener("geostats-profile-updated", profileUpdated);
    };
  }, [supabase]);

  async function saveUsername() {
    if (usernameSaveInFlight.current || !usernameDraft.trim()) return;
    usernameSaveInFlight.current = true;
    profileRevision.current++;
    profileRequest.current?.abort();
    const userId = currentUserId.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12_000);
    setSavingUsername(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameDraft.trim() }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({})) as { error?: string; username?: string };
      if (userId !== currentUserId.current) return;
      if (!response.ok || !data.username) {
        setMessage(data.error ?? "Username could not be saved. Please try again.");
        return;
      }
      window.dispatchEvent(new CustomEvent("geostats-profile-updated", { detail: { userId, username: data.username } }));
      trackAnalytics("account_username_saved", { metadata: { updated: usernameCustomized } });
      setMessage("Username saved. This is how you will appear on GeoStats leaderboards.");
      // Score verification can be slow; it must not keep username saving busy.
      void savePendingScore();
    } catch {
      if (userId === currentUserId.current) {
        setMessage("Saving took too long or the connection was interrupted. Retry to confirm your username.");
      }
    } finally {
      window.clearTimeout(timer);
      usernameSaveInFlight.current = false;
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
      setMessage("GeoStats sent your secure sign-in link. Check your inbox, then spam or junk if it doesn’t arrive.");
    } catch {
      setMessage("The sign-in link request could not be completed. Check your connection and try again.");
    } finally {
      setSendingLink(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase || signingInWithGoogle) return;
    setSigningInWithGoogle(true);
    setMessage("");
    const providerEnabled = googleAvailable === "enabled" ? "enabled" : await googleProviderIsEnabled();
    setGoogleAvailable(providerEnabled);
    if (providerEnabled === "disabled") {
      setMessage("Google sign-in is temporarily unavailable. Use the email sign-in link for now.");
      setSigningInWithGoogle(false);
      return;
    }
    const next = `${window.location.pathname}${window.location.search}` || "/daily";
    trackAnalytics("account_signin_requested", { metadata: { context, provider: "google" } });
    try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setMessage(/provider.*not enabled|unsupported provider/i.test(error.message)
        ? "Google sign-in is temporarily unavailable. Use the email sign-in link for now."
        : "Google sign-in could not be started. Try again or use email instead.");
      setSigningInWithGoogle(false);
    }
    } catch {
      setMessage("Google sign-in could not be started. Try again or use email instead.");
      setSigningInWithGoogle(false);
    }
  }

  async function signOut() {
    const result = await supabase?.auth.signOut();
    if (result?.error) { setMessage("Sign-out could not be completed. Please try again."); return; }
    setUserLabel(null);
    setSignedInEmail("");
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
  const guestButtonLabel = ctaLabel ?? (results && pendingScore ? "Sign in to save" : "Sign in");

  return <>
    <div className={results ? "resultsAccountActions" : "accountHeaderActions"}>
      {!hideLeaderboardLink && <a className={results ? "secondaryAction" : "headerButtonLink"} href={`/leaderboard?difficulty=${difficulty}`}>{results ? "View leaderboard" : "Leaderboard"}</a>}
      {userLabel ? <button type="button" onClick={openAccount} aria-label={`Account: signed in as ${userLabel}`} className={compact ? "compactAccountButton" : undefined}>{compact ? `✓ ${userLabel}` : userLabel}</button> : <button type="button" onClick={openAccount}>{guestButtonLabel}</button>}
    </div>
    {open && <div className="modal accountModal" onClick={(event) => event.currentTarget === event.target && usernameCustomized && setOpen(false)}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`account-dialog-title-${context}`} aria-describedby={`account-dialog-description-${context}`} aria-busy={saving || savingUsername || sendingLink || signingInWithGoogle}>
        {usernameCustomized && <button type="button" className="modalClose" aria-label="Close" onClick={() => setOpen(false)}>×</button>}
        <span className="kicker">GeoStats account</span>
        <h2 id={`account-dialog-title-${context}`}>{userLabel ? `Signed in as ${userLabel}` : guestHeading}</h2>
        {userLabel ? <>
          <p className="signedInIdentity">Signed in as <strong>{signedInEmail || userLabel}</strong></p>
          {profileError && <p role="status">Your account is signed in, but your username could not be loaded. <button type="button" className="quietButton" onClick={() => void loadProfile(signedInEmail)}>Retry account details</button></p>}
          {!usernameCustomized && <p className="usernameRequired">Before joining the leaderboard, choose a public GeoStats username.</p>}
          <label className="emailField"><span>GeoStats username</span><input type="text" inputMode="text" autoComplete="username" maxLength={20} placeholder="3–20 letters, numbers, or underscores" value={usernameDraft} onChange={(event) => setUsernameDraft(event.target.value.replace(/[^A-Za-z0-9_]/g, ""))} onKeyDown={(event) => event.key === "Enter" && saveUsername()} /></label>
          <div className="accountModalActions"><button type="button" onClick={saveUsername} disabled={savingUsername || usernameDraft.length < 3 || usernameDraft === username}>{savingUsername ? "Saving…" : usernameCustomized ? "Update username" : "Save username"}</button><button type="button" className="quietButton" onClick={signOut}>Sign out</button></div>
          <p id={`account-dialog-description-${context}`}>Your account unlocks Expert play and lets you join the public leaderboards. Verified Daily scores are saved automatically; your email stays private.</p>
          {saving && <p>Saving your completed Daily…</p>}
        </> : <>
          <p id={`account-dialog-description-${context}`}>Sign in to save verified scores, join the standings, and unlock Expert Daily.</p>
          <ul className="accountBenefits">
            <li>Play the Expert Daily</li>
            <li>Join Scout, Adventurer, and Expert leaderboards</li>
            <li>Save one verified score per mode each day</li>
          </ul>
          <button type="button" className="googleSignInButton" onClick={signInWithGoogle} disabled={signingInWithGoogle || sendingLink || googleAvailable === "disabled"}>{signingInWithGoogle ? "Opening Google…" : googleAvailable === "disabled" ? "Google sign-in unavailable" : <><span aria-hidden="true" className="googleMark">G</span>Continue with Google</>}</button>
          {googleAvailable === "unknown" && <small role="status">We couldn’t check Google availability. You can still try Google or use email.</small>}
          {googleAvailable === "disabled" && <button type="button" className="quietButton" onClick={() => { setGoogleAvailable("checking"); void googleProviderIsEnabled().then(setGoogleAvailable); }}>Check Google availability again</button>}
          <div className="accountAuthDivider"><span>or use email</span></div>
          <label className="emailField"><span>Email address</span><input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === "Enter" && resendSeconds === 0 && !sendingLink && sendMagicLink()} /></label>
          <button type="button" onClick={sendMagicLink} disabled={!email.trim() || sendingLink || resendSeconds > 0}>{sendingLink ? "Sending…" : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Email me a sign-in link"}</button>
          <small>No password needed. If you’re new, confirming your email activates your free account. Your public username appears on leaderboards. Your email never does.</small>
          <small>Can’t find the email? Check your spam or junk folder for a message from accounts@geostats.xyz.</small>
        </>}
        {message && <p className="accountMessage" role="status" aria-live="polite">{message}</p>}
      </div>
    </div>}
  </>;
}
