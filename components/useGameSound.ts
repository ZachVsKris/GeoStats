"use client";

import { useEffect, useRef, useState } from "react";

const preferenceKey = "geostats:sound:v1";
type Cue = "select" | "place" | "remove" | "result";

export default function useGameSound() {
  const [enabled, setEnabled] = useState(false);
  const context = useRef<AudioContext | null>(null);

  useEffect(() => {
    try { setEnabled(localStorage.getItem(preferenceKey) === "on"); } catch { /* Storage is optional. */ }
    return () => { void context.current?.close().catch(() => {}); context.current = null; };
  }, []);

  function play(cue: Cue, force = false) {
    if (!enabled && !force) return;
    try {
      const audio = context.current ?? (context.current = new AudioContext());
      if (audio.state === "suspended") void audio.resume().catch(() => {});
      const notes = cue === "result" ? [523.25, 659.25, 783.99] : [cue === "place" ? 280 : cue === "remove" ? 340 : 420];
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + index * .11;
        const duration = cue === "result" ? .22 : .075;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        if (cue !== "result") oscillator.frequency.exponentialRampToValueAtTime(frequency * .6, start + duration);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(.045, start + .008);
        gain.gain.exponentialRampToValueAtTime(.001, start + duration);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(start); oscillator.stop(start + duration + .01);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* Audio must never interrupt gameplay. */ }
  }

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(preferenceKey, next ? "on" : "off"); } catch { /* Storage is optional. */ }
    if (next) play("select", true);
    else if (context.current) void context.current.suspend().catch(() => {});
  }

  return { enabled, toggle, play };
}
