import { describe, expect, it } from "vitest";
import { createContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";

function compile(src: string) {
  const ctx = createContext("test.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

const doc = (body: string) =>
  `<document lang="en"><title>T</title><section id="s"><title>S</title>${body}</section></document>`;

// Count <br> only inside the section body (the runtime/CSS shipped in <head>/<script> never has any).
const countBr = (html: string) => (html.match(/<br>/g) ?? []).length;

describe("linebreaks", () => {
  it("turns a blank line between prose into one <br>", () => {
    const { html } = compile(doc(`First paragraph.\n\nSecond paragraph.`));
    expect(html).toContain("First paragraph.<br>");
    expect(countBr(html)).toBe(1);
  });

  it("leaves a single newline (soft wrap) as collapsible whitespace, no <br>", () => {
    const { html } = compile(doc(`A sentence wrapped\nacross two lines.`));
    expect(countBr(html)).toBe(0);
    expect(html).toContain("A sentence wrapped\nacross two lines.");
  });

  it("collapses several blank lines into a single <br>", () => {
    const { html } = compile(doc(`First.\n\n\n\nSecond.`));
    expect(countBr(html)).toBe(1);
  });

  it("does not emit a break at the start or end of a text node", () => {
    const { html } = compile(doc(`\n\n  Only paragraph.  \n\n`));
    expect(countBr(html)).toBe(0);
  });

  it("does not touch blank lines inside <code> or inline <c>", () => {
    const codeBlock = compile(doc(`<code>a\n\nb</code>`));
    expect(countBr(codeBlock.html)).toBe(0);
    const inlineCode = compile(doc(`<c>a\n\nb</c>`));
    expect(countBr(inlineCode.html)).toBe(0);
  });

  it("inserts a break after an inline element when a blank line follows", () => {
    const { html } = compile(doc(`Lead <em>x</em>.\n\nNext paragraph.`));
    expect(countBr(html)).toBe(1);
    expect(html).toContain("</delta-em>.<br>Next paragraph.");
  });
});
