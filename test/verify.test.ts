import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "./harness.ts";
import type { SourceSpan } from "../src/compiler/ast.ts";
import type { ProofGraph } from "../src/compiler/graph.ts";
import { compileProject } from "../src/compiler/project.ts";
import { lintFindings } from "../src/graph-report.ts";
import { setAttributes } from "../src/verify.ts";

function graphOf(src: string): {
  graph: ProofGraph;
  html: string;
  diagnostics: ReturnType<typeof compileProject>["diagnostics"];
} {
  const dir = mkdtempSync(join(tmpdir(), "delta-verify-"));
  writeFileSync(join(dir, "p.dlt"), src);
  const r = compileProject({ inputs: [join(dir, "p.dlt")], outDir: dir });
  return { graph: r.graph!, html: r.outputs[0]?.html ?? "", diagnostics: r.diagnostics };
}

const BASE = {
  lemma: "If $x < y$ then $x + 1 < y + 1$.",
  lemmaProof: "Add one to both sides.",
  thm: "For all $x$, $x < x + 1$.",
  thmProof: 'By <ref to="l"/> with $y = x + 1$... wait, directly.',
};

function doc(p: Partial<typeof BASE> = {}, extra = ""): string {
  const v = { ...BASE, ...p };
  return `<document><section id="s"><title>S</title>
<lemma id="l"><title>Shift</title>${v.lemma}</lemma>
<proof of="l">${v.lemmaProof}</proof>
<theorem id="t">${v.thm}</theorem>
<proof of="t">${v.thmProof}</proof>
<corollary id="c">Uses <ref to="t"/>.</corollary>
<proof of="c">Clear.</proof>
${extra}</section></document>`;
}

const hashes = (src: string) => {
  const { graph } = graphOf(src);
  return {
    l: graph.nodes.get("l")!.hash,
    t: graph.nodes.get("t")!.hash,
    c: graph.nodes.get("c")!.hash,
  };
};

describe("what a verification is pinned to", () => {
  const base = hashes(doc());

  it("changes a result's hash when its statement or its proof changes", () => {
    expect(hashes(doc({ lemma: "If $x < y$ then $x + 2 < y + 2$." })).l).not.toBe(base.l);
    expect(hashes(doc({ lemmaProof: "Add one to each side." })).l).not.toBe(base.l);
  });

  it("changes the users' hashes when a statement changes, but not when a proof does", () => {
    const statement = hashes(doc({ lemma: "If $x < y$ then $x + 2 < y + 2$." }));
    expect(statement.t).not.toBe(base.t); // t uses l's statement
    expect(statement.c).toBe(base.c); // c uses t, whose statement did not change
    expect(hashes(doc({ lemmaProof: "Add one to each side." })).t).toBe(base.t);
  });

  it("ignores whitespace, titles, aids, comments, and the tags' own attributes", () => {
    const same = doc({
      lemma:
        'If  $x < y$\n   then $x + 1 < y + 1$.<intuition>Translation.</intuition><comment by="a">ok?</comment>',
    })
      .replace("<title>Shift</title>", "<title>Translation</title>")
      .replace('<proof of="l">', '<proof of="l" status="review" by="a">');
    expect(hashes(same)).toEqual(base);
  });
});

describe("a stale verification", () => {
  it("counts as a sketch, shows as stale, and is a lint error", () => {
    const { graph: g0 } = graphOf(doc());
    const pinned = (lemma: string) =>
      doc({ lemma }).replace(
        '<proof of="l">',
        `<proof of="l" status="verified" against="${g0.nodes.get("l")!.hash}">`,
      );

    const fresh = graphOf(pinned(BASE.lemma));
    expect(fresh.graph.nodes.get("l")).toMatchObject({ own: "verified", stale: false });

    const edited = graphOf(pinned("If $x < y$ then $x + 2 < y + 2$."));
    expect(edited.graph.nodes.get("l")).toMatchObject({ own: "sketch", stale: true });
    expect(edited.html).toMatch(/<delta-proof of="l" status="stale"/);
    const lint = lintFindings(edited.graph, edited.diagnostics, (f) => f);
    expect(lint.filter((f) => f.kind === "stale").map((f) => f.ids)).toEqual([["l"]]);
  });
});

describe("setAttributes", () => {
  const span = (text: string, tag: string): SourceSpan => {
    const start = text.indexOf(tag);
    return {
      file: "x",
      start,
      end: start,
      inner: start + tag.length,
      innerEnd: start + tag.length,
    };
  };

  it("replaces existing values (either quote) and appends new ones, touching nothing else", () => {
    const text = `a <proof of="l" status='sketch' by="x">body</proof> z`;
    const tag = `<proof of="l" status='sketch' by="x">`;
    expect(setAttributes(text, span(text, tag), { status: "verified", against: "abc" })).toBe(
      `a <proof of="l" status="verified" by="x" against="abc">body</proof> z`,
    );
  });

  it("keeps a multi-line tag multi-line and escapes values", () => {
    const text = `<proof of="l"\n       by="x"\n>b</proof>`;
    const tag = `<proof of="l"\n       by="x"\n>`;
    expect(setAttributes(text, span(text, tag), { "verified-by": 'a"<b' })).toBe(
      `<proof of="l"\n       by="x" verified-by="a&quot;&lt;b"\n>b</proof>`,
    );
  });
});

describe("setAttributes on a self-closing tag", () => {
  it("keeps the tag self-closing and well-formed", () => {
    for (const tag of [`<proof of="x"/>`, `<proof of="x" />`]) {
      const text = `a ${tag} z`;
      const start = text.indexOf(tag);
      const span = {
        file: "x",
        start,
        end: start + tag.length,
        inner: start + tag.length,
        innerEnd: start + tag.length,
      };
      expect(setAttributes(text, span, { status: "verified" })).toBe(
        `a ${tag.replace(/\s*\/>$/, "")} status="verified"${tag.endsWith(" />") ? " />" : "/>"} z`,
      );
    }
  });
});

describe("a proof with included content", () => {
  const build = (body: string) => {
    const dir = mkdtempSync(join(tmpdir(), "delta-verify-inc-"));
    writeFileSync(
      join(dir, "body.dlt"),
      `<document>${body}<intuition>never hashed</intuition></document>`,
    );
    writeFileSync(
      join(dir, "p.dlt"),
      `<document><section id="s"><title>S</title>
<lemma id="l">L.<intuition>i</intuition></lemma>
<proof of="l">Start. <include src="body.dlt"/> End.</proof></section></document>`,
    );
    const r = compileProject({ inputs: [join(dir, "p.dlt")], outDir: dir });
    return r.graph!.nodes.get("l")!.hash;
  };

  it("hashes the included file, so editing it unpins a verification", () => {
    expect(build("Middle.")).not.toBe(build("Middle, edited."));
    expect(build("Middle.")).toBe(build("Middle.  "));
  });
});
