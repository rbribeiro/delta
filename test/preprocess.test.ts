import { describe, expect, it } from "vitest";
import { preprocess } from "../src/compiler/preprocess";

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
