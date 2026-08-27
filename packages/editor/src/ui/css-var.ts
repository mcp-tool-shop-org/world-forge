/** Read a CSS custom property from :root, with a fallback for canvas / Node. */
export function readCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return fallback;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return raw || fallback;
  } catch {
    return fallback;
  }
}

/** Resolve `var(--token)` / `var(--token, fallback)` or pass a raw color through. */
export function resolveCssColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(trimmed);
  if (!m) return trimmed || fallback;
  const innerFallback = (m[2] ?? fallback).trim();
  return readCssVar(m[1], innerFallback);
}
