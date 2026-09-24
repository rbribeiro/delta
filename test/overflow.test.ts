import { describe, expect, it } from "vitest";
import { createContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { BROWSER, evaluate } from "./browser";

/**
 * A display formula wider than the column must scroll inside itself, never widen the page:
 * `<equation>` always did, `$$…$$` in running text (or in a box) once did not.
 */

const WIDE = String.raw`\sum_{i=1}^{n} \left( a_i b_i + c_i d_i + e_i f_i + g_i h_i + i_i j_i + k_i l_i + m_i n_i + o_i p_i \right) = \int_0^1 f(x)\,dx + \int_0^1 g(x)\,dx`;

const DOC = `<document><section id="s"><title>S</title>
  In prose: $$${WIDE}$$
  <theorem id="t">In a box: $$${WIDE}$$</theorem>
  <equation>${WIDE}</equation>
</section></document>`;

describe.skipIf(!BROWSER)("wide display math on a phone", () => {
  it("scrolls inside each formula and leaves the page its own width", () => {
    const ctx = createContext("wide.dlt");
    const html = compileSource(DOC, ctx)!;
    const out = evaluate(
      html,
      `const d = document.documentElement;
       const scrolls = [...document.querySelectorAll(".katex-display")].map((k) => getComputedStyle(k).overflowX);
       document.body.append("RES" + "ULT::" + (d.scrollWidth <= d.clientWidth) + "," + scrolls.join(","));`,
      400,
    );
    expect(out).toBe("true,auto,auto,auto");
  });
});
