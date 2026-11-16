import katex from "katex";
import { describe, expect, it } from "./harness.ts";
import { MATH_MACROS } from "../src/language/tags.ts";
import { compile, warnings } from "./helpers.ts";

const BOARD = `<document lang="en">
  <section id="s"><title>S</title>
    <animation id="a">
      <caption>Completing the square.</caption>
      <equation id="e">x^2 + 2x \\pause + \\part{one}{1}</equation>
      <pause/>
      <note target="e" part="one" mark="circle">a unit</note>
      <morph target="e">(x + 1)^2 < 9</morph>
      <pause for="1s"/>
      <hide target="e"/>
    </animation>
  </section>
</document>`;

describe("<animation>", () => {
  const { html } = compile(BOARD);

  it("is numbered like a figure and keeps its caption", () => {
    expect(html).toContain('<delta-animation id="a" num="1.1">');
    expect(html).toContain("<delta-caption>Completing the square.</delta-caption>");
  });

  it("passes its actions through with their attributes: the runtime reads them", () => {
    expect(html).toContain("<delta-pause></delta-pause>");
    expect(html).toContain('<delta-pause for="1s"></delta-pause>');
    expect(html).toContain('<delta-note target="e" part="one" mark="circle">a unit</delta-note>');
    expect(html).toContain('<delta-hide target="e"></delta-hide>');
  });

  it("renders a <morph> as display math, with a bare `<` in its TeX", () => {
    expect(html).toMatch(/<delta-morph target="e"><span class="katex-display">/);
    expect(html).not.toContain("(x + 1)^2 <");
  });

  it("turns \\pause and \\part into inert markers inside the formula", () => {
    expect(html).toContain('<span class="enclosing" data-delta-pause="1"></span>');
    expect(html).toMatch(
      /<span class="enclosing" data-delta-part="one"><span class="mord">1<\/span><\/span>/,
    );
  });

  it("references no external resources (the offline invariant)", () => {
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) expect(m[1]).toMatch(/^["']?data:/);
  });
});

describe("the handwriting face", () => {
  it("ships with a document that has a <note>, and only with it", () => {
    expect(compile(BOARD).html).toContain('@font-face{font-family:"Caveat"');
    const plain = compile(
      `<document><section id="s"><title>S</title><animation>text</animation></section></document>`,
    );
    expect(plain.html).not.toContain('@font-face{font-family:"Caveat"');
  });
});

describe("checkAnimations", () => {
  /** The warnings of a document whose section holds `outside`, then a board holding `inside`. */
  const check = (inside: string, outside = ""): string[] =>
    warnings(
      compile(
        `<document><section id="s"><title>S</title>${outside}<animation>${inside}</animation></section></document>`,
      ).ctx,
    );
  const EQ = `<equation id="e">x + \\part{one}{1}</equation>`;

  it("says nothing about a well-formed board", () => {
    expect(
      check(
        `${EQ}<pause/><note id="n" target="e" part="one" mark="circle" side="top">a unit</note>
         <pause for="1s"/><hide target="n"/><morph target="e" duration="800ms">x + 2</morph>
         <together><show target="n"/><set target="e" a="2"/></together>`,
      ),
    ).toEqual([]);
  });

  it("warns about an action outside a board, which would do nothing", () => {
    expect(check("text", "<pause/>")).toEqual(["<pause> only works inside an <animation>"]);
    expect(check("text", '<hide target="s"/>')).toEqual([
      "<hide> only works inside an <animation>",
    ]);
  });
  it("lets a <note> without a target stand anywhere: it is a handwritten line", () => {
    expect(check("text", "<note>remember this</note>")).toEqual([]);
  });

  it("warns when a target is missing or is not on the same board", () => {
    expect(check(`${EQ}<hide/>`)).toEqual(['<hide> needs a target="id"']);
    expect(check(`${EQ}<hide target="nope"/>`)).toEqual([
      '<hide> targets "nope", which is not on this board',
    ]);
    // "s" exists in the document, but outside the board.
    expect(check(`${EQ}<note target="s">x</note>`)).toEqual([
      '<note> targets "s", which is not on this board',
    ]);
  });

  it("warns about a part its target never names", () => {
    expect(check(`${EQ}<note target="e" part="two">x</note>`)).toEqual([
      '<note> names part "two", but "e" has no \\part{two}{…}',
    ]);
  });
  it("accepts a part named by a <morph> of the target", () => {
    expect(
      check(
        `${EQ}<morph target="e">x + \\part{two}{2}</morph><note target="e" part="two">x</note>`,
      ),
    ).toEqual([]);
  });

  it("warns when a <morph> replaces something that is not a display formula", () => {
    expect(check(`<box id="b">text</box><morph target="b">x</morph>`)).toEqual([
      '<morph> can replace an <equation> or a <math>; "b" is a <box>',
    ]);
  });

  it("warns about values the runtime does not understand", () => {
    expect(check(`${EQ}<note target="e" mark="star" side="up">x</note>`)).toEqual([
      '<note> has unknown mark "star" (expected circle, box, underline, cross, arrow)',
      '<note> has unknown side "up" (expected top, right, bottom, left)',
    ]);
    expect(check(`<equation id="e" enter="pop">x</equation>`)).toEqual([
      '<equation> has unknown enter "pop" (expected write, fade, none)',
    ]);
    expect(check(`${EQ}<pause for="soon"/><hide target="e" duration="fast"/>`)).toEqual([
      '<pause> has an unreadable for "soon" (write 1.5s, 800ms or 2)',
      '<hide> has an unreadable duration "fast" (write 1.5s, 800ms or 2)',
    ]);
  });

  it("warns about a <set> that sets nothing, and a board inside a board", () => {
    expect(check(`${EQ}<set target="e"/>`)).toEqual([
      '<set> sets nothing: give it the attributes to change, as in <set target="p" a="2"/>',
    ]);
    expect(check(`<animation>text</animation>`)).toEqual([
      "<animation> inside an <animation>: a board cannot hold another board",
    ]);
  });
});

/**
 * The runtime hides and shows pieces of a formula in place, so a marker must not move
 * anything: with the marker spans (and KaTeX's per-line `base`/`strut` wrappers, which only
 * record where a line may break) taken out, a marked formula must be the unmarked one, glyph
 * for glyph and space for space. A KaTeX upgrade that breaks this would shift every animated
 * formula, so it fails here first.
 */
describe("\\pause and \\part leave the layout of a formula alone", () => {
  const render = (tex: string): string =>
    katex.renderToString(tex, {
      displayMode: true,
      trust: (c) => c.command === "\\htmlData",
      strict: "ignore",
      macros: { ...MATH_MACROS },
    });

  /** The visual half of KaTeX's output, without marker spans, `base` wrappers and struts. */
  const skeleton = (html: string): string => {
    const visual = html.slice(html.indexOf('<span class="katex-html"'));
    const dropped: boolean[] = [];
    return visual
      .replace(/<span class="strut"[^>]*><\/span>/g, "")
      .replace(/<span([^>]*)>|<\/span>/g, (tag, attrs: string | undefined) => {
        if (attrs === undefined) return dropped.pop() ? "" : tag;
        const drop = /class="(enclosing|base)\b/.test(attrs);
        dropped.push(drop);
        return drop ? "" : tag;
      });
  };

  const cases: [plain: string, marked: string][] = [
    ["a + b = -c", "a \\pause + b = \\pause -c"],
    ["a + b", "a \\part{p}{+ b}"],
    ["x^{a + b}_{i - 1}", "x^{a \\part{p}{+ b}}_{i \\pause - 1}"],
    ["\\frac{a + b}{c - d}", "\\frac{a \\pause + b}{c \\part{q}{- d}}"],
    ["(x + 1)^2", "(x + \\part{one}{1})^2"],
    ["\\sum_{i=1}^n a_i", "\\sum_{i=1}^n \\pause a_i"],
    ["\\left( a + b \\right)", "\\left( a \\pause + b \\right)"],
    [
      "\\begin{aligned}a &= b \\\\ c &= d\\end{aligned}",
      "\\begin{aligned}a \\pause &= b \\\\ \\pause c &= \\part{k}{d}\\end{aligned}",
    ],
  ];
  for (const [plain, marked] of cases) {
    it(marked, () => expect(skeleton(render(marked))).toBe(skeleton(render(plain))));
  }
});
