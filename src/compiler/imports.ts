import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import type { ElementNode, Position } from "./ast";
import { addDep, warn, error, type CompileContext, type ImportEntry } from "./context";
import { EXTERNAL_REF } from "./theme";


const JS_EXTERNAL_REF = /\bfetch\s*\(|\bimport\s*\(|https?:\/\//i;

/** The browser-side contract a package declares — a `"delta"` field in its `package.json`
 *  or a `delta.pack.json`. Every field is optional; an absent manifest is the folder
 *  convention (`index.js` + `theme.css`). */
interface PackManifest {
  /** Entry script (a classic browser script), relative to the pack dir. Default `index.js`. */
  js?: string;
  /** Component stylesheet, relative to the pack dir. Default `theme.css` (silent if absent). */
  css?: string;
  /** `delta-*` tags the pack owns; stored for future tag-gating, unused today. */
  tags?: string[];
  /** Other packages this one pulls in (resolved relative to this pack's dir). */
  needs?: string[];
  /** Compatible Delta version range; parsed but not enforced yet. */
  deltaVersion?: string;
}

/**
 * Resolves `<import src="…">` custom-element packs declared as direct children of `<document>`.
 * A `src` is a **local folder** (relative to the document, the original behavior) or, when it
 * names no local folder, a **bare package specifier** resolved from `node_modules`. Each resolved
 * pack is stashed on `ctx.imports`; emit inlines the JS after the runtime (so `window.Delta` is
 * available) and the CSS before the author theme. The `<import>` nodes are stripped so they never
 * serialize as `<delta-import>`. Document-level only — no tree walk.
 *
 * The shared resolution lives in `resolvePack`, which `project.ts` also calls for `project.toml`
 * `packages`, so all channels feed the one inliner. The output references nothing external: pack
 * files are inlined, an external reference inside one (via `fetch()`, `import()`, or `http(s)://`)
 * is a warning. A `src`-less import warns; an unresolvable pack is an error.
 *
 * @param doc the document node to scan for `<import>` children
 * @param ctx the compile context, used for warnings and to stash the resolved imports
 */
export function resolveImports(doc: ElementNode, ctx: CompileContext): void {
  const imports = doc.children.filter(
    (c): c is ElementNode => c.type === "element" && c.tag === "import",
  );
  if (imports.length === 0) return;
  // Strip every <import> so none survive into the output as <delta-import>.
  doc.children = doc.children.filter(
    (c) => !(c.type === "element" && c.tag === "import"),
  );

  const baseDir = resolve(dirname(ctx.file));
  // Dedup by absolute entry path, seeded with packages already on ctx.imports (e.g. injected
  // project-wide by project.ts) so the same pack reached through two channels inlines once.
  const seen = new Set(ctx.imports.map((i) => i.source));
  for (const node of imports) {
    const src = node.attrs.src;
    if (!src) {
      warn(ctx, "<import> without a 'src' attribute", node.pos);
      continue;
    }
    resolvePack(src, baseDir, ctx, seen, node.pos);
  }
}

/**
 * Resolves one package specifier and pushes it (and its `needs`, dependency-first) onto
 * `ctx.imports`. Shared by the `<import>` and `project.toml` `packages` channels.
 *
 * @param spec   a local path (`./x`, `../x`, `/x`, or a bare-looking relative folder that exists)
 *               or a bare npm specifier resolved from `node_modules`.
 * @param baseDir directory to resolve a local path / start the `node_modules` walk from.
 * @param ctx    compile context (diagnostics, deps, `imports` sink).
 * @param seen   absolute entry paths already inlined (dedup + cycle guard); mutated.
 * @param pos    source position of the originating `<import>` (omitted for project packages);
 *               its presence also distinguishes an explicit double-import (which warns) from a
 *               cross-channel duplicate (silent).
 */
export function resolvePack(
  spec: string,
  baseDir: string,
  ctx: CompileContext,
  seen: Set<string>,
  pos?: Position,
): void {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(spec)) {
    warn(ctx, `import src must be a local path or package name, not a URL: ${spec}`, pos);
    return;
  }

  const dir = resolvePackDir(spec, baseDir, ctx, pos);
  if (!dir) return; // already errored

  const { manifest, name } = readManifest(dir, ctx);
  const jsRel = manifest.js ?? "index.js";
  const jsPath = resolve(dir, jsRel);
  if (!existsSync(jsPath)) {
    error(ctx, `import pack not found: ${spec} (${jsRel})`, pos);
    return;
  }
  if (seen.has(jsPath)) {
    if (pos) warn(ctx, `import pack already imported: ${spec}`, pos);
    return; // cross-channel duplicate: inline once, silently
  }
  seen.add(jsPath); // reserve before recursing `needs` so a cycle terminates

  // Dependencies first, so a pack that `needs` another inlines after it.
  for (const need of manifest.needs ?? []) resolvePack(need, dir, ctx, seen, pos);

  const js = readFileSync(jsPath, "utf8");
  addDep(ctx, jsPath);
  if (JS_EXTERNAL_REF.test(js)) {
    warn(ctx, `import '${spec}' references an external resource; output may not work offline`, pos);
  }

  const cssRel = manifest.css ?? "theme.css";
  const cssPath = resolve(dir, cssRel);
  let css: string | undefined;
  if (existsSync(cssPath)) {
    css = readFileSync(cssPath, "utf8");
    addDep(ctx, cssPath);
    if (EXTERNAL_REF.test(css)) {
      warn(ctx, `import theme '${spec}/${cssRel}' references an external resource; output may not work offline`, pos);
    }
  } else if (manifest.css !== undefined) {
    // The default theme.css is optional, but a manifest that names a css file means it.
    warn(ctx, `import '${spec}' declares css '${manifest.css}' but it was not found`, pos);
  }

  ctx.imports.push({ source: jsPath, js, css, name, tags: manifest.tags } satisfies ImportEntry);
}

/** Maps a specifier to its pack directory: an existing local folder (back-compat, including bare
 *  relative paths like `imports/mod`), else a bare npm specifier resolved from `node_modules`. */
function resolvePackDir(
  spec: string,
  baseDir: string,
  ctx: CompileContext,
  pos?: Position,
): string | undefined {
  const pathLike = /^(\.\.?\/|\/)/.test(spec) || spec === "." || spec === "..";
  const local = resolve(baseDir, spec);
  if (existsSync(local) && statSync(local).isDirectory()) return local;
  if (pathLike) {
    error(ctx, `import pack not found: ${spec}`, pos);
    return undefined;
  }
  // Bare specifier → resolve <spec>/package.json against node_modules, walking up from baseDir.
  try {
    const require = createRequire(resolve(baseDir, "noop.js"));
    return dirname(require.resolve(`${spec}/package.json`));
  } catch {
    error(ctx, `import pack not found: ${spec} (not a local folder, and not installed in node_modules)`, pos);
    return undefined;
  }
}

/** Reads a pack's manifest (`package.json` `"delta"` field, then `delta.pack.json`, else the
 *  folder convention) plus a display name (the npm `name`, else the folder basename). */
function readManifest(dir: string, ctx: CompileContext): { manifest: PackManifest; name: string } {
  let name = basename(dir);

  const pkgJsonPath = resolve(dir, "package.json");
  if (existsSync(pkgJsonPath)) {
    addDep(ctx, pkgJsonPath);
    const pkg = tryReadJson(pkgJsonPath);
    if (pkg && typeof pkg.name === "string") name = pkg.name;
    if (pkg && pkg.delta && typeof pkg.delta === "object") {
      return { manifest: normalizeManifest(pkg.delta as Record<string, unknown>), name };
    }
  }

  const packJsonPath = resolve(dir, "delta.pack.json");
  if (existsSync(packJsonPath)) {
    addDep(ctx, packJsonPath);
    const data = tryReadJson(packJsonPath);
    if (data) return { manifest: normalizeManifest(data), name };
  }

  return { manifest: {}, name };
}

/** Keeps only the well-typed manifest fields; anything malformed is ignored (lenient). */
function normalizeManifest(d: Record<string, unknown>): PackManifest {
  const m: PackManifest = {};
  if (typeof d.js === "string") m.js = d.js;
  if (typeof d.css === "string") m.css = d.css;
  if (typeof d.deltaVersion === "string") m.deltaVersion = d.deltaVersion;
  if (Array.isArray(d.tags)) m.tags = d.tags.filter((t): t is string => typeof t === "string");
  if (Array.isArray(d.needs)) m.needs = d.needs.filter((t): t is string => typeof t === "string");
  return m;
}

function tryReadJson(path: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
