import { elements, type ElementNode, type Position } from "./ast.ts";
import { error, type CompileContext } from "./context.ts";
import { preprocessMapped } from "./preprocess.ts";
import { parseXml } from "./xml.ts";

/**
 * Preprocesses and parses the author's text, recording it in `ctx.sources` under `ctx.file`
 * and giving every element its exact `src` span in that text (what `delta show` prints).
 */
export function parseSource(source: string, ctx: CompileContext): ElementNode | null {
  const { text, map, problems } = preprocessMapped(source);
  ctx.sources.set(ctx.file, source);
  // A forgotten `\$` is an error at the dollar itself, like a bare `<`.
  const posAt = locator(source, (at) => at, ctx.file);
  for (const p of problems) error(ctx, p.message, posAt(p.at));
  return parse(text, ctx, map);
}

/**
 * Parses the (preprocessed) source into an element tree, or returns null after reporting
 * every well-formedness error as a diagnostic. `map`, from `preprocessMapped`, turns offsets
 * in `source` into offsets in the author's text; every `src` span and every diagnostic is
 * reported in the author's coordinates. Without it, spans are offsets into `source` itself.
 */
export function parse(source: string, ctx: CompileContext, map?: number[]): ElementNode | null {
  const file = ctx.file;
  // The map has one entry per character of `source`; an exclusive end at EOF maps past the
  // author's last character.
  const orig = (at: number): number => (!map ? at : at < map.length ? map[at] : (map[map.length - 1] ?? -1) + 1);
  const posAt = locator(source, orig, file);

  const doc = parseXml(source, file, (message, at) => error(ctx, message, posAt(at)));
  if (!doc) return null;
  for (const el of elements(doc)) {
    const s = el.src!;
    el.pos = posAt(s.start);
    el.src = { file, start: orig(s.start), end: orig(s.end), inner: orig(s.inner), innerEnd: orig(s.innerEnd) };
  }
  return doc;
}

/**
 * Offset in `text` → the line and 1-based column of that character in the author's file.
 * Preprocessing never adds or removes a newline, so lines coincide; the column is measured
 * through `orig`, which undoes any escaping earlier on the same line.
 */
function locator(text: string, orig: (at: number) => number, file: string): (at: number) => Position {
  const newlines: number[] = [];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) newlines.push(i);
  return (at) => {
    // How many newlines come before `at`: binary search, so a long file costs nothing.
    let lo = 0;
    let hi = newlines.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (newlines[mid] < at) lo = mid + 1;
      else hi = mid;
    }
    const lineStart = lo === 0 ? 0 : orig(newlines[lo - 1]) + 1;
    return { line: lo + 1, column: orig(at) - lineStart + 1, file };
  };
}
