import { describe, expect, it } from "vitest";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";
import { collectTeam, PALETTE } from "../src/compiler/team";
import type { ElementNode } from "../src/compiler/ast";

function team(src: string): { doc: ElementNode; ctx: CompileContext } {
  const ctx = createContext("test.dlt");
  const doc = parse(preprocess(src), ctx);
  if (!doc) throw new Error("parse failed: " + JSON.stringify(ctx.diagnostics));
  collectTeam(doc, ctx);
  return { doc, ctx };
}

function compile(src: string): { html: string; ctx: CompileContext } {
  const ctx = createContext("test.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

const warnings = (ctx: CompileContext): string[] =>
  ctx.diagnostics.filter((d) => d.severity === "warning").map((d) => d.message);

describe("collectTeam", () => {
  it("builds the member map with explicit and auto-assigned colors", () => {
    const { ctx } = team(`<document><team>
      <member id="rb" name="Rodrigo" kind="human" color="blue"/>
      <member id="ai" name="Claude" kind="agent"/>
    </team></document>`);
    expect(ctx.team.get("rb")).toEqual({ id: "rb", name: "Rodrigo", kind: "human", color: "blue" });
    const ai = ctx.team.get("ai");
    expect(ai?.kind).toBe("agent");
    expect(PALETTE).toContain(ai?.color);
    expect(ai?.color).not.toBe("blue"); // round-robin skips explicit choices
    expect(warnings(ctx)).toEqual([]);
  });

  it("defaults kind to human and keeps auto colors distinct", () => {
    const { ctx } = team(`<document><team>
      <member id="a" name="A"/><member id="b" name="B"/><member id="c" name="C" color="purple"/>
    </team></document>`);
    const colors = [...ctx.team.values()].map((m) => m.color);
    expect(new Set(colors).size).toBe(3);
    expect(ctx.team.get("a")?.kind).toBe("human");
  });

  it("warns on unknown color / kind, a member without id or name, and conflicting duplicates", () => {
    const { ctx } = team(`<document><team>
      <member id="a" name="A" color="mauve" kind="robot"/>
      <member name="nobody"/>
      <member id="a" name="Other"/>
      <member id="b" name="B"/><member id="b" name="B"/>
    </team></document>`);
    const w = warnings(ctx);
    expect(w.some((m) => m.includes('unknown color "mauve"'))).toBe(true);
    expect(w.some((m) => m.includes('unknown kind "robot"'))).toBe(true);
    expect(w.some((m) => m.includes("needs both an id and a name"))).toBe(true);
    expect(w.some((m) => m.includes('duplicate <member id="a">'))).toBe(true);
    // the identical re-declaration of "b" is silent (projects re-declare per file)
    expect(w.some((m) => m.includes('duplicate <member id="b">'))).toBe(false);
    expect(ctx.team.get("a")?.kind).toBe("human");
    expect(PALETTE).toContain(ctx.team.get("a")?.color);
    expect(ctx.team.get("a")?.name).toBe("A");
    expect(ctx.team.size).toBe(2);
  });

  it("removes the <team> node from the tree (the data ships in the island, not as markup)", () => {
    const { doc } = team(`<document><team><member id="a" name="A"/></team><section id="s"><title>S</title>x</section></document>`);
    expect(doc.children.some((c) => c.type === "element" && c.tag === "team")).toBe(false);
    const { html } = compile(`<document><team><member id="a" name="A"/></team><section id="s"><title>S</title>x</section></document>`);
    expect(html).not.toContain("<delta-team");
    expect(html).not.toContain("<delta-member");
  });

  it("warns about a <team> that is not a direct child of <document>", () => {
    const { ctx } = team(`<document><section id="s"><title>S</title><team><member id="a" name="A"/></team></section></document>`);
    expect(warnings(ctx).some((m) => m.includes("direct child"))).toBe(true);
    expect(ctx.team.size).toBe(0);
  });

  it("checks `by` against the team only when a team is declared", () => {
    const withTeam = compile(`<document><team><member id="a" name="A"/></team>
      <section id="s"><title>S</title>x<comment by="zed">hm</comment></section></document>`);
    expect(warnings(withTeam.ctx).some((m) => m.includes('by="zed"'))).toBe(true);
    const noTeam = compile(`<document><section id="s"><title>S</title>x<comment by="zed">hm</comment></section></document>`);
    expect(warnings(noTeam.ctx)).toEqual([]);
  });
});
