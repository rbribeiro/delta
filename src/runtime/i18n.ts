/**
 * Runtime side of Delta's localization. The compiler inlines the resolved
 * strings for the document's language as the `#delta-i18n` JSON data-island;
 * every component reads them through `t()`. Offline-safe — no fetch, just a
 * parse of inert in-page content.
 */

import { readIsland } from "./island.ts";

/** Localized string for `key`, falling back to `fallback` (or the key itself). */
export function t(key: string, fallback?: string): string {
  return readIsland<Record<string, string>>("delta-i18n", {})[key] ?? fallback ?? key;
}

/** The localized name of a tag ("Teorema" for `theorem`); the capitalized tag when no language has it. */
export function nameOf(tag: string): string {
  return t(tag, tag.charAt(0).toUpperCase() + tag.slice(1));
}
