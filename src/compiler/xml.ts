/**
 * A strict XML parser, written for Delta so the compiler depends on nothing for it. It reads
 * the preprocessed text once, left to right, and builds the generic tree directly: every
 * element gets its `src` span from the indices where its tags were read (the opening `<`,
 * just past the opening tag, the `<` of the closing tag, just past it).
 *
 * Strict means what XML means: every tag closed, in order; every attribute quoted; `<` and
 * `&` written as `&lt;` and `&amp;` in prose; the five named entities and numeric character
 * references, nothing else. Comments and the `<?xml …?>` declaration are accepted and
 * dropped; DOCTYPEs and processing instructions are refused, since Delta has no use for
 * them. Errors are reported at the offset where they are, with a message that says what to
 * write instead, and parsing goes on after each one so the author sees them all at once.
 *
 * This is the whole XML Delta understands. If a document parses here, it is well-formed XML;
 * the converse is not quite true (DOCTYPE), and that is on purpose.
 */

import { element, type ElementNode } from "./ast.ts";

/** Called for every well-formedness error, with its offset in the text. */
export type XmlErrorReporter = (message: string, at: number) => void;

/**
 * Parses `text` into an element tree. Returns the root element, or null when any error was
 * reported (the tree would be unreliable) or there is no root. Adjacent text and CDATA become
 * one text node. `file` is only copied into each element's `src`.
 */
export function parseXml(text: string, file: string, report: XmlErrorReporter): ElementNode | null {
  return new XmlParser(text, file, report).parse();
}

