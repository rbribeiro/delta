import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { ElementNode } from "./ast";
import { addDep, warn, type CompileContext } from "./context";
import { BUILTIN_THEMES } from "../generated/assets";

/**
 * Resolves `<document theme="…">`, which names one of two things:
 *
 *   - a **built-in theme** that ships with Delta (`theme="impatech"`) — its CSS
 *     comes from BUILTIN_THEMES and lands on `ctx.builtinCss`, which emit inlines
 *     in `@layer delta.builtin`, low in the cascade;
 *   - the **author's own stylesheet** (`theme="my.css"`) — read at compile time
 *     into `ctx.userCss`, which emit inlines last and unlayered so it overrides
 *     the design system. Resolved relative to the document (like figure images
 *     and KaTeX fonts) so the output stays self-contained — never linked.
 *
 * A remote, missing or unknown theme is a *warning* (the theme is dropped), never
 * a build failure.
 *
 * The output is meant to reference nothing external; a theme that pulls in an
 * `@import` or a remote `url(…)` would break that, so we warn — but still inline
 * it, leaving the call to the author (we never rewrite their CSS).
 */

export const EXTERNAL_REF = /@import|url\(\s*['"]?(?:https?:|\/\/)/i;

/** A bare name — a letter, then letters/digits/dashes. Anything holding a dot,
 *  slash or backslash is a path (`theme.css`, `./x.css`, `../a/x.css`, `/abs.css`).
 *
 *  The *shape* picks the namespace, not whether the name happens to exist. That
 *  matters twice over: shipping a new built-in can never silently change what an
 *  existing document means (a bare name was never a valid path before), and the
 *  built-in branch touches no filesystem, so a stray file next to the document
 *  can't change how it renders. A typo also stays legible — "unknown built-in
 *  theme 'impatek'" instead of a confusing "theme file not found". */
const BUILTIN_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;
export function isBuiltinThemeName(value: string): boolean {
  return BUILTIN_NAME.test(value);
}

/**
 * Resolves `<document theme="…">` and stashes the CSS on `ctx.userCss` so the emitter can inline it
 * at the end of the `<style>` block so it overrides the design system and custom element styles.
 * 
 * @param doc - the root element of the document
 * @param ctx - the compilation context
 * @returns void
 */
export function resolveTheme(doc: ElementNode, ctx: CompileContext): void {
  const themeAttr = doc.attrs.theme;
  const accentAttr = doc.attrs["theme-accent"];
  if (accentAttr) ctx.themeAccent = accentAttr;

  // Color mode: `light` (the default) | `dark` | `auto` (follows the OS via
  // prefers-color-scheme). `light` is the baseline look, so it needs no data-mode;
  // an unknown value warns and is dropped (mirrors the URL guard below).
  const modeAttr = doc.attrs["theme-mode"];
  if (modeAttr && modeAttr !== "light") {
    if (modeAttr === "dark" || modeAttr === "auto") ctx.themeMode = modeAttr;
    else warn(ctx, `unknown theme-mode '${modeAttr}' (expected light, dark, or auto)`, doc.pos);
  }

  if (!themeAttr) return;

  if (/^[a-z]+:\/\//i.test(themeAttr)) {
    warn(ctx, `theme must be a local path, not a URL: ${themeAttr}`, doc.pos);
    return;
  }

  // A bare name is a built-in and is never retried as a path — falling back would
  // report "file not found" for what is really a typo, and would make the result
  // depend on the filesystem. No addDep either: a built-in ships inside the
  // compiler, so there is no user file for --watch to watch.
  if (isBuiltinThemeName(themeAttr)) {
    const builtin = BUILTIN_THEMES[themeAttr.toLowerCase()];
    if (!builtin) {
      const names = Object.keys(BUILTIN_THEMES).sort().join(", ");
      warn(
        ctx,
        `unknown built-in theme '${themeAttr}' (available: ${names}); ` +
          `for your own stylesheet use a path, e.g. './${themeAttr}.css'`,
        doc.pos,
      );
      return;
    }
    ctx.builtinCss = builtin;
    return;
  }

  let css: string;
  const themePath = resolve(dirname(ctx.file), themeAttr);
  try {
    css = readFileSync(themePath, "utf8");
  } catch {
    // `theme="impatech.css"` is the likeliest near-miss: name-shaped but for the
    // extension, so it took the path branch and missed.
    const stem = basename(themeAttr).replace(/\.css$/i, "");
    const didYouMean = BUILTIN_THEMES[stem.toLowerCase()]
      ? ` (did you mean the built-in theme '${stem}'? drop the .css)`
      : "";
    warn(ctx, `theme file not found: ${themeAttr}${didYouMean}`, doc.pos);
    return;
  }
  addDep(ctx, themePath);

  if (EXTERNAL_REF.test(css)) {
    warn(ctx, `theme '${themeAttr}' references an external resource; output may not work offline`, doc.pos);
  }
  ctx.userCss = css;
}
