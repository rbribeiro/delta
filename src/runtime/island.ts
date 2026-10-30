/**
 * The compiler ships what the page needs to know as inert JSON "islands":
 * `<script type="application/json" id="delta-i18n | delta-toc | delta-review">`. Each is
 * parsed once, on first use, and cached. Offline-safe: no fetch, only in-page content.
 */

const cache = new Map<string, unknown>();

/** The parsed island `#id`, or `empty` when the page has none (or it does not parse). */
export function readIsland<T>(id: string, empty: T): T {
  if (cache.has(id)) return cache.get(id) as T;
  let value = empty;
  const el = document.getElementById(id);
  try {
    if (el) value = JSON.parse(el.textContent || "null") ?? empty;
  } catch {
    value = empty;
  }
  cache.set(id, value);
  return value;
}
