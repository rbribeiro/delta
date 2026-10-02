import { describe, expect, it } from "vitest";
import { createContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { findMathEnd, preprocess, preprocessMapped } from "../src/compiler/preprocess";

describe("preprocess", () => {
  it("escapes <, > and & inside inline math", () => {
    expect(preprocess("Let $a < b & c > d$ hold.")).toBe(
      "Let $a &lt; b &amp; c &gt; d$ hold.",
    );
  });

  it("escapes inside display math", () => {
    expect(preprocess("$$x < y$$")).toBe("$$x &lt; y$$");
  });

  it("escapes inside raw tags but leaves the tags themselves intact", () => {
    expect(preprocess('<equation id="e">a < b & c</equation>')).toBe(
      '<equation id="e">a &lt; b &amp; c</equation>',
    );
  });

  it("leaves markup outside math regions untouched", () => {
    const src = '<section id="s"><title>Hi</title>text</section>';
    expect(preprocess(src)).toBe(src);
  });

  it("treats \\$ as a literal dollar, not a math delimiter", () => {
    expect(preprocess("costs \\$5, and $a<b$")).toBe("costs \\$5, and $a&lt;b$");
  });

  it("does not treat dollars inside tag markup as math", () => {
    expect(preprocess('<x label="$5"></x> $a<b$')).toBe('<x label="$5"></x> $a&lt;b$');
  });

  it("does not open math inside raw tag content", () => {
    expect(preprocess("<code>$not < math$</code>")).toBe("<code>$not &lt; math$</code>");
  });

  it("copies comments verbatim", () => {
    expect(preprocess("<!-- a < b -->")).toBe("<!-- a < b -->");
  });

  it("keeps a quoted > inside attribute values from ending the tag scan", () => {
    const src = '<x label="a > b">t</x>';
    expect(preprocess(src)).toBe(src);
  });
});

describe("a forgotten \\$", () => {
  const at = (src: string) => preprocessMapped(src).problems.map((p) => p.at);

  it("is reported at the dollar when no closer comes before a blank line", () => {
    expect(at("costs $5\n\nmore $x$")).toEqual([6]);
    expect(at("$a\nb$")).toEqual([]); // one line break is fine
  });

  it("is reported when the would-be math crosses a closing tag, and the markup survives", () => {
    const src = "<p>$5 for <b>one</b>, $10 for two</p>";
    const { problems, text } = preprocessMapped(src);
    expect(problems.map((p) => p.at)).toEqual([3, 22]);
    expect(text).toBe(src);
  });

  it("closes math after an escaped backslash, as the math pass does", () => {
    const { problems, text } = preprocessMapped("<p>$a \\\\$ then <b>x</b> and $c$.</p>");
    expect(problems).toEqual([]);
    expect(text).toContain("<b>x</b>");
  });

  it("agrees with the math pass on where a formula ends", () => {
    expect(findMathEnd("a \\$ b$ c", 0, "$")).toBe(6);
    expect(findMathEnd("a \\\\$ b", 0, "$")).toBe(4);
  });

  it("is a compile error with its line and column", () => {
    const ctx = createContext("t.dlt");
    compileSource("<document>\n<p>Price $5 for <b>bold</b>.</p>\n</document>", ctx);
    const err = ctx.diagnostics.find((d) => d.severity === "error");
    expect(err?.message).toBe("unmatched $: write \\$ for a literal dollar");
    expect(err?.pos).toMatchObject({ line: 2, column: 10 });
  });
});
