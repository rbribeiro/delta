import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

let cached: string | undefined;

/**
 * KaTeX's stylesheet with every woff2 font embedded as a `data:` URI and the
 * woff/ttf fallbacks dropped. This is what makes math render offline from
 * `file://` — the output may reference no external resources.
 */
export function katexCss(): string {
  if (cached !== undefined) return cached;
  const cssPath = require.resolve("katex/dist/katex.min.css");
  const css = readFileSync(cssPath, "utf8");
  const inlined = css.replace(/src:[^;}]*/g, (src) => {
    const woff2 = /url\((fonts\/[^)]+\.woff2)\)/.exec(src);
    if (!woff2) return src;
    const data = readFileSync(join(dirname(cssPath), woff2[1])).toString("base64");
    return `src:url(data:font/woff2;base64,${data}) format("woff2")`;
  });
  // KaTeX renders math at 1.21em — noticeably larger than surrounding prose. Scale
  // it toward body-text size (LaTeX-like) via --delta-math-scale. Appended last and
  // unlayered, so it overrides KaTeX's own `.katex` rule above (same specificity).
  cached = inlined + "\n.katex{font-size:var(--delta-math-scale,1.1em)}\n";
  return cached;
}
