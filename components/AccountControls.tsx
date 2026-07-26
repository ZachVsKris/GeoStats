"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import type { DailyDifficulty } from "../lib/gameRules";

type PendingScore = { challengeDate: string; difficulty: DailyDifficulty; assignments: Record<string, string> };
type Props = { pendingScore?: PendingScore; results?: boolean; difficulty?: DailyDifficulty };

const pendingKey = (difficulty: DailyDifficulty) => `geostats-pending-daily-score-${difficulty}`;

export default function AccountControls({ pendingScore, results = false, difficulty = "easy" }: Props) {
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
  const [resendSeconds, setResendSeconds] = useState(0);
  const pendingSignature = JSON.stringify(pendingScore ?? null);

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
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const customized = await loadProfile(user.email);
      if (customized) await savePendingScore();
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setUserLabel(null);
        setUsername("");
        setUsernameDraft("");
        setUsernameCustomized(true);
        return;
      }
      const customized = await loadProfile(session.user.email);
      if (customized) await savePendingScore();
    });
    return () => listener.subscription.unsubscribe();
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
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname || "/daily")}` },
      });
      if (error) {
        const rateLimited = /rate limit|too many requests/i.test(error.message);
        if (rateLimited) {
          setResendSeconds(60);
          setMessage("Too many sign-in emails were requested. Wait a minute, then try once more.");
        } else {
          setMessage(error.message);
        }
        return;
      }
      setResendSeconds(60);
      setMessage("Sign-in link sent. Check your inbox.");
    } finally {
      setSendingLink(false);
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

  return <>
    <div className={results ? "resultsAccountActions" : "accountHeaderActions"}>
      <a className={results ? "secondaryAction" : "headerButtonLink"} href={`/leaderboard?difficulty=${difficulty}`}>{results ? "View leaderboard" : "Leaderboard"}</a>
      {userLabel ? <button onClick={() => setOpen(true)}>{userLabel}</button> : <button onClick={() => setOpen(true)}>{results && pendingScore ? "Sign in to save" : "Sign in"}</button>}
    </div>
    {open && <div className="modal accountModal" onClick={(event) => event.currentTarget === event.target && usernameCustomized && setOpen(false)}>
      <div>
        {usernameCustomized && <button className="modalClose" aria-label="Close" onClick={() => setOpen(false)}>×</button>}
        <span className="kicker">GeoStats account</span>
        <h2>{userLabel ? `Signed in as ${userLabel}` : "Sign in or create an account"}</h2>
        {userLabel ? <>
          {!usernameCustomized && <p className="usernameRequired">Before joining the leaderboard, choose a public GeoStats username.</p>}
          <label className="emailField"><span>GeoStats username</span><input type="text" inputMode="text" autoComplete="username" maxLength={20} placeholder="3–20 letters, numbers, or underscores" value={usernameDraft} onChange={(event) => setUsernameDraft(event.target.value.replace(/[^A-Za-z0-9_]/g, ""))} onKeyDown={(event) => event.key === "Enter" && saveUsername()} /></label>
          <div className="accountModalActions"><button onClick={saveUsername} disabled={savingUsername || usernameDraft.length < 3 || usernameDraft === username}>{savingUsername ? "Saving…" : usernameCustomized ? "Update username" : "Save username"}</button><button className="quietButton" onClick={signOut}>Sign out</button></div>
          <p>Your verified Scout, Adventurer, and Expert Daily scores are saved automatically. Your email stays private.</p>
          {saving && <p>Saving your completed Daily…</p>}
        </> : <>
          <p>Enter your email. We’ll send a secure sign-in link—no password needed.</p>
          <label className="emailField"><span>Email address</span><input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === "Enter" && resendSeconds === 0 && !sendingLink && sendMagicLink()} /></label>
          <button onClick={sendMagicLink} disabled={!email.trim() || sendingLink || resendSeconds > 0}>{sendingLink ? "Sending…" : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Email me a sign-in link"}</button>
          <small>Your sign-in email and username experience are branded as GeoStats. Your email is never displayed on leaderboards.</small>
        </>}
        {message && <p className="accountMessage">{message}</p>}
      </div>
    </div>}
  </>;
}
