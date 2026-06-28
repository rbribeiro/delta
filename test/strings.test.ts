import { describe, expect, it } from "vitest";
import { resolveLang, stringsFor } from "../src/compiler/strings";

describe("resolveLang", () => {
  it("matches an exact language, case-insensitively", () => {
    expect(resolveLang("pt")).toBe("pt");
    expect(resolveLang("PT")).toBe("pt");
  });

  it("falls back from a region subtag to the base language", () => {
    expect(resolveLang("pt-BR")).toBe("pt");
    expect(resolveLang("en-US")).toBe("en");
  });

  it("falls back to en for unknown or missing langs", () => {
    expect(resolveLang("xx")).toBe("en");
    expect(resolveLang(undefined)).toBe("en");
    expect(resolveLang("")).toBe("en");
  });
});

describe("stringsFor", () => {
  it("returns the language's strings", () => {
    expect(stringsFor("pt").proof).toBe("Demonstração");
    expect(stringsFor("en").proof).toBe("Proof");
  });

  it("overlays the language onto the en base so missing keys fall back", () => {
    // Every en key is present in the merged result even if a language omits it.
    const pt = stringsFor("pt");
    for (const key of Object.keys(stringsFor("en"))) {
      expect(pt[key]).toBeDefined();
    }
  });
});
