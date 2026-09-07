/** Resolve only same-origin local destinations, including encoded separator attacks. */
export function safeRelativePath(value: string | null, origin: string): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  let decoded = value;
  for (let pass = 0; pass < 4; pass += 1) {
    if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith("//")) return null;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch { return null; }
  }
  if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith("//")) return null;
  try {
    const target = new URL(value, origin);
    if (target.origin !== new URL(origin).origin) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return null; }
}

export function safeAuthNext(incoming: URL): string {
  const direct = safeRelativePath(incoming.searchParams.get("next"), incoming.origin);
  if (direct) return direct;
  const nested = incoming.searchParams.get("redirect_to");
  if (nested) {
    try {
      const redirect = new URL(nested);
      if (redirect.origin === incoming.origin) {
        return safeRelativePath(redirect.searchParams.get("next"), incoming.origin) ?? "/daily";
      }
    } catch { /* Invalid nested destinations fail closed. */ }
  }
  return "/daily";
}
