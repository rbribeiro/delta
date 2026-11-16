import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/**
 * Two-step build. The `assets` step bundles the browser runtime into an IIFE
 * string and, together with the stylesheets, writes src/generated/assets.ts —
 * the emitter imports it, so this must run before typecheck/test/compile (the
 * pre-scripts in package.json take care of that). The default mode also
 * bundles the CLI to dist/cli.js.
 */

const STYLES = "src/styles";

/** One @font-face rule with a vendored woff2 (src/styles/fonts, SIL Open Font License:
 *  see the LICENSE beside them) embedded as a data: URI, so documents render in it
 *  offline. Unlayered, so it applies document-wide; the output still references nothing
 *  external (guarded by test/emit.test.ts). */
function fontFace(family: string, style: string, weight: string, file: string): string {
  const data = readFileSync(join(STYLES, "fonts", file)).toString("base64");
  return (
    `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};` +
    `font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2");}`
  );
}

/** Newsreader — the design's primary serif (--delta-serif lists it first) — as the
 *  variable woff2 (weight + optical size), so documents render in it instead of falling
 *  back to a system serif. Part of every document. */
function fontFaces(): string {
  return [
    fontFace("Newsreader", "normal", "200 800", "newsreader-latin-standard-normal.woff2"),
    fontFace("Newsreader", "italic", "200 800", "newsreader-latin-standard-italic.woff2"),
  ].join("\n");
}

/** Caveat — the handwriting of an <animation>'s notes (--delta-hand lists it first). Kept
 *  out of CORE_CSS: the emitter adds it only to a document that has a <note>, the way it
 *  adds KaTeX's sheet only to a document that has math. */
function handCss(): string {
  return fontFace("Caveat", "normal", "400 700", "caveat-latin-wght-normal.woff2");
}

/** Inlined @font-face + base.css + every components/*.css, concatenated (fonts
 *  and base first; the @layer declaration at the top of base.css fixes cascade
 *  order document-wide — @font-face is unlayered and unaffected). */
function coreCss(): string {
  const base = readFileSync(join(STYLES, "base.css"), "utf8");
  const components = readdirSync(join(STYLES, "components"))
    .filter((f) => f.endsWith(".css"))
    .sort()
    .map((f) => readFileSync(join(STYLES, "components", f), "utf8"));
  return [fontFaces(), base, ...components].join("\n");
}

/** A flat directory of `*.css` → { basename: css }. Non-recursive by design: one
 *  file per entry, no nesting. Feeds the two style maps, which are keyed on
 *  different axes and must stay separate:
 *    themes/<type>.css   → THEMES,          picked by <document type>
 *    builtin/<name>.css  → BUILTIN_THEMES,  picked by <document theme>
 *  (Keeping them in one map would make `type="impatech"` resolve a named theme.)
 *  Adding either is just dropping a file in the directory — no wiring here. */
function cssMap(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).sort()) {
    if (f.endsWith(".css")) out[f.replace(/\.css$/, "")] = readFileSync(join(dir, f), "utf8");
  }
  return out;
}

/** The standard packs: `packs/<name>/`, each with a `delta.pack.json`. */
const PACKS = "packs";

/** One standard pack as the compiler inlines it (see `BUILTIN_PACKS`). */
export interface BuiltPack {
  /** The bundled entry: one minified IIFE, a classic script like any pack's. */
  js: string;
  css?: string;
  /** The tags it registers, bare (`"plot"`); emit inlines the pack when one is used. */
  tags: string[];
  /** `{ "en": { key: text }, "pt": {…} }`, merged into the `#delta-i18n` island. */
  strings?: Record<string, Record<string, string>>;
}

/**
 * Bundles one standard pack. The sources are TypeScript modules; the result is one script,
 * like any other pack's. Two rules are enforced here, with the offending file in the message:
 *
 *   - the entry is a `.ts` file (standard packs are TypeScript: see packs/README.md);
 *   - every bundled file sits inside the pack's folder. A *value* import from `src/` would
 *     copy a core module into the pack, and core modules hold singletons (the one open
 *     popover, the island caches) that must exist once per page. A pack reaches core
 *     through `window.Delta`; a type-only import from `src/` is erased and is fine.
 */
