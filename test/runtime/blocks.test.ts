import { describe, expect, it } from "vitest";
import { mount } from "./helpers";

describe("<code>", () => {
  it("gets a header with its language and a copy button, and a numbered caption", async () => {
    const page = await mount(`<document><code lang="python" num="3">print(1)</code></document>`);
    expect(page.$(".code-lang")!.textContent).toBe("PYTHON");
    expect(page.$(".code-copy")!.textContent).toBe("Copy");
    expect(page.$(".code-cap .lbl")!.textContent).toBe("Code 3");
    expect(page.$(".code-src code .hljs-built_in")!.textContent).toBe("print");
  });

  it("copies its source and says so", async () => {
    const page = await mount(`<document><code lang="python">x = 1</code></document>`);
    page.click(".code-copy");
    expect(await page.window.navigator.clipboard.readText()).toBe("x = 1");
    // The label reads "Copied" once the write resolves, and "Copy" again 1.4 s later.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(page.$(".code-copy")!.textContent).toBe("Copied");
  });
});

describe("media, tables and boxes", () => {
  it("labels a figure and a table with their numbers; a missing image says so, localized", async () => {
    const page = await mount(`<document lang="pt"><section><title>S</title>
      <figure><caption>A plot.</caption></figure>
      <table><title>Data</title><row><column>1</column></row></table>
    </section></document>`);
    expect(page.$(".figure-cap .lbl")!.textContent).toBe("Figura 1.1");
    expect(page.$(".video-missing")!.textContent).toBe("Imagem não encontrada.");
    expect(page.$(".table-lbl")!.textContent).toBe("Tabela 1.1");
  });

  it("colours a box from a palette name, a type preset, or a literal colour", async () => {
    const page = await mount(`<document>
      <box color="teal">a</box><box type="warning">b</box><box color="#5b3fb0">c</box>
    </document>`);
    const [a, b, c] = page.$$("delta-box");
    expect(a.dataset.accent).toBe("teal");
    expect(b.dataset.accent).toBe("orange");
    expect(c.style.getPropertyValue("--delta-accent")).toBe("#5b3fb0");
  });
});

describe("presentations", () => {
  it("shows one slide at a time and pages with the keyboard", async () => {
    const page = await mount(`<document type="presentation">
      <slide><title>One</title>a</slide><slide><title>Two</title>b</slide>
    </document>`);
    const active = () => page.$$("delta-slide").findIndex((s) => s.classList.contains("is-active"));
    expect(active()).toBe(0);
    page.key("ArrowRight");
    expect(active()).toBe(1);
    page.key("Home");
    expect(active()).toBe(0);
  });
});
