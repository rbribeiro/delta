/**
 * The compiler ships what the page needs to know as inert JSON "islands":
 * `<script type="application/json" id="delta-i18n | delta-toc | delta-review">`. Each is
 * parsed once, on first use, and cached. Offline-safe: no fetch, only in-page content.
 * Their shapes are declared once, for both halves, in src/language/islands.ts.
 */

import type { IslandId, IslandPayload } from "../language/islands.ts";

const cache = new Map<string, unknown>();

/** The parsed island `#id`, or `empty` when the page has none (or it does not parse). */
export function readIsland<K extends IslandId>(id: K, empty: IslandPayload[K]): IslandPayload[K] {
  type T = IslandPayload[K];
  if (cache.has(id)) return cache.get(id) as T;
  let value: T = empty;
  const el = document.getElementById(id);
  try {
    if (el) value = JSON.parse(el.textContent || "null") ?? empty;
  } catch {
    value = empty;
  }
  cache.set(id, value);
  return value;
}