const NAME = /[A-Za-z_:][A-Za-z0-9_.:-]*/y;
const SPACES = /[ \t\r\n]*/y;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
/** `&#x1F;`, `&#31;`, `&name;` — or a bare `&`, when none of the three follows. */
const ENTITY = /&(?:#x([0-9A-Fa-f]+);|#([0-9]+);|([A-Za-z][A-Za-z0-9]*);)?/g;

class XmlParser {
  private readonly text: string;
  private readonly file: string;
  private readonly report: XmlErrorReporter;
  private i = 0;
  private failed = false;
  private readonly root = element("#root");
  /** The open elements, outermost first; `root` stays at the bottom. */
  private readonly stack: ElementNode[] = [this.root];

  constructor(text: string, file: string, report: XmlErrorReporter) {
    this.text = text;
    this.file = file;
    this.report = report;
  }

  parse(): ElementNode | null {
    const { text } = this;
    if (/^<\?xml[\s?]/.test(text)) this.skipPast("?>", "unterminated XML declaration");

    while (this.i < text.length) {
      if (text[this.i] !== "<") this.textRun();
      else if (text.startsWith("<!--", this.i)) this.comment();
      else if (text.startsWith("<![CDATA[", this.i)) this.cdata();
      else if (text.startsWith("</", this.i)) this.closeTag();
      else if (text.startsWith("<?", this.i)) {
        const what = text.startsWith("<?xml", this.i) ? "the XML declaration must be at the very start of the file" : "processing instructions are not supported";
        this.error(what, this.i);
        this.skipPast("?>");
      } else if (text.startsWith("<!", this.i)) {
        this.error("<!DOCTYPE …> is not supported: Delta documents need no DOCTYPE", this.i);
        this.skipPast(">");
      } else this.openTag();
    }

    // Innermost first: the element nearest the end is the one the author forgot.
    for (const el of this.stack.slice(1).reverse()) this.error(`unclosed <${el.tag}>: reached the end of the file`, el.src!.start);
    const doc = this.root.children.find((c): c is ElementNode => c.type === "element");
    if (!doc) this.error("no root element found", 0);
    return this.failed || !doc ? null : doc;
  }

  // -- text ------------------------------------------------------------------------------

  /** Prose up to the next `<`: entities decoded, newlines normalised, outside the root an error. */
  private textRun(): void {
    const start = this.i;
    const end = this.text.indexOf("<", start);
    this.i = end === -1 ? this.text.length : end;
    const raw = this.text.slice(start, this.i);

    const bad = raw.indexOf("]]>");
    if (bad !== -1) this.error("`]]>` is not allowed in text (write ]]&gt;)", start + bad);
    if (this.stack.length === 1) {
      const ink = raw.search(/\S/);
      if (ink !== -1) this.error("text outside the root element", start + ink);
      return;
    }
    this.addText(normalizeNewlines(this.decode(raw, start)));
  }

  private comment(): void {
    const start = this.i;
    const end = this.text.indexOf("-->", start + 4);
    if (end === -1) {
      this.error("unterminated comment", start);
      this.i = this.text.length;
      return;
    }
    const dashes = this.text.slice(start + 4, end).indexOf("--");
    if (dashes !== -1) this.error("`--` is not allowed inside a comment", start + 4 + dashes);
    this.i = end + 3;
  }

  /** `<![CDATA[…]]>`: text taken literally, no entities. */
  private cdata(): void {
    const start = this.i;
    const end = this.text.indexOf("]]>", start + 9);
    if (end === -1) {
      this.error("unterminated CDATA section", start);
      this.i = this.text.length;
      return;
    }
    this.i = end + 3;
    if (this.stack.length === 1) this.error("text outside the root element", start);
    else this.addText(normalizeNewlines(this.text.slice(start + 9, end)));
  }

  private addText(s: string): void {
    if (s === "") return;
    const siblings = this.stack[this.stack.length - 1].children;
    const last = siblings[siblings.length - 1];
    if (last?.type === "text") last.text += s;
    else siblings.push({ type: "text", text: s });
  }

  /** Replaces entity references in `raw` (which starts at offset `at`); errors keep the text as written. */
  private decode(raw: string, at: number): string {
    return raw.replace(ENTITY, (m: string, hex?: string, dec?: string, name?: string, offset?: number) => {
      const where = at + (offset ?? 0);
      if (hex !== undefined || dec !== undefined) {
        const code = parseInt(hex ?? dec!, hex !== undefined ? 16 : 10);
        if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
          this.error(`invalid character reference ${m}`, where);
          return m;
        }
        return String.fromCodePoint(code);
      }
      if (name !== undefined) {
        const value = ENTITIES[name];
        if (value === undefined) this.error(`unknown entity ${m} (XML has only &amp; &lt; &gt; &quot; and &apos;)`, where);
        return value ?? m;
      }
      this.error("bare `&`: write &amp;", where);
      return m;
    });
  }

  // -- tags ------------------------------------------------------------------------------

  private openTag(): void {
    const start = this.i;
    this.i++;
    const name = this.name();
    if (name === undefined) {
      this.error("expected a tag name after `<`", start);
      this.skipPast(">");
      return;
    }
    const el = element(name);
    el.src = { file: this.file, start, end: start, inner: start, innerEnd: start };
    const selfClosing = this.attributes(el);
    el.src.inner = el.src.innerEnd = el.src.end = this.i;

    const parent = this.stack[this.stack.length - 1];
    if (parent === this.root && this.root.children.some((c) => c.type === "element")) {
      this.error(`only one root element is allowed; found a second <${name}>`, start);
    }
    parent.children.push(el);
    if (!selfClosing) this.stack.push(el);
  }

  /** The attributes of `el` up to and including the `>` or `/>`; true when self-closing. */
  private attributes(el: ElementNode): boolean {
    const { text } = this;
    while (true) {
      const spaced = this.skipSpaces();
      const c = text[this.i];
      if (c === undefined) {
        this.error(`expected \`>\` to end <${el.tag}>: reached the end of the file`, el.src!.start);
        return false;
      }
      if (c === ">") {
        this.i++;
        return false;
      }
      if (c === "/") {
        if (text[this.i + 1] === ">") {
          this.i += 2;
          return true;
        }
        this.error("expected `/>`", this.i);
        this.i++;
        continue;
      }
      if (c === "<") {
        this.error(`expected \`>\` to end <${el.tag}>, found \`<\``, this.i); // left for the main loop
        return false;
      }
      if (!spaced) this.error("whitespace required between attributes", this.i);

      const nameAt = this.i;
      const name = this.name();
      if (name === undefined) {
        this.error(`unexpected \`${c}\` in <${el.tag}>`, this.i);
        return this.resync();
      }
      this.skipSpaces();
      if (!this.eat("=")) {
        this.error(`attribute \`${name}\` needs a value: ${name}="…"`, nameAt);
        return this.resync();
      }
      this.skipSpaces();
      const quote = text[this.i];
      if (quote !== '"' && quote !== "'") {
        this.error(`the value of \`${name}\` must be quoted`, this.i);
        return this.resync();
      }
      const valueAt = this.i + 1;
      const close = text.indexOf(quote, valueAt);
      if (close === -1) {
        this.error("unterminated attribute value", this.i);
        this.i = text.length;
        return false;
      }
      const raw = text.slice(valueAt, close);
      this.i = close + 1;
      const lt = raw.indexOf("<");
      if (lt !== -1) this.error("`<` is not allowed in an attribute value (write &lt;)", valueAt + lt);
      if (Object.hasOwn(el.attrs, name)) this.error(`duplicate attribute \`${name}\` in <${el.tag}>`, nameAt);
      // Line breaks and tabs in a value are spaces (XML's attribute-value normalisation).
      el.attrs[name] = this.decode(raw.replace(/[\t\r\n]/g, " "), valueAt);
    }
  }

  /** After an error inside a tag: skip to just past its `>`; true when that was a `/>`. */
  private resync(): boolean {
    const end = this.text.indexOf(">", this.i);
    if (end === -1) {
      this.i = this.text.length;
      return false;
    }
    this.i = end + 1;
    return end > 0 && this.text[end - 1] === "/";
  }

  private closeTag(): void {
    const start = this.i;
    this.i += 2;
    const name = this.name();
    this.skipSpaces();
    if (name === undefined || !this.eat(">")) {
      this.error("malformed closing tag", start);
      this.skipPast(">");
      return;
    }
    let depth = this.stack.length - 1;
    while (depth > 0 && this.stack[depth].tag !== name) depth--;
    if (depth === 0) {
      this.error(`unexpected </${name}>: no <${name}> is open`, start);
      return;
    }
    // Everything opened inside the element being closed was left open.
    while (this.stack.length - 1 > depth) {
      const left = this.stack.pop()!;
      this.error(`unclosed <${left.tag}>: found </${name}> first`, left.src!.start);
    }
    const el = this.stack.pop()!;
    el.src!.innerEnd = start;
    el.src!.end = this.i;
  }

  // -- lexing helpers --------------------------------------------------------------------

  private name(): string | undefined {
    NAME.lastIndex = this.i;
    const m = NAME.exec(this.text);
    if (!m) return undefined;
    this.i += m[0].length;
    return m[0];
  }

  /** Skips whitespace; true when there was any. */
  private skipSpaces(): boolean {
    SPACES.lastIndex = this.i;
    const n = SPACES.exec(this.text)![0].length;
    this.i += n;
    return n > 0;
  }

  private eat(s: string): boolean {
    if (!this.text.startsWith(s, this.i)) return false;
    this.i += s.length;
    return true;
  }

  /** Moves just past the next `s`; at EOF without one, reports `missing` (when given). */
  private skipPast(s: string, missing?: string): void {
    const end = this.text.indexOf(s, this.i);
    if (end === -1) {
      if (missing) this.error(missing, this.i);
      this.i = this.text.length;
    } else this.i = end + s.length;
  }

  private error(message: string, at: number): void {
    this.failed = true;
    this.report(message, at);
  }
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}
