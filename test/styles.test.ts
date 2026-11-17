import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "./harness.ts";

const base = readFileSync("src/styles/base.css", "utf8");

/** The declarations of the first rule whose selector is `selector`, normalized. */
function declarations(css: string, selector: string): string[] {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  return body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map((d) => d.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

describe("base.css dark mode", () => {
  // CSS cannot share one declaration list between `[data-mode="dark"]` and the
  // `[data-mode="auto"]` + prefers-color-scheme case, so base.css writes it twice.
  it("keeps the dark and auto blocks identical", () => {
    expect(declarations(base, '[data-mode="auto"]')).toEqual(
      declarations(base, '[data-mode="dark"]'),
    );
  });
});

// -- component CSS order ------------------------------------------------------------------
// scripts/build.ts concatenates components/*.css in file-name order, inside one layer. So
// two files must never decide a value by which comes later: no two component files style
// the same selector, in the same @media context, with the same property. A component may
// restyle another's class only from a context of its own (a more specific selector, like
// `.xref-pop-body .box`); chrome shared as equals goes in @layer delta.shells. `!important`
// declarations (the print rules) win in any order and are not counted. The browser-side
// proof, on real pages, is test/runtime/css-order.test.ts.

type Rule = { file: string; context: string; selector: string; props: string[] };

/** Splits at commas that are not inside parentheses (`:is(a, b), c` → `:is(a, b)`, `c`). */
function splitTop(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "(") depth++;
    else if (list[i] === ")") depth--;
    else if (list[i] === "," && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  out.push(list.slice(start));
  return out.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** The style rules of one component file, outside delta.shells and @keyframes. */
function componentRules(file: string): Rule[] {
  const css = readFileSync(`src/styles/components/${file}`, "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const rules: Rule[] = [];
  const stack: string[] = [];
  let text = "";
  for (const ch of css) {
    if (ch === "{") {
      stack.push(text.trim());
      text = "";
    } else if (ch === "}") {
      const head = stack.pop() ?? "";
      const inside = stack.some((s) => s.startsWith("@keyframes") || s === "@layer delta.shells");
      if (!head.startsWith("@") && !inside) {
        const props = text
          .split(";")
          .filter((d) => d.includes(":") && !d.includes("!important"))
          .map((d) => d.split(":")[0].trim());
        const context = stack.filter((s) => /^@(media|supports|container)/.test(s)).join(" ");
        for (const selector of splitTop(head)) rules.push({ file, context, selector, props });
      }
      text = "";
    } else if (ch === ";" && stack.length > 0 && text.trim().startsWith("@")) {
      text = ""; // an at-statement (`@layer a, b;`) inside a block
    } else {
      text += ch;
    }
  }
  return rules;
}

describe("component CSS order", () => {
  const files = readdirSync("src/styles/components").filter((f) => f.endsWith(".css"));
  const rules = files.flatMap(componentRules);

  it("finds the rules it checks", () => {
    expect(rules.length).toBeGreaterThan(500);
  });

  it("no two component files style the same selector with the same property", () => {
    const byKey = new Map<string, Rule[]>();
    for (const r of rules) {
      const key = `${r.context}|${r.selector}`;
      byKey.set(key, [...(byKey.get(key) ?? []), r]);
    }
    const clashes: string[] = [];
    for (const [key, group] of byKey) {
      const owners = [...new Set(group.map((r) => r.file))];
      if (owners.length < 2) continue;
      const propsOf = (f: string) =>
        new Set(group.filter((r) => r.file === f).flatMap((r) => r.props));
      const shared = [...propsOf(owners[0])].filter((p) =>
        owners.slice(1).every((f) => propsOf(f).has(p)),
      );
      if (shared.length)
        clashes.push(`${key.replace(/^\|/, "")} in ${owners.join(", ")}: ${shared.join(", ")}`);
    }
    expect(clashes, "move the shared rule into @layer delta.shells, or scope one side").toEqual([]);
  });
});
