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

function escapeRegion(s: string): string {
  return s.replace(/[&<>]/g, (c) => ENTITIES[c]);
}

export function preprocess(source: string): string {
  let out = "";
  let i = 0;
  let math: "$" | "$$" | null = null;

  while (i < source.length) {
    const ch = source[i];

    if (math) {
      if (ch === "\\" && source[i + 1] === "$") {
        out += "\\$";
        i += 2;
        continue;
      }
      if (ch === "$" && source.startsWith(math, i)) {
        out += math;
        i += math.length;
        math = null;
        continue;
      }
      out += escapeRegion(ch);
      i++;
      continue;
    }

    if (ch === "\\" && source[i + 1] === "$") {
      out += "\\$";
      i += 2;
      continue;
    }

    if (ch === "$") {
      math = source[i + 1] === "$" ? "$$" : "$";
      out += math;
      i += math.length;
      continue;
    }

    if (ch === "<") {
      const copied = copyMarkup(source, i);
      out += copied.text;
      i = copied.end;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

/**
 * Copies one piece of markup verbatim starting at `<`: a comment, CDATA section,
 * declaration, or tag (quotes in attribute values respected, so `>` inside them
 * doesn't end the tag). When the tag opens a RAW_TAG, its content is escaped up
 * to the closing tag — raw content is opaque, so nothing inside it is scanned.
 */
function copyMarkup(source: string, start: number): { text: string; end: number } {
  for (const [open, close] of [
    ["<!--", "-->"],
    ["<![CDATA[", "]]>"],
  ] as const) {
    if (source.startsWith(open, start)) {
      const at = source.indexOf(close, start + open.length);
      const end = at === -1 ? source.length : at + close.length;
      return { text: source.slice(start, end), end };
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
  let text = source.slice(start, end);

  const name = /^<([A-Za-z][\w-]*)/.exec(text);
  const selfClosing = /\/\s*>$/.test(text);
  if (name && RAW_TAGS.has(name[1]) && !selfClosing) {
    const closeTag = new RegExp(`</\\s*${name[1]}\\s*>`);
    const rest = source.slice(end);
    const match = closeTag.exec(rest);
    if (match) {
      text += escapeRegion(rest.slice(0, match.index)) + match[0];
      return { text, end: end + match.index + match[0].length };
    }
  }
  return { text, end };
}
