/**
 * The subset of TOML a `project.toml` needs, parsed by hand so Delta depends on nothing for
 * it: comments, `key = value`, strings, integers, booleans, arrays (over several lines, with a
 * trailing comma and comments inside) and `[table]` headers. Everything else TOML has (inline
 * tables, arrays of tables, floats, dates, multi-line strings, quoted or dotted keys) is
 * reported as "not supported", with its line and column, so an author who reaches for it is
 * told at once instead of getting a half-read configuration.
 *
 * Integers and booleans are parsed into real values on purpose: config.ts checks the types
 * itself and says which key should have been a string.
 */

export class TomlError extends Error {
  readonly line: number;
  /** 1-based, in characters. */
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(message);
    this.name = "TomlError";
    this.line = line;
    this.column = column;
  }
}

type Table = Record<string, unknown>;

export function parseToml(text: string): Table {
  return new Parser(text).parse();
}

const BARE_KEY = /[A-Za-z0-9_-]+/y;
const DIGITS = /[0-9_]+/y;
const SPACES = /[ \t]*/y;
const ESCAPES: Record<string, string> = { '"': '"', "\\": "\\", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };

class Parser {
  private readonly text: string;
  private i = 0;
  private readonly root: Table = {};
  /** The table the next `key = value` lands in: the root, or the last `[header]`. */
  private current: Table = this.root;
  private readonly headers = new Set<string>();

  constructor(text: string) {
    this.text = text;
  }

  parse(): Table {
    while (true) {
      this.skipSpaces();
      const c = this.text[this.i];
      if (c === undefined) return this.root;
      if (c === "\n" || c === "\r") {
        this.newline();
      } else if (c === "#") {
        this.skipComment();
      } else {
        if (c === "[") this.header();
        else this.keyValue();
        this.endOfLine();
      }
    }
  }

  // -- lines ---------------------------------------------------------------------------

  /** `[name]` or `[a.b]`: every later `key = value` goes into that table. */
  private header(): void {
    const at = this.i;
    if (this.text.startsWith("[[", at)) this.fail("arrays of tables ([[x]]) are not supported in project.toml");
    this.i++;
    const path: string[] = [];
    do {
      this.skipSpaces();
      path.push(this.key());
      this.skipSpaces();
    } while (this.eat("."));
    if (!this.eat("]")) this.fail("expected `]` to end the table header");

    const name = path.join(".");
    if (this.headers.has(name)) this.fail(`table [${name}] defined twice`, at);
    this.headers.add(name);
    let table = this.root;
    for (const part of path) {
      const next = (table[part] ??= {});
      if (typeof next !== "object" || next === null || Array.isArray(next)) {
        this.fail(`\`${part}\` is a value, not a table`, at);
      }
      table = next as Table;
    }
    this.current = table;
  }

  private keyValue(): void {
    const at = this.i;
    const key = this.key();
    this.skipSpaces();
    if (this.text[this.i] === ".") this.fail("dotted keys (a.b = …) are not supported in project.toml: use a [table] header");
    if (!this.eat("=")) this.fail(`expected \`=\` after key \`${key}\``);
    this.skipSpaces();
    const value = this.value();
    if (Object.hasOwn(this.current, key)) this.fail(`duplicate key \`${key}\``, at);
    this.current[key] = value;
  }

  private key(): string {
    const c = this.text[this.i];
    if (c === '"' || c === "'") this.fail("quoted keys are not supported in project.toml");
    const key = this.match(BARE_KEY);
    if (key === undefined) this.fail("expected a key");
    return key;
  }

  /** After a header or a value: spaces, maybe a comment, then the end of the line. */
  private endOfLine(): void {
    this.skipSpaces();
    const c = this.text[this.i];
    if (c === "#") this.skipComment();
    else if (c === "\n" || c === "\r") this.newline();
    else if (c !== undefined) this.fail(`unexpected \`${c}\` after the value`);
  }

  // -- values --------------------------------------------------------------------------

  private value(): unknown {
    const c = this.text[this.i];
    if (c === '"') {
      if (this.text.startsWith('"""', this.i)) this.fail('multi-line strings (""" or \'\'\') are not supported in project.toml');
      return this.basicString();
    }
    if (c === "'") {
      if (this.text.startsWith("'''", this.i)) this.fail('multi-line strings (""" or \'\'\') are not supported in project.toml');
      return this.literalString();
    }
    if (c === "[") return this.array();
    if (c === "{") this.fail("inline tables ({ … }) are not supported in project.toml: use a [table] header");
    if (this.word("true")) return true;
    if (this.word("false")) return false;
    const ahead = this.text.slice(this.i, this.i + 4);
    if (/^[+-]?(inf|nan)/.test(ahead)) this.fail("floats are not supported in project.toml");
    if (/^[+-]?[0-9]/.test(ahead)) return this.integer();
    this.fail("expected a value (a string, number, boolean or array)");
  }

