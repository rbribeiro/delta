/**
 * Runs on raw `.dlt` text before XML parsing. Authors may write `<`, `>` and `&`
 * freely inside math (`$…$`, `$$…$$`) and inside RAW_TAGS content; this pass
 * entity-escapes those regions so the document stays well-formed XML. The parser
 * unescapes them again, so later passes see the original characters. `\$` is a
 * literal dollar and never opens math (the math pass unescapes it).
 */

/** Tags whose text content is taken literally — protected here, never `$`-scanned. */
export const RAW_TAGS = new Set(["m", "math", "equation", "equations", "code", "c"]);

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

/** Entity-escapes `&`, `<` and `>`. Shared by this pass, the code highlighter and the emitter. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ENTITIES[c]);
}

export function preprocess(source: string): string {
  return preprocessMapped(source).text;
}

/**
 * `preprocess`, plus `map[j]` = the offset in `source` of output character `j`. Escaping
 * only lengthens text (one `<` becomes `&lt;`), so the map lets the parser report where an
 * element sits in the author's file, which is what `delta show` prints.
 */
export function preprocessMapped(source: string): { text: string; map: number[] } {
  let out = "";
  const map: number[] = [];
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
  let math: "$" | "$$" | null = null;

  while (i < source.length) {
    const ch = source[i];

    if (math) {
      if (ch === "\\" && source[i + 1] === "$") {
        copy(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === "$" && source.startsWith(math, i)) {
        copy(i, i + math.length);
        i += math.length;
        math = null;
        continue;
      }
      esc(i, i + 1);
      i++;
      continue;
    }

    if (ch === "\\" && source[i + 1] === "$") {
      copy(i, i + 2);
      i += 2;
      continue;
    }

    if (ch === "$") {
      math = source[i + 1] === "$" ? "$$" : "$";
      copy(i, i + math.length);
      i += math.length;
      continue;
    }

    if (ch === "<") {
      i = copyMarkup(source, i, copy, esc);
      continue;
    }

    copy(i, i + 1);
    i++;
  }
  return { text: out, map };
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
