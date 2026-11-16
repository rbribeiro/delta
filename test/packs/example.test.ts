import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "../runtime/helpers.ts";

/**
 * The example standard pack, in a real browser: loaded only because the document uses its
 * tag, upgraded, painted (the label is what the page shows at its own position), and
 * localized. One browser test per standard pack goes in this folder.
 */

const PROBE = `
  const host = $("delta-pack-example");
  const label = $(".pack-example-label");
  const box = label.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return {
    upgraded: customElements.get("delta-pack-example") !== undefined && host.dataset.deltaReady === "1",
    label: label.textContent,
    painted: box.width > 0 && box.height > 0 && label.contains(hit),
    body: text(".pack-example-body"),
    labelColour: getComputedStyle(label).color,
    background: getComputedStyle(host).backgroundColor,
  };`;

type Facts = {
  upgraded: boolean;
  label: string;
  painted: boolean;
  body: string;
  labelColour: string;
  background: string;
};

const page = (attrs: string) =>
  `<document ${attrs}><title>T</title><pack-example>Hello, <b>world</b>.</pack-example></document>`;

describe.skipIf(!BROWSER)("<pack-example>", () => {
  const en = lazy(() => inspect<Facts>(page(`lang="en"`), PROBE));
  const ptDark = lazy(() => inspect<Facts>(page(`lang="pt-BR" theme-mode="dark"`), PROBE));

  it("upgrades and shows its content under the label", () => {
    expect(en().upgraded).toBe(true);
    expect(en().body).toBe("Hello, world.");
  });

  it("paints the label where it sits", () => {
    expect(en().painted).toBe(true);
    expect(ptDark().painted).toBe(true);
  });

  it("labels itself in the document's language", () => {
    expect(en().label).toBe("Example pack");
    expect(ptDark().label).toBe("Pacote de exemplo");
  });

  it("follows dark mode through the tokens", () => {
    expect(ptDark().background).not.toBe(en().background);
    expect(ptDark().labelColour).not.toBe(en().labelColour);
  });
});
