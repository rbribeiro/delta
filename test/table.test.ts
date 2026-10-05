import { describe, expect, it } from "./harness.ts";
import { RUNTIME_JS } from "../src/generated/assets.ts";
import { compile } from "./helpers.ts";

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
    // Tolerate extra compiler-added attributes (e.g. num="1.1" once tables are numbered).
    expect(html).toMatch(/<delta-table id="t:data" max-height="420px"[ >]/);
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
