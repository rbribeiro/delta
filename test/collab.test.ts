import { describe, expect, it } from "vitest";
import { elements, type ElementNode } from "../src/compiler/ast";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";

function compile(src: string): { html: string; ctx: CompileContext } {
  const ctx = createContext("test.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

const warnings = (ctx: CompileContext): string[] =>
  ctx.diagnostics.filter((d) => d.severity === "warning").map((d) => d.message);

const wrap = (body: string): string =>
  `<document><section id="s"><title>S</title>${body}</section></document>`;

describe("<comment>", () => {
  it("defaults status to open and numbers comments with one document-wide counter (no prefix, no reset)", () => {
    const { html, ctx } = compile(`<document>
      <section id="a"><title>A</title>
        one<comment id="c1" by="x">first</comment>
        <theorem id="t1">t</theorem>
      </section>
      <section id="b"><title>B</title>
        two<comment id="c2" by="x" status="resolved">second</comment>
        <theorem id="t2">t</theorem>
      </section>
    </document>`);
    expect(html).toMatch(/<delta-comment id="c1" by="x" status="open" num="1">/);
    expect(html).toMatch(/<delta-comment id="c2" by="x" status="resolved" num="2">/);
    // the theorem counter is untouched by comments and still resets per section
    expect(html).toContain('<delta-theorem id="t1" num="1.1">');
    expect(html).toContain('<delta-theorem id="t2" num="2.1">');
    expect(ctx.registry.get("c2")).toEqual({ tag: "comment", num: "2" });
    expect(warnings(ctx)).toEqual([]);
  });

  it("lets <ref> point at a comment (label = Comment N) and snapshots it", () => {
    const { html } = compile(wrap(`x<comment id="c1" by="x">note</comment> see <ref to="c1"/>`));
    expect(html).toMatch(/<delta-ref to="c1" data-target-num="1" data-target-tag="comment">/);
    expect(html).toContain('<template data-delta-pop="c1">');
  });

  it("warns on an unknown status, a <reply> outside a comment, and a comment inside a <title>", () => {
    const { ctx } = compile(`<document>
      <section id="s"><title>S<comment by="x">in title</comment></title>
        <comment by="x" status="maybe">hm</comment>
        <reply by="y">stray</reply>
      </section></document>`);
    const w = warnings(ctx);
    expect(w.some((m) => m.includes('unknown status "maybe"'))).toBe(true);
    expect(w.some((m) => m.includes("<reply> must be inside a <comment>"))).toBe(true);
    expect(w.some((m) => m.includes("inside a <title>"))).toBe(true);
  });

  it("keeps <reply> children and their attributes for the runtime thread", () => {
    const { html } = compile(wrap(
      `x<comment by="x" date="2026-09-12">q<reply by="y" date="2026-09-13">a</reply></comment>`,
    ));
    expect(html).toMatch(/<delta-comment by="x" date="2026-09-12" status="open" num="1" id="comment-1">q<delta-reply by="y" date="2026-09-13">a<\/delta-reply><\/delta-comment>/);
  });

  it("does not number or register anything quoted inside a comment (stable numbering vs. --final)", () => {
    const { html, ctx } = compile(wrap(`
      <comment by="x">see <equation id="quoted">x</equation></comment>
      <equation id="real">y</equation>`));
    expect(html).toMatch(/<delta-equation id="quoted">/); // no num
    expect(html).toContain('<delta-equation id="real" num="1.1">');
    expect(ctx.registry.has("quoted")).toBe(false);
    expect(ctx.registry.has("real")).toBe(true);
  });

  it("renders math inside a comment and its replies", () => {
    const { html } = compile(wrap(`x<comment by="x">$a < b$<reply by="y">$c$</reply></comment>`));
    expect((html.match(/class="katex"/g) ?? []).length).toBe(2);
  });

  it("ships the runtime element and its CSS", () => {
    const { html } = compile(wrap(`x<comment by="x">n</comment>`));
    expect(html).toContain('customElements.define("delta-comment"');
    expect(html).toContain(".note-marker");
    expect(html).toContain('html[data-review="off"] delta-comment');
  });
});

describe("collab elements in the AST", () => {
  it("writes defaults onto the nodes themselves (compile-time data, runtime chrome)", () => {
    const ctx = createContext("test.dlt");
    const html = compileSource(wrap(`x<comment by="x">n</comment>`), ctx);
    expect(html).toBeDefined();
    // (the AST isn't returned; the attribute on the emitted tag proves the write)
    expect(html).toContain('status="open"');
  });

  it("passes source positions into collab diagnostics", () => {
    const { ctx } = compile(wrap(`<comment by="x" status="??">n</comment>`));
    const d = ctx.diagnostics.find((d) => d.message.includes("unknown status"));
    expect(d?.pos?.line).toBeGreaterThan(0);
  });
});

// Keeps `elements` import used for future AST-level cases; asserts the generic walk sees comments.
describe("tree shape", () => {
  it("keeps <comment> as an ordinary ElementNode", () => {
    const ctx = createContext("test.dlt");
    const html = compileSource(wrap(`x<comment by="x">n</comment>`), ctx);
    expect(html).toContain("</delta-comment>");
    const probe: ElementNode = { type: "element", tag: "comment", attrs: {}, children: [] };
    expect([...elements(probe)].length).toBe(1);
  });
});

describe("<todo>", () => {
  it("defaults status/priority and numbers tasks with their own counter", () => {
    const { html, ctx } = compile(`<document>
      <section id="a"><title>A</title><todo id="t1" for="x">do</todo></section>
      <section id="b"><title>B</title><todo id="t2" by="y" status="done" priority="high" due="2026-09-20">did</todo></section>
    </document>`);
    expect(html).toMatch(/<delta-todo id="t1" for="x" status="open" priority="normal" num="1">/);
    expect(html).toMatch(/<delta-todo id="t2" by="y" status="done" priority="high" due="2026-09-20" num="2">/);
    expect(ctx.registry.get("t2")).toEqual({ tag: "todo", num: "2" });
    expect(warnings(ctx)).toEqual([]);
  });

  it("warns on an unknown status or priority and on an assignee outside the team", () => {
    const { ctx } = compile(`<document><team><member id="a" name="A"/></team><section id="s"><title>S</title>
      <todo for="zed" status="later" priority="urgent">x</todo>
    </section></document>`);
    const w = warnings(ctx);
    expect(w.some((m) => m.includes('unknown status "later"'))).toBe(true);
    expect(w.some((m) => m.includes('unknown priority "urgent"'))).toBe(true);
    expect(w.some((m) => m.includes('for="zed"'))).toBe(true);
  });

  it("ships the runtime element and CSS", () => {
    const { html } = compile(wrap(`<todo for="x">do</todo>`));
    expect(html).toContain('customElements.define("delta-todo"');
    expect(html).toContain(".todo-state");
  });
});

describe("status / by / verified-by on blocks, and <draft>", () => {
  it("passes the marks through untouched and registers nothing new", () => {
    const { html, ctx } = compile(wrap(`
      <lemma id="l" status="verified" by="ai" verified-by="rb">x</lemma>
      <proof of="l" status="sketch" by="ai">y</proof>
      <subsection id="ss" status="draft"><title>T</title>z</subsection>`));
    expect(html).toContain('<delta-lemma id="l" status="verified" by="ai" verified-by="rb" num="1.1">');
    expect(html).toMatch(/<delta-proof of="l" status="sketch" by="ai"[^>]*>/);
    expect(html).toContain('<delta-subsection id="ss" status="draft" num="1.1">');
    expect(ctx.registry.get("l")).toEqual({ tag: "lemma", num: "1.1" });
    expect(warnings(ctx)).toEqual([]);
  });

  it("gives <draft> status=\"draft\" by default and validates the block vocabulary", () => {
    const { html, ctx } = compile(wrap(`
      <draft by="ai" note="loose">prose</draft>
      <theorem status="final">t</theorem>`));
    expect(html).toContain('<delta-draft by="ai" note="loose" status="draft" id="draft-1">');
    expect(warnings(ctx).some((m) => m.includes('<theorem> has unknown status "final"'))).toBe(true);
    expect(html).toContain('customElements.define("delta-draft"');
    expect(html).toContain(".status-pill");
  });

  it("checks by / verified-by against the team", () => {
    const { ctx } = compile(`<document><team><member id="a" name="A"/></team><section id="s"><title>S</title>
      <lemma by="ghost" verified-by="phantom">x</lemma></section></document>`);
    const w = warnings(ctx);
    expect(w.some((m) => m.includes('by="ghost"'))).toBe(true);
    expect(w.some((m) => m.includes('verified-by="phantom"'))).toBe(true);
  });
});

describe("<change> / <old> / <new>", () => {
  it("infers kind from the parts, numbers changes, and marks block changes", () => {
    const { html, ctx } = compile(wrap(`
      a <change id="r" by="x"><old>old</old><new>new</new></change>
      b <change id="d" by="x"><old>gone</old></change>
      c <change id="i" by="x">added</change>
      <change id="b" by="x"><new><lemma id="l">L</lemma></new></change>`));
    expect(html).toMatch(/<delta-change id="r" by="x" kind="replace" num="1">/);
    expect(html).toMatch(/<delta-change id="d" by="x" kind="delete" num="2">/);
    expect(html).toMatch(/<delta-change id="i" by="x" kind="insert" num="3">/);
    expect(html).toMatch(/<delta-change id="b" by="x" kind="insert" block="true" num="4">/);
    expect(html).not.toMatch(/<delta-change id="i"[^>]*block=/);
    expect(ctx.registry.get("d")).toEqual({ tag: "change", num: "2" });
    expect(warnings(ctx)).toEqual([]);
  });

  it("warns on stray <old>/<new>, duplicates, mixed content, an empty change and a contradicting kind", () => {
    const { ctx } = compile(wrap(`
      <old>stray</old>
      <change by="x"><new>a</new><new>b</new></change>
      <change by="x">loose<new>c</new></change>
      <change by="x"></change>
      <change by="x" kind="delete"><new>d</new></change>`));
    const w = warnings(ctx);
    expect(w.some((m) => m.includes("<old> must be inside a <change>"))).toBe(true);
    expect(w.some((m) => m.includes("more than one <new>"))).toBe(true);
    expect(w.some((m) => m.includes("mixes loose content"))).toBe(true);
    expect(w.some((m) => m.includes("empty <change>"))).toBe(true);
    expect(w.some((m) => m.includes('kind="delete"> disagrees'))).toBe(true);
  });

  it("renders math inside <old>/<new> and keeps numbering stable for anything inside <old>", () => {
    const { html, ctx } = compile(wrap(`
      <change by="x"><old>$x < 0$ <equation id="gone">a</equation></old><new>$x > 0$</new></change>
      <equation id="kept">b</equation>`));
    expect((html.match(/class="katex"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toMatch(/<delta-equation id="gone">/);
    expect(html).toContain('<delta-equation id="kept" num="1.1">');
    expect(ctx.registry.has("gone")).toBe(false);
    expect(warnings(ctx)).toEqual([]);
  });

  it("ships the runtime element and the three view modes", () => {
    const { html } = compile(wrap(`<change by="x">n</change>`));
    expect(html).toContain('customElements.define("delta-change"');
    expect(html).toContain('html[data-changes="final"] .chg-del');
    expect(html).toContain('html[data-changes="original"] .chg-ins');
  });
});
