import { describe, expect, it } from "vitest";
import { createContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { filterReview, formatReviewText, reviewJson, summarize, type ReviewData } from "../src/review-report";

function data(src: string): ReviewData {
  const ctx = createContext("test.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { team: [...ctx.team.values()], items: ctx.review };
}

const DOC = `<document>
  <team><member id="rb" name="Rodrigo" color="blue"/><member id="ai" name="Claude" kind="agent" color="purple"/></team>
  <section id="s"><title>Setup</title>
    a<comment id="c1" by="ai" date="2026-09-12">Needs $K$ compact.<reply by="rb">Agreed.</reply></comment>
    b<comment id="c2" by="rb" status="resolved">fine</comment>
    <todo id="t1" for="ai" by="rb" priority="high" due="2026-09-20">Finish <ref to="l"/>.</todo>
    <todo id="t2" for="rb" status="done">Read.</todo>
    <change id="ch" by="ai" note="sign"><old>x</old><new>y</new></change>
    <lemma id="l" status="sketch" by="ai"><title>Bound</title>z</lemma>
  </section>
</document>`;

describe("review report", () => {
  it("filters by status, assignee, author and kind", () => {
    const d = data(DOC);
    expect(filterReview(d.items, { status: "open" }).map((i) => i.id)).toEqual(["c1", "t1"]);
    expect(filterReview(d.items, { for: "ai" }).map((i) => i.id)).toEqual(["t1"]);
    expect(filterReview(d.items, { by: "ai" }).map((i) => i.id)).toEqual(["c1", "ch", "l"]);
    expect(filterReview(d.items, { kind: "todo", status: "done" }).map((i) => i.id)).toEqual(["t2"]);
  });

  it("summarizes open comments, open tasks, pending changes and blocks per status", () => {
    expect(summarize(data(DOC).items)).toEqual({ openComments: 1, openTasks: 1, pendingChanges: 1, blocks: { sketch: 1 } });
  });

  it("formats a readable text report grouped by kind", () => {
    const text = formatReviewText(data(DOC));
    expect(text).toContain("Team: Rodrigo (rb, human), Claude (ai, agent)");
    expect(text).toContain("Summary: 1 open comment(s), 1 open task(s), 1 pending change(s); blocks: 1 sketch");
    expect(text).toMatch(/Comments\n  C1 \[open\] by ai · 2026-09-12 · §1 Setup · #c1\n      Needs \$K\$ compact\.\n      ↳ rb: Agreed\./);
    expect(text).toMatch(/Tasks\n  T1 \[open\/high\] by rb · for ai · due 2026-09-20 · §1 Setup · #t1\n      Finish Lemma 1\.1\./);
    expect(text).toMatch(/Changes\n  Δ1 \[pending\/replace\] by ai · §1 Setup · #ch\n      x ⟶ y\n      note: sign/);
    expect(text).toMatch(/Blocks\n  Lemma 1\.1 \(Bound\) \[sketch\] by ai · §1 Setup · #l/);
  });

  it("says so when there is nothing to review", () => {
    const d = data(`<document><section id="s"><title>S</title>x</section></document>`);
    expect(formatReviewText(d)).toContain("Nothing to review.");
  });

  it("emits JSON without the live AST nodes", () => {
    const j = reviewJson(data(DOC)) as { team: unknown[]; summary: unknown; items: Record<string, unknown>[] };
    expect(j.team).toHaveLength(2);
    expect(j.summary).toEqual({ openComments: 1, openTasks: 1, pendingChanges: 1, blocks: { sketch: 1 } });
    expect(j.items).toHaveLength(6);
    for (const i of j.items) {
      expect(i).not.toHaveProperty("body");
      expect(JSON.stringify(i)).not.toContain('"type":"text"');
    }
    expect(j.items[0]).toMatchObject({ kind: "comment", id: "c1", heading: { level: 2, num: "1", id: "s" } });
    expect((j.items[0].replies as unknown[])[0]).toEqual({ by: "rb", text: "Agreed." });
  });
});
