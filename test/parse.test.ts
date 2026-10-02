import { describe, expect, it } from "vitest";
import { textContent, type ElementNode } from "../src/compiler/ast";
import { createContext, type Diagnostic } from "../src/compiler/context";
import { parse, parseSource } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";

/** Parses `src` as already-preprocessed text. */
function run(src: string) {
  const ctx = createContext("test.dlt");
  return { doc: parse(src, ctx), ctx };
}

/** Preprocesses and parses, as the compiler does: spans and positions are in `src`'s coordinates. */
function runSource(src: string) {
  const ctx = createContext("test.dlt");
  return { doc: parseSource(src, ctx), ctx };
}

function firstElement(el: ElementNode | null, tag: string): ElementNode | undefined {
  return el?.children.find((c): c is ElementNode => c.type === "element" && c.tag === tag);
}

const errors = (ctx: { diagnostics: Diagnostic[] }) => ctx.diagnostics.filter((d) => d.severity === "error");

describe("parse", () => {
  it("builds a generic element tree with attributes", () => {
    const { doc } = run('<document lang="en"><section id="s">hi</section></document>');
    expect(doc?.tag).toBe("document");
    expect(doc?.attrs.lang).toBe("en");
    const section = firstElement(doc, "section");
    expect(section?.attrs.id).toBe("s");
    expect(textContent(section!)).toBe("hi");
  });

  it("records the position of each element's opening `<`", () => {
    const { doc } = run("<document>\n  <section/>\n</document>");
    const section = firstElement(doc, "section");
    expect(section?.pos).toEqual({ line: 2, column: 3, file: "test.dlt" });
  });

  it("records source spans, also for a tag that spans several lines", () => {
    const src = '<document>\n  <section\n    id="s"\n  >body</section>\n</document>';
    const { doc } = run(src);
    const s = firstElement(doc, "section")!.src!;
    expect(src.slice(s.start, s.end)).toBe('<section\n    id="s"\n  >body</section>');
    expect(src.slice(s.inner, s.innerEnd)).toBe("body");
    const d = doc!.src!;
    expect(src.slice(d.start, d.end)).toBe(src);
    expect(firstElement(doc, "section")!.pos?.line).toBe(2);
  });

  it("gives a self-closing tag an empty inner span", () => {
    const src = "<document><figure src='x.png'/></document>";
    const { doc } = run(src);
    const f = firstElement(doc, "figure")!;
    expect(f.attrs.src).toBe("x.png"); // single quotes are fine
    expect(f.src!.inner).toBe(f.src!.innerEnd);
    expect(src.slice(f.src!.start, f.src!.end)).toBe("<figure src='x.png'/>");
  });

  it("round-trips math content through preprocess + parse", () => {
    const { doc } = run(preprocess("<document><m>a < b & c</m></document>"));
    const m = firstElement(doc, "m");
    expect(textContent(m!)).toBe("a < b & c");
  });

  it("decodes the five entities and numeric references, in text and in attribute values", () => {
    const { doc } = run('<document t="&lt;x&gt; &amp; &quot;&apos;">&#65;&#x42; &lt;&amp;&gt;</document>');
    expect(doc!.attrs.t).toBe(`<x> & "'`);
    expect(textContent(doc!)).toBe("AB <&>");
  });

  it("merges CDATA with the text around it, and drops comments", () => {
    const { doc } = run("<document>a <!-- note --><![CDATA[<b> & ]]>c</document>");
    expect(doc!.children).toHaveLength(1);
    expect(textContent(doc!)).toBe("a <b> & c");
  });

  it("accepts an XML declaration at the very start, and whitespace around the root", () => {
    const { doc, ctx } = run('<?xml version="1.0" encoding="UTF-8"?>\n\n<document/>\n');
    expect(doc?.tag).toBe("document");
    expect(ctx.diagnostics).toEqual([]);
  });

  it("normalises CRLF in text and turns line breaks inside an attribute value into spaces", () => {
    const { doc } = run('<document a="x\r\ny">one\r\ntwo\rthree</document>');
    expect(textContent(doc!)).toBe("one\ntwo\nthree");
    expect(doc!.attrs.a).toBe("x  y");
  });
});

