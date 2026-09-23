import { describe, expect, it } from "vitest";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";

function compile(src: string): { html: string; ctx: CompileContext } {
  const ctx = createContext("test.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

/** Parses the #delta-review island out of an output. */
function island(html: string): Record<string, unknown> | undefined {
  const m = html.match(/<script type="application\/json" id="delta-review">(.*?)<\/script>/s);
  return m ? (JSON.parse(m[1]) as Record<string, unknown>) : undefined;
}

const PLAIN = `<document><title>T</title><section id="s"><title>S</title>text</section></document>`;
const TEAM = `<team><member id="rb" name="Rodrigo" color="blue"/><member id="ai" name="Claude" kind="agent" color="purple"/></team>`;

describe("#delta-review island", () => {
  it("is absent from a document with no team, no panel and no items", () => {
    const { html } = compile(PLAIN);
    expect(html).not.toContain('id="delta-review"');
  });

  it("carries the team when a <team> is declared", () => {
    const { html } = compile(`<document>${TEAM}<section id="s"><title>S</title>x<comment by="ai">n</comment></section></document>`);
    const data = island(html);
    expect(data?.team).toEqual([
      { id: "rb", name: "Rodrigo", kind: "human", color: "blue" },
      { id: "ai", name: "Claude", kind: "agent", color: "purple" },
    ]);
    expect(data?.items).toBeUndefined(); // no <review> panel → no item list shipped
  });

  it("escapes `<` so a member name cannot break out of the script", () => {
    const { html } = compile(`<document><team><member id="a" name="A &lt;b&gt;"/></team><section id="s"><title>S</title>x<comment by="a">n</comment></section></document>`);
    const raw = html.match(/id="delta-review">(.*?)<\/script>/s)?.[1] ?? "";
    expect(raw).toContain("\\u003c");
    expect(raw).not.toContain("<b>");
    expect(island(html)?.team).toEqual([{ id: "a", name: "A <b>", kind: "human", color: "blue" }]);
  });

  it("localizes the collaboration labels (pt: Anotação, not Comentário — that is <remark>)", () => {
    const pt = compile(`<document lang="pt-BR"><title>T</title><section id="s"><title>S</title>x</section></document>`).html;
    expect(pt).toContain('"comment":"Anotação"');
    expect(pt).toContain('"remark":"Comentário"');
    expect(pt).toContain('"todo":"Tarefa"');
    const en = compile(PLAIN).html;
    expect(en).toContain('"comment":"Comment"');
  });

  it("keeps the offline invariant with collaboration markup present", () => {
    const { html } = compile(`<document>${TEAM}<section id="s"><title>S</title>x<comment by="ai">$a$</comment></section></document>`);
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) {
      expect(m[1]).toMatch(/^["']?data:/);
    }
  });
});

describe("buildReview", () => {
  const DOC = `<document><review/>
    <section id="a"><title>Alpha</title>
      <subsection><title>Beta $x$</title>
        <lemma id="l"><title>L</title>x</lemma>
        text<comment id="c" by="ai" date="2026-09-12">See <ref to="l"/> and $a < b$.<reply by="rb">ok</reply></comment>
        <todo for="ai" priority="high">do $$\\int f$$</todo>
        <change by="ai"><old>a</old><new>b</new></change>
        <proof of="l" status="sketch" by="ai">p</proof>
      </subsection>
    </section>
    <section><title>Empty</title>nothing here</section>
  </document>`;

  it("collects comments, tasks, changes and status blocks with numbers, people and plain text", () => {
    const { ctx } = compile(DOC);
    expect(ctx.review.map((i) => i.kind)).toEqual(["comment", "todo", "change", "status"]);
    const [c, td, ch, p] = ctx.review;
    expect(c).toMatchObject({ id: "c", num: "1", status: "open", by: "ai", date: "2026-09-12", text: "See Lemma 1.1 and $a < b$." });
    expect(c.replies).toHaveLength(1);
    expect(c.replies?.[0]).toMatchObject({ by: "rb", text: "ok" });
    expect(td).toMatchObject({ id: "todo-1", num: "1", status: "open", priority: "high", for: "ai", text: "do $$\\int f$$" });
    expect(ch).toMatchObject({ id: "change-1", status: "pending", changeKind: "replace", text: "a ⟶ b" });
    expect(p).toMatchObject({ tag: "proof", id: "proof-of-l", status: "sketch", by: "ai", text: "Proof — p" });
  });

  it("records the nearest enclosing heading, slugging an id onto it only when needed", () => {
    const { ctx, html } = compile(DOC);
    for (const i of ctx.review) expect(i.heading).toMatchObject({ level: 3, num: "1.1", id: "beta" });
    expect(html).toContain('<delta-subsection num="1.1" id="beta">'); // num first: numbering ran before the slug
    // the empty section holds no item and there is no <toc>: it keeps no id
    expect(html).toMatch(/<delta-section num="2">/);
  });

  it("ships the items in the island only when the document has a <review>", () => {
    const withPanel = island(compile(DOC).html);
    expect((withPanel?.items as unknown[]).length).toBe(4);
    const first = (withPanel?.items as Record<string, unknown>[])[0];
    expect(first.html).toContain('class="katex"');
    expect((first.heading as Record<string, unknown>).title).toContain("Beta");
    const noPanel = compile(DOC.replace("<review/>", "")).html;
    expect(noPanel).not.toContain('id="delta-review"');
  });

  it("warns when on= names no id", () => {
    const { ctx } = compile(`<document><section id="s"><title>S</title><comment on="ghost" by="x">n</comment></section></document>`);
    expect(ctx.diagnostics.some((d) => d.message.includes('on="ghost"'))).toBe(true);
  });

  it("collects items from documents without a <review> too (the CLI reads ctx.review)", () => {
    const { ctx } = compile(`<document><section id="s"><title>S</title><todo for="x">t</todo></section></document>`);
    expect(ctx.review).toHaveLength(1);
  });
});

describe("plain text of a block", () => {
  it("reads as the paper will: new side of a change, no comment/task text", () => {
    const { ctx } = compile(`<document><section id="s"><title>S</title>
      <proof id="p" status="sketch">Let <change by="a"><old>$x < 0$</old><new>$x > 0$</new></change>.<comment by="a">why?</comment>
        <change by="a"><old>gone</old></change> <change by="a">added</change><todo for="a">t</todo>
      </proof></section></document>`);
    expect(ctx.review.find((i) => i.id === "p")?.text).toBe("Proof — Let $x > 0$. added");
  });
});

describe("island gating", () => {
  it("ships no island into a document that shares a team but has no items and no panel", () => {
    const { html } = compile(`<document><team><member id="a" name="A"/></team><section id="s"><title>S</title>x</section></document>`);
    expect(html).not.toContain('id="delta-review"');
  });
  it("ships no island for items without a team (chips fall back to free text)", () => {
    const { html } = compile(`<document><section id="s"><title>S</title>x<comment by="a">n</comment></section></document>`);
    expect(html).not.toContain('id="delta-review"');
  });
});
