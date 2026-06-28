import { describe, expect, it } from "vitest";
import { createContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { RUNTIME_JS } from "../src/generated/assets";

function compile(src: string) {
  const ctx = createContext("test.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

const doc = (body: string) =>
  `<document lang="en"><title>T</title><section id="s"><title>S</title>${body}</section></document>`;

const TABLE = `
  <table id="t:data" max-height="420px">
    <title>Throughput</title>
    <caption>Measured on the rig.</caption>
    <header>
      <column>Config</column>
      <column align="right">Reqs/s</column>
    </header>
    <row>
      <column>A</column>
      <column align="right">1240</column>
    </row>
  </table>`;

describe("table", () => {
  it("passes the table tags through to delta-* custom elements (no compiler change)", () => {
    const { html } = compile(doc(TABLE));
    expect(html).toContain('<delta-table id="t:data" max-height="420px">');
    expect(html).toContain("<delta-header>");
    expect(html).toContain("<delta-row>");
    expect(html).toContain('<delta-column align="right">');
    // Title/caption ship as-is; the runtime lifts them into the head block.
    expect(html).toContain("<delta-title>Throughput</delta-title>");
    expect(html).toContain("<delta-caption>Measured on the rig.</delta-caption>");
  });

  it("inlines a runtime that registers the delta-table element", () => {
    expect(RUNTIME_JS).toContain("delta-table");
  });
});
