import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

describe.skipIf(!BROWSER)("<code>", () => {
  const facts = lazy(() =>
    inspect(
      `<document><code lang="python" num="3">print(1)</code></document>`,
      `// The clipboard needs a focused, user-activated page; stand it in.
       let copied = null;
       navigator.clipboard.writeText = (t) => { copied = t; return Promise.resolve(); };
       const before = text(".code-copy");
       click(".code-copy");
       await sleep(20);
       return {
         lang: text(".code-lang"),
         caption: text(".code-cap .lbl"),
         builtin: text(".code-src code .tok-builtin"),
         before,
         copied,
         after: text(".code-copy"),
       };`,
    ),
  );

  it("gets a header with its language and a copy button, and a numbered caption", () => {
    expect(facts().lang).toBe("PYTHON");
    expect(facts().before).toBe("Copy");
    expect(facts().caption).toBe("Code 3");
    expect(facts().builtin).toBe("print");
  });

  it("copies its source and says so", () => {
    expect(facts().copied).toBe("print(1)");
    expect(facts().after).toBe("Copied");
  });
});

describe.skipIf(!BROWSER)("media, tables and boxes", () => {
  it("labels a figure and a table with their numbers; a missing image says so, localized", () => {
    const r = inspect(
      `<document lang="pt"><section><title>S</title>
        <figure><caption>A plot.</caption></figure>
        <table><title>Data</title><row><column>1</column></row></table>
      </section></document>`,
      `return { figure: text(".figure-cap .lbl"), missing: text(".video-missing"), table: text(".table-lbl") };`,
    );
    expect(r).toEqual({
      figure: "Figura 1.1",
      missing: "Imagem não encontrada.",
      table: "Tabela 1.1",
    });
  });

  it("colours a box from a palette name, a type preset, or a literal colour", () => {
    const r = inspect(
      `<document><box color="teal">a</box><box type="warning">b</box><box color="#5b3fb0">c</box></document>`,
      `const [a, b, c] = $$("delta-box");
       return { a: a.dataset.accent, b: b.dataset.accent, c: c.style.getPropertyValue("--delta-accent") };`,
    );
    expect(r).toEqual({ a: "teal", b: "orange", c: "#5b3fb0" });
  });
});

describe.skipIf(!BROWSER)("presentations", () => {
  it("shows one slide at a time and pages with the keyboard", () => {
    const r = inspect(
      `<document type="presentation"><slide><title>One</title>a</slide><slide><title>Two</title>b</slide></document>`,
      `const active = () => $$("delta-slide").findIndex((s) => s.classList.contains("is-active"));
       const seq = [active()];
       key("ArrowRight");
       seq.push(active());
       key("Home");
       seq.push(active());
       return { seq };`,
    );
    expect(r.seq).toEqual([0, 1, 0]);
  });
});

describe.skipIf(!BROWSER)("display math", () => {
  it("sits as close to its sentence with <equation> as with $$…$$", () => {
    const r = inspect(
      `<document>Before <equation id="e">x = 1</equation> between $$y = 2$$ after.</document>`,
      `const top = (el) => parseFloat(getComputedStyle(el).marginTop);
       const eq = $("delta-equation");
       return { tagged: top(eq) + top($(".katex-display", eq)), untagged: top($(".katex-display:not(delta-equation *)")) };`,
    );
    // The tag carries the margin itself and none inside; $$…$$ carries KaTeX's.
    expect(r.tagged).toBe(r.untagged);
  });
});
