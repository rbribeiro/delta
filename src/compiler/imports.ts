import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ElementNode } from "./ast";
import { addDep, warn, error,  type CompileContext, type ImportEntry } from "./context";
import { EXTERNAL_REF } from "./theme";


const JS_EXTERNAL_REF = /\bfetch\s*\(|\bimport\s*\(|https?:\/\//i;

/**
 * Resolves `<import src="folder/">` custom-element packs declared as direct children of `<document>`.
 * Each import folder holds an `index.js` (a classic browser script that registers `delta-*` custom elements) and may hold a `theme.css`.
 * Both are read at compile time and stashed on `ctx.imports`; emit inlines the JS after the runtime (so `window.Delta` is available) and the CSS before the author theme (so the author theme can override the pack theme).
 *
 * The output references nothing external, so pack files are inlined, never linked. Import without a `src` attribute or that does not exist is an error. Importing the same pack twice is a warning and only inlines once. Importing a pack that references external resources (via `fetch()`, `import()`, or `http(s)://`) is a warning.
 * 
 * It is important to note that the `<import>` nodes are stripped from the document so they never serialize as `<delta-import>`. Imports are document-level: only direct children of `<document>` are scanned (no tree walk).
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

  const masterDir = resolve(dirname(ctx.file));
  const seen = new Set<string>(); // dedup by absolute index.js path
  for (const node of imports) {
    const src = node.attrs.src;
    if (!src) {
      warn(ctx, "<import> without a 'src' attribute", node.pos);
      continue;
    }
    if (/^[a-z]+:\/\//i.test(src)) {
      warn(ctx, `import src must be a local path, not a URL: ${src}`, node.pos);
      continue;
    }

    const dir = resolve(masterDir, src);
    const jsPath = resolve(dir, "index.js");
    if (!existsSync(jsPath)) {
      error(ctx, `import pack not found: ${src}/index.js`, node.pos);
      continue;
    }
    if (seen.has(jsPath)) {
      warn(ctx, `import pack already imported: ${src}/index.js`, node.pos);
      continue; // same pack imported twice, inline them once
      }
    seen.add(jsPath);

    const js = readFileSync(jsPath, "utf8");
    addDep(ctx, jsPath);
    if (JS_EXTERNAL_REF.test(js)) {
      warn(ctx, `import '${src}' references an external resource; output may not work offline`, node.pos);
    }

    const cssPath = resolve(dir, "theme.css");
    let css: string | undefined;
    if (existsSync(cssPath)) {
      css = readFileSync(cssPath, "utf8");
      addDep(ctx, cssPath);
      if (EXTERNAL_REF.test(css)) {
        warn(ctx, `import theme '${src}/theme.css' references an external resource; output may not work offline`, node.pos);
      }
    }

    ctx.imports.push({ source: jsPath, js, css } satisfies ImportEntry);
  }
}
