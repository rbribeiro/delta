import { describe, expect, it } from "vitest";
import { textContent, type ElementNode } from "../src/compiler/ast";
import { createContext } from "../src/compiler/context";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";

function parseSource(src: string) {
  const ctx = createContext("test.dlt");
  return { doc: parse(src, ctx), ctx };
}

function firstElement(el: ElementNode | null, tag: string): ElementNode | undefined {
  return el?.children.find((c): c is ElementNode => c.type === "element" && c.tag === tag);
}

describe("parse", () => {
  it("builds a generic element tree with attributes", () => {
    const { doc } = parseSource('<document lang="en"><section id="s">hi</section></document>');
    expect(doc?.tag).toBe("document");
    expect(doc?.attrs.lang).toBe("en");
    const section = firstElement(doc, "section");
    expect(section?.attrs.id).toBe("s");
    expect(textContent(section!)).toBe("hi");
  });

  it("records source positions on elements", () => {
    const { doc } = parseSource("<document>\n  <section/>\n</document>");
    const section = firstElement(doc, "section");
    expect(section?.pos?.line).toBe(2);
  });

  it("reports malformed XML as an error diagnostic and returns null", () => {
    const { doc, ctx } = parseSource("<document><oops</document>");
    expect(doc).toBeNull();
    expect(ctx.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("rejects valueless attributes (strict XML)", () => {
    const { doc, ctx } = parseSource("<document><exercise collapsible/></document>");
    expect(doc).toBeNull();
    expect(ctx.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("round-trips math content through preprocess + parse", () => {
    const { doc } = parseSource(preprocess("<document><m>a < b & c</m></document>"));
    const m = firstElement(doc, "m");
    expect(textContent(m!)).toBe("a < b & c");
  });
});
