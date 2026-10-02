/**
 * Delta's own syntax highlighter for `<code lang>`: a handful of hand-written grammars,
 * enough for what a paper or Delta's own documentation shows, and no dependency.
 *
 * A grammar is an ordered list of rules. At each position the first rule whose (sticky)
 * regex matches wins and its match becomes one token, wrapped in `<span class="tok-…">`;
 * when no rule matches, one character of plain text goes through. A rule may instead hand
 * its match to a sub-grammar (an XML tag is split into its name, attributes and values that
 * way). Everything is HTML-escaped, so stripping the spans gives back `escapeHtml(source)`
 * exactly; test/highlight.test.ts checks that for every language.
 *
 * Token kinds (components/code.css colours them): comment, string, number, keyword,
 * name (what is being defined or called), builtin, tag, attr. Adding a language is one
 * entry in GRAMMARS; adding an alias one entry in ALIASES.
 */

import { escapeHtml } from "./preprocess";

export type Token = "comment" | "string" | "number" | "keyword" | "name" | "builtin" | "tag" | "attr";

interface Rule {
  /** The regex must be sticky (`y`). */
  re: RegExp;
  /** The token kind, or null for text that is consumed whole but left plain (identifiers). */
  cls?: Token | null;
  /** Tokenize the match with this grammar instead of wrapping it. */
  sub?: Rule[];
}

/** Highlights `source` as `lang` (a language name or alias); undefined when the language is unknown. */
export function highlight(source: string, lang: string): string | undefined {
  const name = lang.toLowerCase();
  const grammar = GRAMMARS[ALIASES[name] ?? name];
  return grammar && tokenize(source, grammar);
}

function tokenize(source: string, grammar: Rule[]): string {
  let out = "";
  let plain = "";
  let i = 0;
  scan: while (i < source.length) {
    for (const rule of grammar) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(source);
      if (!m || m[0].length === 0) continue;
      out += escapeHtml(plain);
      plain = "";
      const text = m[0];
      if (rule.sub) out += tokenize(text, rule.sub);
      else if (rule.cls) out += `<span class="tok-${rule.cls}">${escapeHtml(text)}</span>`;
      else out += escapeHtml(text);
      i += text.length;
      continue scan;
    }
    plain += source[i++];
  }
  return out + escapeHtml(plain);
}

// -- shared pieces ------------------------------------------------------------------------

