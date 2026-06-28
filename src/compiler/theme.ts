import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ElementNode } from "./ast";
import { addDep, warn, type CompileContext } from "./context";

/**
 * Resolves `<document theme="my.css">`: reads the author's stylesheet at compile
 * time and stashes it on `ctx.userCss`, which the emitter inlines as the last
 * (unlayered) `<style>` block so it overrides the design system. The file is
 * resolved relative to the document (like figure images and KaTeX fonts) so the
 * output stays self-contained — never linked. A remote or missing theme is a
 * *warning* (the theme is dropped), never a build failure.
 *
 * The output is meant to reference nothing external; a theme that pulls in an
 * `@import` or a remote `url(…)` would break that, so we warn — but still inline
 * it, leaving the call to the author (we never rewrite their CSS).
 */

export const EXTERNAL_REF = /@import|url\(\s*['"]?(?:https?:|\/\/)/i;

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
  if (!themeAttr) return;

  if (/^[a-z]+:\/\//i.test(themeAttr)) {
    warn(ctx, `theme must be a local path, not a URL: ${themeAttr}`, doc.pos);
    return;
  }

  let css: string;
  const themePath = resolve(dirname(ctx.file), themeAttr);
  try {
    css = readFileSync(themePath, "utf8");
  } catch {
    warn(ctx, `theme file not found: ${themeAttr}`, doc.pos);
    return;
  }
  addDep(ctx, themePath);

  if (EXTERNAL_REF.test(css)) {
    warn(ctx, `theme '${themeAttr}' references an external resource; output may not work offline`, doc.pos);
  }
  ctx.userCss = css;
}
