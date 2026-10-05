import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "./harness.ts";
import { parseToml, TomlError } from "../src/compiler/toml.ts";

/** The error a parse throws, with its position; fails the test if it parses. */
function error(src: string): TomlError {
  try {
    parseToml(src);
  } catch (e) {
    if (e instanceof TomlError) return e;
    throw e;
  }
  throw new Error("expected a TomlError");
}

/** Every project.toml under `dir`, recursively (skipping node_modules and build output). */
function projectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "docs" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...projectFiles(p));
    else if (name === "project.toml") out.push(p);
  }
  return out;
}

describe("parseToml: what a project.toml uses", () => {
  it("reads the scaffold-shaped file: comments everywhere, an empty array, a commented-out table", () => {
    const data = parseToml(`# my project
inputs = ["main.dlt"]   # the documents, in order
out = "out"             # where the HTML goes
packages = []

# [document]
# lang = "pt-BR"
`);
    expect(data).toEqual({ inputs: ["main.dlt"], out: "out", packages: [] });
  });

  it("reads a multi-line array with a trailing comma and comments inside", () => {
    const data = parseToml(`inputs = [
  "index.dlt",      # landing
  "comecar.dlt",    # tutorial

  # the reference
  "layout.dlt",
]
`);
    expect(data.inputs).toEqual(["index.dlt", "comecar.dlt", "layout.dlt"]);
  });

  it("puts aligned, hyphenated keys under their [table]", () => {
    const data = parseToml(`inputs = ["a.dlt"]
[document]
lang         = "pt-BR"
theme-accent = "orange"
`);
    expect(data).toEqual({ inputs: ["a.dlt"], document: { lang: "pt-BR", "theme-accent": "orange" } });
  });

  it("parses integers and booleans into values, so config.ts can reject them by type", () => {
    expect(parseToml(`out = 5\nflag = true\nneg = -12\nbig = 1_000\nplus = +3\n`)).toEqual({
      out: 5,
      flag: true,
      neg: -12,
      big: 1000,
      plus: 3,
    });
    expect(parseToml(`packages = [1, 2]\n`)).toEqual({ packages: [1, 2] });
  });

  it("handles escapes in basic strings, literal strings, and nested arrays", () => {
    const data = parseToml(String.raw`a = "quote \" slash \\ tab \t caf\u00e9"
b = 'C:\raw\path'
c = [["x", "y"], []]
`);
    expect(data).toEqual({ a: 'quote " slash \\ tab \t café', b: "C:\\raw\\path", c: [["x", "y"], []] });
  });

  it("accepts CRLF line endings and a dotted [a.b] header", () => {
    expect(parseToml(`a = 1\r\n[x.y]\r\nz = "w"\r\n`)).toEqual({ a: 1, x: { y: { z: "w" } } });
  });

  it("parses every project.toml in the repository, each with string inputs", () => {
    const files = projectFiles(".");
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) {
      const data = parseToml(readFileSync(f, "utf8"));
      expect(Array.isArray(data.inputs), f).toBe(true);
      expect((data.inputs as unknown[]).every((i) => typeof i === "string"), f).toBe(true);
    }
  });
});

describe("parseToml: what it refuses, with a position", () => {
  const cases: [string, string, RegExp, number, number][] = [
    ["an inline table", `a = { b = 1 }`, /inline tables/, 1, 5],
    ["an array of tables", `[[a]]\nb = 1`, /arrays of tables/, 1, 1],
    ["a multi-line string", `a = """x"""`, /multi-line strings/, 1, 5],
    ["a float", `a = 1.5`, /floats/, 1, 5],
    ["inf", `a = inf`, /floats/, 1, 5],
    ["a date", `a = 2026-10-02`, /dates and times/, 1, 5],
    ["a hex number", `a = 0xff`, /hex, octal and binary/, 1, 5],
    ["a quoted key", `"a b" = 1`, /quoted keys/, 1, 1],
    ["a dotted key", `a.b = 1`, /dotted keys/, 1, 2],
    ["a missing =", `inputs ["a"]`, /expected `=` after key `inputs`/, 1, 8],
    ["a bare word as a value", `a = yes`, /expected a value/, 1, 5],
    ["a bad escape", `a = "\\q"`, /invalid escape `\\q`/, 1, 6],
    ["an unterminated string", `a = "oops\nb = 1`, /unterminated string/, 1, 10],
    ["an unterminated array", `inputs = [\n  "a.dlt",\n`, /unterminated array/, 1, 10],
    ["junk after a value", `a = 1 b = 2`, /unexpected `b` after the value/, 1, 7],
    ["a missing comma in an array", `a = [1 2]`, /expected `,` or `\]`/, 1, 8],
    ["a duplicate key", `a = 1\na = 2`, /duplicate key `a`/, 2, 1],
    ["a table defined twice", `[t]\n[t]`, /table \[t\] defined twice/, 2, 1],
    ["a key then a table of the same name", `t = 1\n[t]`, /`t` is a value, not a table/, 2, 1],
    ["a second value on the header line", `[t] x`, /unexpected `x`/, 1, 5],
  ];
  for (const [what, src, message, line, column] of cases) {
    it(`rejects ${what}`, () => {
      const e = error(src);
      expect(e.message).toMatch(message);
      expect([e.line, e.column]).toEqual([line, column]);
    });
  }

  it("names the construct in the message, so the author knows what to change", () => {
    expect(error(`a = { b = 1 }`).message).toBe(
      "inline tables ({ … }) are not supported in project.toml: use a [table] header",
    );
  });
});