/** A keyword rule: the words, whole only. */
const words = (cls: Token, list: string): Rule => ({ cls, re: new RegExp(`\\b(?:${list.trim().split(/\s+/).join("|")})\\b`, "y") });
const IDENT: Rule = { cls: null, re: /[A-Za-z_$][\w$]*/y };
/** `name(`: a call or a definition. Comes after the keyword rules, so `if (` is not a name. */
const CALL: Rule = { cls: "name", re: /[A-Za-z_$][\w$]*(?=\s*\()/y };
const DECIMAL = /\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?\b/y;
const QUOTED = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y;

/** `<name attr="value">`, `</name>`, `<?xml …?>`: split into tag, attributes and strings. */
const TAG_PARTS: Rule[] = [
  { cls: "tag", re: /<\/?[A-Za-z_:][\w:.-]*|<[?!][A-Za-z]*|\?>|\/>|>/y },
  { cls: "string", re: /"[^"]*"|'[^']*'/y },
  { cls: "attr", re: /[A-Za-z_:][\w:.-]*(?=\s*=)/y },
];

const GRAMMARS: Record<string, Rule[]> = {
  xml: [
    { cls: "comment", re: /<!--[\s\S]*?-->/y },
    { cls: "string", re: /<!\[CDATA\[[\s\S]*?\]\]>/y },
    { re: /<[?!]?\/?[A-Za-z_:][\w:.-]*(?:[^>"']|"[^"]*"|'[^']*')*>?/y, sub: TAG_PARTS },
    { cls: "builtin", re: /&#?\w+;/y },
  ],

  bash: [
    { cls: "comment", re: /(?<=^|\s)#.*/y },
    { cls: "string", re: /"(?:[^"\\]|\\[\s\S])*"|'[^']*'/y },
    words("keyword", "if then else elif fi for in do done while until case esac function return exit export local source"),
    // The command: the first word of a line or of a pipeline segment.
    { cls: "builtin", re: /(?<=(?:^|[\n;|&])[ \t]*)[A-Za-z_][\w./-]*/y },
    { cls: "name", re: /\$(?:\{[^}]*\}|[A-Za-z_]\w*|[0-9@#?*$!])/y },
    IDENT,
  ],

  python: [
    { cls: "comment", re: /#.*/y },
    { cls: "string", re: /[rbfRBF]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/y },
    { cls: "name", re: /@[A-Za-z_][\w.]*/y },
    { re: /\b(?:def|class)\s+[A-Za-z_]\w*/y, sub: [words("keyword", "def class"), { cls: "name", re: /[A-Za-z_]\w*/y }] },
    words(
      "keyword",
      `and as assert async await break class continue def del elif else except finally for from global if import
       in is lambda nonlocal not or pass raise return try while with yield True False None`,
    ),
    words(
      "builtin",
      `print len range int float str bool list dict set tuple enumerate zip map filter sum min max abs round open
       isinstance type sorted reversed any all input super`,
    ),
    { cls: "number", re: /\b0[xob][\da-fA-F_]+\b|\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?j?\b/y },
    CALL,
    IDENT,
  ],

  javascript: [
    { cls: "comment", re: /\/\/.*|\/\*[\s\S]*?\*\//y },
    { cls: "string", re: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\[\s\S])*`/y },
    { re: /\b(?:function|class)\s+[A-Za-z_$][\w$]*/y, sub: [words("keyword", "function class"), { cls: "name", re: /[A-Za-z_$][\w$]*/y }] },
    words(
      "keyword",
      `abstract as async await break case catch class const continue debugger declare default delete do else enum
       export extends false finally for from function if implements import in instanceof interface keyof let
       namespace new null of override private protected public readonly return satisfies static super switch this
       throw true try type typeof undefined var void while with yield`,
    ),
    words(
      "builtin",
      `document window console Math JSON Object Array String Number Boolean Promise Map Set Symbol Error Date RegExp
       customElements HTMLElement Delta`,
    ),
    { cls: "number", re: /\b0[xob][\da-fA-F_]+n?\b|\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?n?\b/y },
    CALL,
    IDENT,
  ],

  css: [
    { cls: "comment", re: /\/\*[\s\S]*?\*\//y },
    { cls: "string", re: QUOTED },
    { cls: "keyword", re: /@[A-Za-z-]+|!important\b/y },
    { cls: "attr", re: /-{0,2}[A-Za-z][\w-]*(?=\s*:)/y },
    { cls: "number", re: /#[0-9a-fA-F]{3,8}\b|(?:\b\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|ch|vw|vh|%|s|ms|deg|fr)?(?![\w.])/y },
    { cls: "name", re: /[A-Za-z-]+(?=\()/y },
    IDENT,
  ],

  toml: [
    { cls: "comment", re: /#.*/y },
    { cls: "string", re: QUOTED },
    { cls: "name", re: /(?<=^|\n)[ \t]*\[[^\]\n]*\]/y },
    { cls: "attr", re: /[A-Za-z0-9_-]+(?=\s*=)/y },
    words("keyword", "true false"),
    { cls: "number", re: DECIMAL },
    IDENT,
  ],

  text: [],
};

/** The languages `highlight` knows, for the documentation. */
export const LANGUAGES: readonly string[] = Object.keys(GRAMMARS);

const ALIASES: Record<string, string> = {
  html: "xml",
  dlt: "xml",
  svg: "xml",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  py: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "javascript",
  typescript: "javascript",
  txt: "text",
  plain: "text",
  plaintext: "text",
};
