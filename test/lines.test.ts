import { describe, expect, it } from "./harness.ts";
import { lineIndex, lineOf } from "../src/compiler/lines.ts";

/** The one line counter (src/compiler/lines.ts), on the edges the old copies had to agree on. */
describe("lineIndex", () => {
  const text = "ab\ncd\n\nef";
  const lines = lineIndex(text);

  it("counts the newlines before an offset, plus one", () => {
    expect([0, 1, 2, 3, 5, 6, 7, 9].map((o) => lines.lineOf(o))).toEqual([1, 1, 1, 2, 2, 3, 4, 4]);
  });

  it("puts a newline on the line it ends", () => {
    expect(lines.lineOf(text.indexOf("\n"))).toBe(1);
  });

  it("finds where the line holding an offset starts", () => {
    expect([0, 2, 3, 4, 6, 7, 8].map((o) => lines.startOf(o))).toEqual([0, 0, 3, 3, 6, 7, 7]);
  });

  it("works on a text without a newline, and past its end", () => {
    expect(lineOf("abc", 2)).toBe(1);
    expect(lineIndex("abc").startOf(3)).toBe(0);
    expect(lineOf(text, text.length)).toBe(4);
  });

  it("agrees with counting by hand", () => {
    const sample = "x\n\n  y\nz\n";
    for (let o = 0; o <= sample.length; o++) {
      expect(lineOf(sample, o), `offset ${o}`).toBe(sample.slice(0, o).split("\n").length);
    }
  });
});