export async function bundlePack(dir: string): Promise<BuiltPack> {
  const manifest = JSON.parse(readFileSync(join(dir, "delta.pack.json"), "utf8")) as {
    js?: string;
    css?: string;
    tags?: string[];
    strings?: string;
  };
  const entry = manifest.js ?? "index.ts";
  if (!entry.endsWith(".ts")) {
    throw new Error(`${join(dir, entry)}: a standard pack's entry must be a .ts file`);
  }
  const result = await build({
    entryPoints: [join(dir, entry)],
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    write: false,
    metafile: true,
  });
  const root = resolve(dir) + sep;
  for (const input of Object.keys(result.metafile.inputs)) {
    if (!resolve(input).startsWith(root)) {
      throw new Error(
        `${dir}: the bundle pulls in ${input}, which is outside the pack. ` +
          "Reach core through window.Delta, or import only types (import type …).",
      );
    }
  }
  // `theme.css` and `strings.json` are optional; a file the manifest names must exist.
  const optional = (named: string | undefined, conventional: string): string | undefined => {
    const path = join(dir, named ?? conventional);
    if (existsSync(path)) return readFileSync(path, "utf8");
    if (named !== undefined) throw new Error(`${path}: named in delta.pack.json but missing`);
    return undefined;
  };
  const css = optional(manifest.css, "theme.css");
  const strings = optional(manifest.strings, "strings.json");
  return {
    js: result.outputFiles[0].text.trim(),
    ...(css !== undefined ? { css } : {}),
    tags: manifest.tags ?? [],
    ...(strings !== undefined ? { strings: JSON.parse(strings) as BuiltPack["strings"] } : {}),
  };
}

/** Every `packs/<name>/` that has a `delta.pack.json`, bundled, by name. */
async function bundlePacks(): Promise<Record<string, BuiltPack>> {
  const out: Record<string, BuiltPack> = {};
  if (!existsSync(PACKS)) return out;
  for (const name of readdirSync(PACKS).sort()) {
    const dir = join(PACKS, name);
    if (existsSync(join(dir, "delta.pack.json"))) out[name] = await bundlePack(dir);
  }
  return out;
}

/** Where `assets` writes; `test/assets.test.ts` compares this file with `renderAssets()`. */
export const ASSETS_FILE = "src/generated/assets.ts";

/** The text of src/generated/assets.ts, from the sources as they are now. Writes nothing. */
export async function renderAssets(): Promise<string> {
  const result = await build({
    entryPoints: ["src/runtime/index.ts"],
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    write: false,
  });
  const runtime = result.outputFiles[0].text.trim();
  return (
    "// Generated by scripts/build.ts — do not edit, do not commit.\n" +
    `export const RUNTIME_JS = ${JSON.stringify(runtime)};\n` +
    `export const CORE_CSS = ${JSON.stringify(coreCss())};\n` +
    `export const HAND_CSS = ${JSON.stringify(handCss())};\n` +
    `export const THEMES: Record<string, string> = ${JSON.stringify(cssMap(join(STYLES, "themes")))};\n` +
    `export const BUILTIN_THEMES: Record<string, string> = ${JSON.stringify(cssMap(join(STYLES, "builtin")))};\n` +
    `export const BUILTIN_PACKS: Record<string, { js: string; css?: string; tags: string[]; strings?: Record<string, Record<string, string>> }> = ${JSON.stringify(await bundlePacks())};\n`
  );
}

async function buildAssets(): Promise<void> {
  const text = await renderAssets();
  mkdirSync("src/generated", { recursive: true });
  writeFileSync(ASSETS_FILE, text);
}

async function buildCli(): Promise<void> {
  await build({
    entryPoints: ["src/cli.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    packages: "external",
    outfile: "dist/cli.js",
  });
}

// Build only when run as a script (`node scripts/build.ts [assets]`), so a test can import
// `renderAssets` without writing anything.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildAssets();
  if (process.argv[2] !== "assets") await buildCli();
}
