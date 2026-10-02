import { describe, expect, it } from "vitest";
import { highlight, LANGUAGES } from "../src/compiler/highlight";
import { escapeHtml } from "../src/compiler/preprocess";

/** The spans as `[kind, text]` pairs, in order. */
function tokens(html: string): [string, string][] {
  return [...html.matchAll(/<span class="tok-(\w+)">(.*?)<\/span>/gs)].map((m) => [m[1], m[2]]);
}

const SAMPLES: Record<string, string> = {
  xml: `<!-- a note -->\n<theorem id="t" status='open'>If $x < 1$ &amp; more</theorem>\n<figure src="a.png"/>`,
  bash: `# build it\nnpm install && delta build "$FILE" -o out.html\nfor f in *.dlt; do echo $f; done`,
  python: `@cache\ndef fib(n):\n    """Doc."""\n    return 1 if n < 2 else fib(n - 1) + fib(n - 2)  # slow\nprint(fib(10), 0x1f)`,
  javascript: `// comment\nconst t = Delta.t("hint", \`x\${1}\`);\nfunction go(n) { return n * 2.5 + 0b10; }\nclass A extends B {}`,
  css: `/* tokens */\n@layer delta.base;\n:root { --delta-accent: #7c3aed; width: calc(100% - 2rem) !important; }`,
  toml: `# project\ninputs = ["a.dlt", "b.dlt"]\n[document]\nlang = "pt-BR"  # idioma\nflag = true\nn = 12`,
  text: `nothing <here> & there`,
};

describe("highlight", () => {
  it("knows exactly these languages", () => {
    expect(LANGUAGES).toEqual(["xml", "bash", "python", "javascript", "css", "toml", "text"]);
  });

  it("returns undefined for an unknown language", () => {
    expect(highlight("x", "klingon")).toBeUndefined();
  });

  it("never changes the text: stripping the spans gives the escaped source", () => {
    for (const [lang, source] of Object.entries(SAMPLES)) {
      const html = highlight(source, lang)!;
      expect(html.replace(/<span class="tok-\w+">|<\/span>/g, ""), lang).toBe(escapeHtml(source));
      expect(html, lang).not.toMatch(/<(?!\/?span)/); // every `<` of the source is escaped
    }
  });

  it("resolves aliases, case-insensitively", () => {
    expect(highlight("x", "DLT")).toBe(highlight("x", "xml"));
    expect(tokens(highlight("print(1)", "py")!)[0]).toEqual(["builtin", "print"]);
    expect(tokens(highlight("const x = 1", "ts")!)[0]).toEqual(["keyword", "const"]);
    expect(tokens(highlight("echo hi", "sh")!)[0]).toEqual(["builtin", "echo"]);
  });

  it("xml: comments, tag names, attributes, quoted values, entities", () => {
    expect(tokens(highlight(SAMPLES.xml, "xml")!)).toEqual([
      ["comment", "&lt;!-- a note --&gt;"],
      ["tag", "&lt;theorem"],
      ["attr", "id"],
      ["string", '"t"'],
      ["attr", "status"],
      ["string", "'open'"],
      ["tag", "&gt;"],
      ["builtin", "&amp;amp;"],
      ["tag", "&lt;/theorem"],
      ["tag", "&gt;"],
      ["tag", "&lt;figure"],
      ["attr", "src"],
      ["string", '"a.png"'],
      ["tag", "/&gt;"],
    ]);
  });

  it("bash: comments, the command of each segment, strings, variables, keywords", () => {
    const t = tokens(highlight(SAMPLES.bash, "bash")!);
    expect(t.slice(0, 5)).toEqual([
      ["comment", "# build it"],
      ["builtin", "npm"],
      ["builtin", "delta"],
      ["string", '"$FILE"'],
      ["keyword", "for"],
    ]);
    expect(t).toContainEqual(["name", "$f"]);
    expect(t).toContainEqual(["keyword", "done"]);
  });

  it("python: decorators, def names, strings, keywords, builtins, numbers, calls, comments", () => {
    const t = tokens(highlight(SAMPLES.python, "python")!);
    expect(t.slice(0, 4)).toEqual([
      ["name", "@cache"],
      ["keyword", "def"],
      ["name", "fib"],
      ["string", '"""Doc."""'],
    ]);
    expect(t).toContainEqual(["keyword", "return"]);
    expect(t).toContainEqual(["name", "fib"]);
    expect(t).toContainEqual(["comment", "# slow"]);
    expect(t).toContainEqual(["builtin", "print"]);
    expect(t).toContainEqual(["number", "0x1f"]);
  });

  it("javascript: comments, keywords, builtins, template strings, numbers, function and class names", () => {
    const t = tokens(highlight(SAMPLES.javascript, "javascript")!);
    expect(t).toContainEqual(["comment", "// comment"]);
    expect(t).toContainEqual(["builtin", "Delta"]);
    expect(t).toContainEqual(["string", '"hint"']);
    expect(t).toContainEqual(["string", "`x${1}`"]);
    expect(t).toContainEqual(["name", "go"]);
    expect(t).toContainEqual(["number", "2.5"]);
    expect(t).toContainEqual(["number", "0b10"]);
    expect(t).toContainEqual(["name", "A"]);
    expect(t).toContainEqual(["keyword", "extends"]);
    expect(t).not.toContainEqual(["name", "n"]);
  });

  it("css: comments, at-rules, properties, colours, lengths, functions, !important", () => {
    const t = tokens(highlight(SAMPLES.css, "css")!);
    expect(t).toContainEqual(["comment", "/* tokens */"]);
    expect(t).toContainEqual(["keyword", "@layer"]);
    expect(t).toContainEqual(["attr", "--delta-accent"]);
    expect(t).toContainEqual(["number", "#7c3aed"]);
    expect(t).toContainEqual(["name", "calc"]);
    expect(t).toContainEqual(["number", "100%"]);
    expect(t).toContainEqual(["number", "2rem"]);
    expect(t).toContainEqual(["keyword", "!important"]);
  });

  it("toml: comments, table headers, keys, strings, booleans, numbers", () => {
    expect(tokens(highlight(SAMPLES.toml, "toml")!)).toEqual([
      ["comment", "# project"],
      ["attr", "inputs"],
      ["string", '"a.dlt"'],
      ["string", '"b.dlt"'],
      ["name", "[document]"],
      ["attr", "lang"],
      ["string", '"pt-BR"'],
      ["comment", "# idioma"],
      ["attr", "flag"],
      ["keyword", "true"],
      ["attr", "n"],
      ["number", "12"],
    ]);
  });

  it("text: no tokens at all", () => {
    expect(highlight(SAMPLES.text, "text")).toBe(escapeHtml(SAMPLES.text));
  });

  it("does not see a keyword inside an identifier", () => {
    expect(tokens(highlight("const xif = notif(iffy)", "javascript")!)).toEqual([
      ["keyword", "const"],
      ["name", "notif"],
    ]);
  });
});
