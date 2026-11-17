import { elements, type ElementNode, type Position } from "./ast.ts";
import { error, type CompileContext } from "./context.ts";
import { preprocessMapped } from "./preprocess.ts";
import { parseXml } from "./xml.ts";
import { lineIndex } from "./lines.ts";

/**
 * The front end, and the pipeline's `parse` step: preprocesses and parses the author's text, recording it in `ctx.sources` under `ctx.file`
 * and giving every element its exact `src` span in that text (what `delta show` prints).
 */
export function parse(source: string, ctx: CompileContext): ElementNode | null {
  const { text, map, problems } = preprocessMapped(source);
  ctx.sources.set(ctx.file, source);
  // A forgotten `\$` is an error at the dollar itself, like a bare `<`.
  const posAt = locator(source, (at) => at, ctx.file);
  for (const p of problems) error(ctx, p.message, posAt(p.at));
  return parsePreprocessed(text, ctx, map);
}

/**
 * Parses already preprocessed text into an element tree, or returns null after reporting
 * every well-formedness error as a diagnostic. `map`, from `preprocessMapped`, turns offsets
 * in `source` into offsets in the author's text; every `src` span and every diagnostic is
 * reported in the author's coordinates. Without it, spans are offsets into `source` itself.
 */
export function parsePreprocessed(
  source: string,
  ctx: CompileContext,
  map?: number[],
): ElementNode | null {
  const file = ctx.file;
  // The map has one entry per character of `source`; an exclusive end at EOF maps past the
  // author's last character.
  const orig = (at: number): number =>
    !map ? at : at < map.length ? map[at] : (map[map.length - 1] ?? -1) + 1;
  const posAt = locator(source, orig, file);

  const doc = parseXml(source, file, (message, at) => error(ctx, message, posAt(at)));
  if (!doc) return null;
  for (const el of elements(doc)) {
    const s = el.src!;
    el.pos = posAt(s.start);
    el.src = {
      file,
      start: orig(s.start),
      end: orig(s.end),
      inner: orig(s.inner),
      innerEnd: orig(s.innerEnd),
    };
  }
  return doc;
}

/**
 * Offset in `text` → the line and 1-based column of that character in the author's file.
 * Preprocessing never adds or removes a newline, so lines coincide; the column is measured
 * through `orig`, which undoes any escaping earlier on the same line.
 */
function locator(
  text: string,
  orig: (at: number) => number,
  file: string,
): (at: number) => Position {
  const lines = lineIndex(text);
  return (at) => {
    const line = lines.lineOf(at);
    // The column is counted in the author's text: map the newline ending the previous line.
    const lineStart = line === 1 ? 0 : orig(lines.startOf(at) - 1) + 1;
    return { line, column: orig(at) - lineStart + 1, file };
  };
}
