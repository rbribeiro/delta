/**
 * Runs on raw `.dlt` text before XML parsing. Authors may write `<`, `>` and `&`
 * freely inside math (`$…$`, `$$…$$`) and inside RAW_TAGS content; this pass
 * entity-escapes those regions so the document stays well-formed XML. The parser
 * unescapes them again, so later passes see the original characters. `\$` is a
 * literal dollar and never opens math (the math pass unescapes it).
 *
 * A `$` with no closing `$` before a blank line (LaTeX's rule: math never crosses a
 * paragraph), or whose "math" would contain a closing tag `</…`, is a forgotten `\$`:
 * it is reported at its own line and column (like a bare `<`) and copied as is, so one
 * stray dollar never swallows the rest of the file.
 */

/** Tags whose text content is taken literally — protected here, never `$`-scanned. */
export const RAW_TAGS = new Set(["m", "math", "equation", "equations", "code", "c"]);

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

/** Entity-escapes `&`, `<` and `>`. Shared by this pass, the code highlighter and the emitter. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ENTITIES[c]);
}

/** A line break followed by a blank line: a paragraph break, which math never crosses. */
const BLANK_LINE = /\n[ \t\r]*\n/y;

/**
 * Where the math opened just before `from` ends: the index of its `closer` (`$` or `$$`),
 * or -1 when none comes before a blank line or the end of `text`. Any backslash pair is
 * skipped, so `\$` never closes math and `\\$` does. Shared with the math pass, so both
 * agree on where every formula ends.
 */
export function findMathEnd(text: string, from: number, closer: "$" | "$$"): number {
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "\n") {
      BLANK_LINE.lastIndex = i;
      if (BLANK_LINE.test(text)) return -1;
    }
    if (text.startsWith(closer, i)) return i;
  }
  return -1;
}

/** A forgotten `\$`, at offset `at` of the author's text (parse.ts turns it into an error). */
export interface DollarProblem {
  at: number;
  message: string;
}

/** `escapeHtml` plus `"`, for a double-quoted attribute value. */
export function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

export function preprocess(source: string): string {
  return preprocessMapped(source).text;
}

/**
 * `preprocess`, plus `map[j]` = the offset in `source` of output character `j`. Escaping
 * only lengthens text (one `<` becomes `&lt;`), so the map lets the parser report where an
 * element sits in the author's file, which is what `delta show` prints. `problems` lists
 * every unmatched `$`.
 */
export function preprocessMapped(source: string): { text: string; map: number[]; problems: DollarProblem[] } {
  let out = "";
  const map: number[] = [];
  const problems: DollarProblem[] = [];
  /** Copies `source[from, to)` verbatim. */
  const copy = (from: number, to: number): void => {
    out += source.slice(from, to);
    for (let k = from; k < to; k++) map.push(k);
  };
  /** Copies `source[from, to)` entity-escaped; every entity character maps to its source character. */
  const esc = (from: number, to: number): void => {
    for (let k = from; k < to; k++) {
      const e = escapeHtml(source[k]);
      out += e;
      for (let n = 0; n < e.length; n++) map.push(k);
    }
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    if (ch === "\\" && source[i + 1] === "$") {
      copy(i, i + 2);
      i += 2;
      continue;
    }

    if (ch === "$") {
      const closer = source[i + 1] === "$" ? "$$" : "$";
      const open = i + closer.length;
      const end = findMathEnd(source, open, closer);
      if (end === -1 || source.slice(open, end).includes("</")) {
        problems.push({ at: i, message: `unmatched ${closer}: write \\$ for a literal dollar` });
        copy(i, open);
        i = open;
        continue;
      }
      copy(i, open);
      esc(open, end);
      copy(end, end + closer.length);
      i = end + closer.length;
      continue;
    }

    if (ch === "<") {
      i = copyMarkup(source, i, copy, esc);
      continue;
    }

    copy(i, i + 1);
    i++;
  }
  return { text: out, map, problems };
}

/**
 * Copies one piece of markup verbatim starting at `<`: a comment, CDATA section,
 * declaration, or tag (quotes in attribute values respected, so `>` inside them
 * doesn't end the tag). When the tag opens a RAW_TAG, its content is escaped up
 * to the closing tag — raw content is opaque, so nothing inside it is scanned.
 * Returns the offset just past what it copied.
 */
function copyMarkup(
  source: string,
  start: number,
  copy: (from: number, to: number) => void,
  esc: (from: number, to: number) => void,
): number {
  for (const [open, close] of [
    ["<!--", "-->"],
    ["<![CDATA[", "]]>"],
  ] as const) {
    if (source.startsWith(open, start)) {
      const at = source.indexOf(close, start + open.length);
      const end = at === -1 ? source.length : at + close.length;
      copy(start, end);
      return end;
    }
  }

  let i = start + 1;
  let quote: string | null = null;
  while (i < source.length) {
    const c = source[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      break;
    }
    i++;
  }
  const end = Math.min(i + 1, source.length);
  const text = source.slice(start, end);
  copy(start, end);

  const name = /^<([A-Za-z][\w-]*)/.exec(text);
  const selfClosing = /\/\s*>$/.test(text);
  if (name && RAW_TAGS.has(name[1]) && !selfClosing) {
    const closeTag = new RegExp(`</\\s*${name[1]}\\s*>`);
    const match = closeTag.exec(source.slice(end));
    if (match) {
      esc(end, end + match.index);
      copy(end + match.index, end + match.index + match[0].length);
      return end + match.index + match[0].length;
    }
  }
  return end;
}
