import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect } from "./helpers.ts";

/**
 * The test helper itself: a page error fails the test that loaded the page, whatever the
 * test asserts. Every browser test gets this for free (it lives in test/browser.ts).
 */
describe.skipIf(!BROWSER)("inspect()", () => {
  const withPack = (pack: string) =>
    `<document><import src="fixtures/${pack}" /><title>T</title>Text.</document>`;

  it("fails when a script on the page throws", () => {
    expect(() => inspect(withPack("throwing-pack"), `return 1;`)).toThrow(
      /the page threw[\s\S]*pack exploded/,
    );
  });

  it("fails on an unhandled promise rejection", () => {
    expect(() => inspect(withPack("rejecting-pack"), `return 1;`)).toThrow(
      /unhandled rejection: [\s\S]*nobody caught me/,
    );
  });

  it("fails when the probe's own timer throws later", () => {
    expect(() =>
      inspect(
        `<document><title>T</title>x</document>`,
        `setTimeout(() => { throw new Error("late"); }); await sleep(50); return 1;`,
      ),
    ).toThrow(/the page threw[\s\S]*late/);
  });

  it("does not count a missing image as an error", () => {
    const r = inspect(
      `<document><title>T</title><figure src="nowhere.png"><caption>C</caption></figure></document>`,
      `return $("delta-figure") !== null;`,
    );
    expect(r).toBe(true);
  });
});
