import { describe, expect, it } from "vitest";
import { elements, type ElementNode } from "../src/compiler/ast";
import { createContext, type CompileContext } from "../src/compiler/context";
import { numberDocument } from "../src/compiler/numbering";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";

function numbered(src: string): { doc: ElementNode; ctx: CompileContext } {
  const ctx = createContext("test.dlt");
  const doc = parse(preprocess(src), ctx);
  if (!doc) throw new Error("parse failed: " + JSON.stringify(ctx.diagnostics));
  numberDocument(doc, ctx);
  return { doc, ctx };
}

function numOf(doc: ElementNode, id: string): string | undefined {
  for (const el of elements(doc)) if (el.attrs.id === id) return el.attrs.num;
  return undefined;
}

describe("numbering", () => {
  it("prefixes the theorem family with the section and resets across sections", () => {
    const { doc } = numbered(
      `<document>
        <section id="s1"><theorem id="a"/><lemma id="b"/></section>
        <section id="s2"><theorem id="c"/></section>
      </document>`,
    );
    expect(numOf(doc, "s1")).toBe("1");
    expect(numOf(doc, "a")).toBe("1.1");
    expect(numOf(doc, "b")).toBe("1.1"); 
    expect(numOf(doc, "s2")).toBe("2");
    expect(numOf(doc, "c")).toBe("2.1");
  });

  it("numbers subsubsections three levels deep and resets them per (sub)section", () => {
    const { doc } = numbered(
      `<document>
        <section id="s1">
          <subsection id="ss1"><subsubsection id="t1"/><subsubsection id="t2"/></subsection>
          <subsection id="ss2"><subsubsection id="t3"/></subsection>
        </section>
        <section id="s2"><subsection id="ss3"><subsubsection id="t4"/></subsection></section>
      </document>`,
    );
    expect(numOf(doc, "t1")).toBe("1.1.1");
    expect(numOf(doc, "t2")).toBe("1.1.2");
    expect(numOf(doc, "t3")).toBe("1.2.1"); // resets when the subsection changes
    expect(numOf(doc, "t4")).toBe("2.1.1"); // resets when the section changes
  });

  it("counts example/claim/observation in the shared theorem family", () => {
    const { doc } = numbered(
      `<document><section id="s">
        <theorem id="a"/><example id="b"/><claim id="c"/><observation id="d"/>
      </section></document>`,
    );
    expect(numOf(doc, "a")).toBe("1.1");
    expect(numOf(doc, "b")).toBe("1.1");
    expect(numOf(doc, "c")).toBe("1.1");
    expect(numOf(doc, "d")).toBe("1.1");
  });

  it("numbers media: video & youtube share a counter; figure and audio are separate", () => {
    const { doc } = numbered(
      `<document><section id="s">
        <figure id="f"/><video id="v"/><youtube id="y"/><audio id="a"/>
      </section></document>`,
    );
    expect(numOf(doc, "f")).toBe("1.1"); // figure counter
    expect(numOf(doc, "v")).toBe("1.1"); // video counter
    expect(numOf(doc, "y")).toBe("1.2"); // youtube shares the video counter
    expect(numOf(doc, "a")).toBe("1.1"); // audio has its own counter
  });

  it("numbers without a prefix when no section is open", () => {
    const { doc } = numbered(`<document><theorem id="a"/></document>`);
    expect(numOf(doc, "a")).toBe("1");
  });

  it("respects an explicit num and continues counting from it", () => {
    const { doc } = numbered(
      `<document><theorem id="a" num="5"/><theorem id="b"/></document>`,
    );
    expect(numOf(doc, "a")).toBe("5");
    expect(numOf(doc, "b")).toBe("6");
  });

  it("resets equation counters per section", () => {
    const { doc } = numbered(
      `<document>
        <section id="s1"><equation id="e1">x</equation></section>
        <section id="s2"><equation id="e2">y</equation></section>
      </document>`,
    );
    expect(numOf(doc, "e1")).toBe("1.1");
    expect(numOf(doc, "e2")).toBe("2.1");
  });

  it("records every id in the registry for the reference pass", () => {
    const { ctx } = numbered(
      `<document><section id="s"><theorem id="t"/></section></document>`,
    );
    expect(ctx.registry.get("t")).toEqual({ tag: "theorem", num: "1.1" });
    expect(ctx.registry.get("s")).toEqual({ tag: "section", num: "1" });
  });

  it("warns on duplicate ids", () => {
    const { ctx } = numbered(`<document><theorem id="x"/><lemma id="x"/></document>`);
    expect(ctx.diagnostics.some((d) => d.severity === "warning" && d.message.includes("x"))).toBe(
      true,
    );
  });

  it("does not number elements with numbered=false", () => {
    const { doc } = numbered(`<document><theorem id="a" numbered="false"/></document>`);
    expect(numOf(doc, "a")).toBeUndefined();
  });
});
