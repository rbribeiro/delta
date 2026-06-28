/**
 * Runtime side of Delta's localization. The compiler inlines the resolved
 * strings for the document's language as the `#delta-i18n` JSON data-island;
 * every component reads them through `t()`. Offline-safe — no fetch, just a
 * parse of inert in-page content.
 */

let cache: Record<string, string> | null = null;

function strings(): Record<string, string> {
  if (cache) return cache;
  const el = document.getElementById("delta-i18n");
  try {
    cache = el ? (JSON.parse(el.textContent || "{}") as Record<string, string>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

/** Localized string for `key`, falling back to `fallback` (or the key itself). */
export function t(key: string, fallback?: string): string {
  return strings()[key] ?? fallback ?? key;
}
