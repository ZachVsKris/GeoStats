"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Trait } from "../lib/animalstats";

export default function AnimalCategoryLabel({ trait }: { trait: Trait }) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const tooltip = useRef<HTMLSpanElement>(null);
  const open = hovered || focused || pinned;
  const close = () => { setHovered(false); setFocused(false); setPinned(false); };
  const [position, setPosition] = useState({ left: 12, top: 12 });
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - Math.min(340, window.innerWidth - 24) - 12)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - (tooltip.current?.offsetHeight ?? 160) - 12)) });
    };
    const dismiss = (event: globalThis.PointerEvent) => { if (!anchor.current?.contains(event.target as Node) && !tooltip.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); close(); } };
    place();
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return <span ref={anchor} className="animalCategoryLabel" onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)}>
    {trait.displayName}<button type="button" className="animalCategoryInfo" aria-label={`Definition of ${trait.displayName}`} aria-expanded={open} aria-describedby={open ? id : undefined} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setPinned(value => !value); }} onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setFocused(true); }} onBlur={() => setFocused(false)}>ⓘ</button>
    {open && createPortal(<span ref={tooltip} id={id} role="tooltip" className="animalCategoryTooltip" style={position}><strong>{trait.displayName}</strong><span>{trait.definition}</span></span>, document.body)}
  </span>;
}
