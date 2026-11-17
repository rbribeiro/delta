import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

/**
 * Smoke tests for the layout and prose elements: each upgrades, builds its chrome, and the
 * chrome is painted (it has a size, or is hidden when it should be). One page, one launch.
 */

const DOC = `<document lang="en">
  <title>Layout</title>
  <abstract>We prove a thing.</abstract>
  <keywords>graphs, walks</keywords>
  <received>2026-01-12</received>
  <acknowledgements>Thanks to everyone.</acknowledgements>
  <section id="s"><title>S</title>
    <columns>
      <column width="2">Wide column.</column>
      <column width="1">Narrow column.</column>
    </columns>
    <list marker="number" start="3">
      <item>Third.</item>
      <item>Fourth.<list marker="alpha"><item>Inner.</item></list></item>
    </list>
    <list><item>A bullet.</item></list>
    A line with <link to="https://example.org">a link</link> and a note.<sidenote>In the margin.</sidenote>
  </section>
  <floating><title>Navigate</title><toc/></floating>
</document>`;

const PROBE = `
  const box = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const shown = (el) => !!el && getComputedStyle(el).display !== "none" && box(el);
  const cols = $$("delta-columns > delta-column");
  const ol = $("delta-list > ol");
  const ext = $("delta-link a.ext-link");
  const fab = $("delta-floating .floating-fab");
  const panelBefore = shown($(".floating-panel"));
  fab.click();
  const panel = openPopover();
  return {
    abstract: { label: text(".abstract-label"), shown: shown($(".abstract-body")) },
    keywords: { line: $("delta-keywords").classList.contains("fm-line"), label: text("delta-keywords .fm-label") },
    received: text("delta-received .fm-label"),
    acknowledgements: $("delta-acknowledgements").classList.contains("fm-block"),
    columns: {
      flex: cols.map((c) => c.style.getPropertyValue("--col-flex").trim()),
      sideBySide: cols.length === 2 && cols[0].getBoundingClientRect().top === cols[1].getBoundingClientRect().top,
      wider: cols[0].getBoundingClientRect().width > cols[1].getBoundingClientRect().width,
    },
    list: {
      ordered: ol !== null,
      marker: ol ? ol.dataset.marker : null,
      start: ol ? ol.getAttribute("start") : null,
      items: ol ? $$(":scope > li", ol).length : 0,
      inner: $("delta-list li delta-list > ol") ? $("delta-list li delta-list > ol").dataset.marker : null,
      bullets: $$("delta-list > ul").length,
    },
    link: {
      href: ext ? ext.getAttribute("href") : null,
      target: ext ? ext.target : null,
      rel: ext ? ext.rel : null,
      text: ext ? ext.textContent.trim() : null,
      icon: !!$("delta-link .ext-icon"),
    },
    sidenote: { cls: $("delta-sidenote").classList.contains("sidenote"), shown: shown($("delta-sidenote")) },
    floating: {
      fabShown: shown(fab),
      label: fab.getAttribute("aria-label"),
      panelBefore,
      panelOpen: !!panel && shown(panel),
      title: panel ? text(".floating-title", panel) : null,
      toc: panel ? $$("a", panel).map((a) => a.textContent.trim()).join(" | ") : "",
    },
  };`;

type Facts = Record<string, Record<string, unknown> | string | boolean | null>;

describe.skipIf(!BROWSER)("layout and prose elements", () => {
  const facts = lazy(() => inspect<Facts>(DOC, PROBE));

  it("front matter: an abstract with its label, labelled lines and blocks", () => {
    expect(facts().abstract).toEqual({ label: "Abstract", shown: true });
    expect(facts().keywords).toEqual({ line: true, label: "Keywords" });
    expect(facts().received).toBe("Received");
    expect(facts().acknowledgements).toBe(true);
  });

  it("<columns> lays its columns side by side, by weight", () => {
    expect(facts().columns).toEqual({ flex: ["2 1 0", "1 1 0"], sideBySide: true, wider: true });
  });

  it("<list> becomes a real list, with its marker, start and nesting", () => {
    expect(facts().list).toEqual({
      ordered: true,
      marker: "decimal", // the author's "number", as list.css calls it
      start: "3",
      items: 2,
      inner: "alpha",
      bullets: 1,
    });
  });

  it("<link> opens outside, in a new tab, with its icon", () => {
    expect(facts().link).toEqual({
      href: "https://example.org",
      target: "_blank",
      rel: "noopener noreferrer",
      text: "a link",
      icon: true,
    });
  });

  it("<sidenote> is a painted margin note", () => {
    expect(facts().sidenote).toEqual({ cls: true, shown: true });
  });

  it("<floating> is a button that opens a panel with its title and contents", () => {
    expect(facts().floating).toMatchObject({
      fabShown: true,
      label: "Navigate",
      panelBefore: false,
      panelOpen: true,
      title: "Navigate",
    });
    expect((facts().floating as { toc: string }).toc).toContain("S");
  });
});