describe("parse: errors", () => {
  const cases: [string, string, RegExp, number, number][] = [
    ["a bare `<` in text", "<document>a < b</document>", /expected `>` to end <document>, found `<`|expected a tag name/, 1, 13],
    ["a bare `&` in text", "<document>a & b</document>", /bare `&`: write &amp;/, 1, 13],
    ["an unknown entity", "<document>&nbsp;</document>", /unknown entity &nbsp;/, 1, 11],
    ["an unclosed tag at the end of the file", "<document><p>unclosed", /unclosed <p>: reached the end/, 1, 11],
    ["a tag closed by its parent's closing tag", "<document><p>x</document>", /unclosed <p>: found <\/document> first/, 1, 11],
    ["a closing tag with nothing open", "<document></p></document>", /unexpected <\/p>: no <p> is open/, 1, 11],
    ["a tag without `>`", "<document><oops</document>", /expected `>` to end <oops>, found `<`/, 1, 16],
    ["a valueless attribute", "<document><exercise collapsible/></document>", /attribute `collapsible` needs a value/, 1, 21],
    ["an unquoted attribute value", "<document><p id=x/></document>", /the value of `id` must be quoted/, 1, 17],
    ["a duplicate attribute", '<document><p id="a" id="b"/></document>', /duplicate attribute `id` in <p>/, 1, 21],
    ["attributes without whitespace between them", '<document><p id="a"class="b"/></document>', /whitespace required between attributes/, 1, 20],
    ["a `<` inside an attribute value", '<document><p id="a<b"/></document>', /`<` is not allowed in an attribute value/, 1, 19],
    ["text before the root", "x<document/>", /text outside the root element/, 1, 1],
    ["a second root", "<document/><document/>", /only one root element is allowed; found a second <document>/, 1, 12],
    ["`--` inside a comment", "<document><!-- a -- b --></document>", /`--` is not allowed inside a comment/, 1, 18],
    ["`]]>` in text", "<document>a ]]> b</document>", /`\]\]>` is not allowed in text/, 1, 13],
    ["an XML declaration after the start", '<document><?xml version="1.0"?></document>', /must be at the very start/, 1, 11],
    ["a processing instruction", "<document><?php echo 1 ?></document>", /processing instructions are not supported/, 1, 11],
    ["a DOCTYPE", "<!DOCTYPE html>\n<document/>", /DOCTYPE/, 1, 1],
  ];
  for (const [what, src, message, line, column] of cases) {
    it(`reports ${what}, and returns null`, () => {
      const { doc, ctx } = run(src);
      expect(doc).toBeNull();
      const first = errors(ctx)[0];
      expect(first?.message).toMatch(message);
      expect([first?.pos?.line, first?.pos?.column]).toEqual([line, column]);
    });
  }

  it("reports every error, not only the first", () => {
    const { ctx } = run("<document>&nbsp; and &copy;</document>");
    expect(errors(ctx).map((d) => d.pos?.column)).toEqual([11, 22]);
  });

  it("reports an empty file as having no root", () => {
    const { doc, ctx } = run("  <!-- nothing here -->  ");
    expect(doc).toBeNull();
    expect(errors(ctx)[0]?.message).toMatch(/no root element/);
  });
});

describe("parseSource: positions in the author's coordinates", () => {
  it("maps spans back through the escaping of math and raw tags", () => {
    const src = "<document><m>a<b</m><p>x</p></document>";
    const { doc, ctx } = runSource(src);
    expect(ctx.diagnostics).toEqual([]);
    const m = firstElement(doc, "m")!.src!;
    const p = firstElement(doc, "p")!.src!;
    expect(src.slice(m.inner, m.innerEnd)).toBe("a<b");
    expect(m.innerEnd).toBe(src.indexOf("</m>"));
    expect(p.start).toBe(src.indexOf("<p>"));
    expect(src.slice(p.start, p.end)).toBe("<p>x</p>");
  });

  it("reports an error column as the author sees it, even after escaped math on the same line", () => {
    const src = "<document>$a<b$ and & more</document>";
    const { doc, ctx } = runSource(src);
    expect(doc).toBeNull();
    expect(errors(ctx)[0]?.pos).toEqual({ line: 1, column: src.indexOf("&") + 1, file: "test.dlt" });
  });

  it("positions a forgotten \\$ at the dollar itself", () => {
    const src = "<document>\n  costs $5 today\n\n</document>";
    const { ctx } = runSource(src);
    expect(ctx.diagnostics[0]?.pos).toEqual({ line: 2, column: 9, file: "test.dlt" });
  });
});