  private integer(): number {
    const at = this.i;
    const negative = this.eat("-");
    if (!negative) this.eat("+");
    if (/^0[xob]/.test(this.text.slice(this.i, this.i + 2))) this.fail("hex, octal and binary numbers are not supported in project.toml", at);
    const digits = this.match(DIGITS)!;
    const next = this.text[this.i];
    if (next && ".eE".includes(next)) this.fail("floats are not supported in project.toml", at);
    if (next && "-:T".includes(next)) this.fail("dates and times are not supported in project.toml", at);
    const n = Number(digits.replace(/_/g, ""));
    return negative ? -n : n;
  }

  /** `"…"` with the escapes `\\ \" \b \f \n \r \t \uXXXX \UXXXXXXXX`; never spans a line. */
  private basicString(): string {
    this.i++;
    let out = "";
    while (true) {
      const c = this.text[this.i];
      if (c === undefined || c === "\n" || c === "\r") this.fail("unterminated string");
      this.i++;
      if (c === '"') return out;
      if (c !== "\\") {
        out += c;
        continue;
      }
      const e = this.text[this.i++];
      if (e !== undefined && e in ESCAPES) {
        out += ESCAPES[e];
      } else if (e === "u" || e === "U") {
        const len = e === "u" ? 4 : 8;
        const hex = this.text.slice(this.i, this.i + len);
        if (!/^[0-9A-Fa-f]+$/.test(hex) || hex.length !== len) this.fail(`invalid escape \`\\${e}${hex}\` in string`, this.i - 2);
        out += String.fromCodePoint(parseInt(hex, 16));
        this.i += len;
      } else {
        this.fail(`invalid escape \`\\${e ?? ""}\` in string`, this.i - 2);
      }
    }
  }

  /** `'…'`: no escapes at all; never spans a line. */
  private literalString(): string {
    this.i++;
    const end = this.text.indexOf("'", this.i);
    const line = this.text.indexOf("\n", this.i);
    if (end === -1 || (line !== -1 && line < end)) this.fail("unterminated string");
    const out = this.text.slice(this.i, end);
    this.i = end + 1;
    return out;
  }

  /** `[ v, v, ]` over any number of lines, comments allowed between items. */
  private array(): unknown[] {
    const at = this.i;
    this.i++;
    const items: unknown[] = [];
    while (true) {
      this.skipBlank();
      if (this.i >= this.text.length) this.fail("unterminated array: expected `]`", at);
      if (this.eat("]")) return items;
      items.push(this.value());
      this.skipBlank();
      if (this.eat(",")) continue;
      if (this.eat("]")) return items;
      this.fail("expected `,` or `]` in array");
    }
  }

  // -- lexing helpers --------------------------------------------------------------------

  private skipSpaces(): void {
    this.match(SPACES);
  }

  /** Spaces, newlines and comments: what may sit between the items of an array. */
  private skipBlank(): void {
    while (true) {
      this.skipSpaces();
      const c = this.text[this.i];
      if (c === "\n" || c === "\r") this.newline();
      else if (c === "#") this.skipComment();
      else return;
    }
  }

  private skipComment(): void {
    const end = this.text.indexOf("\n", this.i);
    this.i = end === -1 ? this.text.length : end;
  }

  private newline(): void {
    if (this.eat("\r") && this.text[this.i] !== "\n") this.fail("a bare carriage return is not a newline", this.i - 1);
    this.eat("\n");
  }

  private eat(s: string): boolean {
    if (!this.text.startsWith(s, this.i)) return false;
    this.i += s.length;
    return true;
  }

  /** `true` / `false`, only when not the start of a longer word. */
  private word(w: string): boolean {
    if (!this.text.startsWith(w, this.i) || /[A-Za-z0-9_-]/.test(this.text[this.i + w.length] ?? "")) return false;
    this.i += w.length;
    return true;
  }

  private match(re: RegExp): string | undefined {
    re.lastIndex = this.i;
    const m = re.exec(this.text);
    if (!m || m[0] === "") return undefined;
    this.i += m[0].length;
    return m[0];
  }

  private fail(message: string, at = this.i): never {
    const before = this.text.slice(0, at);
    const line = (before.match(/\n/g)?.length ?? 0) + 1;
    const column = at - before.lastIndexOf("\n");
    throw new TomlError(message, line, column);
  }
}
