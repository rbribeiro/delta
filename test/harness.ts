/**
 * The test API, on Node's own test runner: `describe`, `it` and an `expect` with exactly the
 * matchers Delta's tests use, so a test file reads as it would under jest or vitest and the
 * repository needs no test framework. `npm test` is `node --test`.
 *
 * Matchers: `toBe`, `toEqual` (deep; undefined-valued keys count as absent), `toContain`
 * (a string or an array), `toContainEqual`, `toMatch`, `toHaveLength`, `toHaveProperty`,
 * `toBeDefined`/`toBeUndefined`/`toBeNull`, `toBeGreaterThan`/`toBeGreaterThanOrEqual`/
 * `toBeLessThan`, `toMatchObject` (a subset, recursively) and `toThrow`; every one also
 * under `.not`. `expect(x, "why")` prefixes the failure with `why`. `expect.stringMatching`
 * stands in for a string inside `toEqual`/`toMatchObject`. A matcher a new test needs goes
 * in `Matchers` and `matchers()` below: a few lines each.
 */

import { describe as suite, it as test } from "node:test";
import assert from "node:assert/strict";
import { format, inspect, isDeepStrictEqual } from "node:util";

// -- describe / it ----------------------------------------------------------------------
// Node's own `describe` and `it`, re-exported with one extra each. Re-exported rather than
// wrapped, so a failure is reported at the test's own line, not at a line in this file.

/** `describe.skipIf(!BROWSER)("…", …)`: the suite is listed but not run when the condition holds. */
export const describe = Object.assign(suite, {
  skipIf: (condition: unknown) => (name: string, body: () => void) => {
    if (condition) suite(name, { skip: true }, body);
    else suite(name, body);
  },
});

/** `it.each(cases)("%s does x", (c) => …)`: one test per case, named with util.format. */
export const it = Object.assign(test, {
  each:
    <T>(cases: readonly T[]) =>
    (name: string, body: (c: T) => void | Promise<void>) => {
      for (const c of cases) test(format(name, c), () => body(c));
    },
});

// -- expect -----------------------------------------------------------------------------

const ASYMMETRIC = Symbol("asymmetric");
interface Asymmetric {
  [ASYMMETRIC]: (value: unknown) => boolean;
  /** How a failure message shows it. */
  [inspect.custom]: () => string;
}
const isAsymmetric = (v: unknown): v is Asymmetric => typeof v === "object" && v !== null && ASYMMETRIC in v;

export interface Matchers {
  readonly not: Matchers;
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toContain(item: unknown): void;
  toContainEqual(item: unknown): void;
  toMatch(expected: RegExp | string): void;
  toHaveLength(length: number): void;
  toHaveProperty(path: string): void;
  toBeDefined(): void;
  toBeUndefined(): void;
  toBeNull(): void;
  toBeGreaterThan(n: number): void;
  toBeGreaterThanOrEqual(n: number): void;
  toBeLessThan(n: number): void;
  toMatchObject(expected: object): void;
  toThrow(expected?: RegExp | string): void;
}

export function expect(actual: unknown, message?: string): Matchers {
  return matchers(actual, false, message);
}
/** Matches any string that `expected` matches (a RegExp) or contains (a string). */
expect.stringMatching = (expected: RegExp | string): Asymmetric => ({
  [ASYMMETRIC]: (v) => typeof v === "string" && (typeof expected === "string" ? v.includes(expected) : expected.test(v)),
  [inspect.custom]: () => `StringMatching(${String(expected)})`,
});

/** A failed expectation: the message says it all (values already shortened), so no `actual` dump. */
class ExpectationError extends Error {
  constructor(message: string, at: (...args: never[]) => unknown) {
    super(message);
    this.name = "AssertionError";
    Error.captureStackTrace(this, at);
  }
}

function matchers(actual: unknown, negated: boolean, message?: string): Matchers {
  /** Throws unless `pass` is what this (possibly negated) expectation wants. */
  const check = (pass: boolean, what: string): void => {
    if (pass !== negated) return;
    const detail = `expected ${short(actual)} ${negated ? "not " : ""}${what}`;
    throw new ExpectationError(message ? `${message}: ${detail}` : detail, check);
  };
  const number = (): number => {
    if (typeof actual !== "number") throw new ExpectationError(`expected a number, got ${short(actual)}`, number);
    return actual;
  };

  return {
    get not() {
      return matchers(actual, !negated, message);
    },
    toBe(expected) {
      if (negated) check(Object.is(actual, expected), `to be ${short(expected)}`);
      // Node's own assertion, so a failure prints its diff (it accepts a message only when there is one).
      else if (message === undefined) assert.strictEqual(actual, expected);
      else assert.strictEqual(actual, expected, message);
    },
    toEqual(expected) {
      const pass = equals(actual, expected);
      if (!negated && !pass) {
        if (message === undefined) assert.deepStrictEqual(actual, expected);
        else assert.deepStrictEqual(actual, expected, message);
      }
      check(pass, `to equal ${short(expected)}`);
    },
    toContain(item) {
      const pass =
        typeof actual === "string"
          ? typeof item === "string" && actual.includes(item)
          : isIterable(actual) && Array.from(actual).includes(item);
      check(pass, `to contain ${short(item)}`);
    },
    toContainEqual(item) {
      check(isIterable(actual) && Array.from(actual).some((x) => equals(x, item)), `to contain an item equal to ${short(item)}`);
    },
    toMatch(expected) {
      const pass = typeof actual === "string" && (typeof expected === "string" ? actual.includes(expected) : expected.test(actual));
      check(pass, `to match ${String(expected)}`);
    },
    toHaveLength(length) {
      const got = (actual as { length?: unknown } | null)?.length;
      check(got === length, `to have length ${length} (it has ${short(got)})`);
    },
    toHaveProperty(path) {
      let at: unknown = actual;
      const pass = path.split(".").every((key) => {
        if (typeof at !== "object" || at === null || !(key in at)) return false;
        at = (at as Record<string, unknown>)[key];
        return true;
      });
      check(pass, `to have the property ${path}`);
    },
    toBeDefined() {
      check(actual !== undefined, "to be defined");
    },
    toBeUndefined() {
      check(actual === undefined, "to be undefined");
    },
    toBeNull() {
      check(actual === null, "to be null");
    },
    toBeGreaterThan(n) {
      check(number() > n, `to be greater than ${n}`);
    },
    toBeGreaterThanOrEqual(n) {
      check(number() >= n, `to be at least ${n}`);
    },
    toBeLessThan(n) {
      check(number() < n, `to be less than ${n}`);
    },
    toMatchObject(expected) {
      check(matchesSubset(actual, expected), `to match ${short(expected)}`);
    },
    toThrow(expected) {
      if (typeof actual !== "function") throw new ExpectationError(`expected a function, got ${short(actual)}`, check);
      let thrown: unknown;
      let threw = false;
      try {
        actual();
      } catch (e) {
        threw = true;
        thrown = e;
      }
      const text = thrown instanceof Error ? thrown.message : String(thrown);
      const pass =
        threw && (expected === undefined || (typeof expected === "string" ? text.includes(expected) : expected.test(text)));
      check(pass, expected === undefined ? "to throw" : `to throw ${String(expected)}${threw ? ` (it threw ${short(text)})` : " (it did not throw)"}`);
    },
  };
}

// -- equality, as jest/vitest define it ----------------------------------------------------

/** Deep equality where an undefined-valued key is the same as a missing one, and asymmetric matchers apply. */
function equals(a: unknown, b: unknown): boolean {
  if (isAsymmetric(b)) return b[ASYMMETRIC](a);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equals(x, b[i]));
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = definedKeys(a);
    const kb = definedKeys(b);
    return ka.length === kb.length && ka.every((k) => kb.includes(k) && equals(a[k], b[k]));
  }
  return isDeepStrictEqual(a, b);
}

/** `expected` as a subset of `actual`: every key of `expected` present and equal (recursively). */
function matchesSubset(actual: unknown, expected: unknown): boolean {
  if (isAsymmetric(expected)) return expected[ASYMMETRIC](actual);
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((x, i) => matchesSubset(actual[i], x));
  }
  if (isPlainObject(expected)) {
    if (typeof actual !== "object" || actual === null) return false;
    const a = actual as Record<string, unknown>;
    return Object.keys(expected).every((k) => k in a && matchesSubset(a[k], expected[k]));
  }
  return isDeepStrictEqual(actual, expected);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const definedKeys = (o: Record<string, unknown>): string[] => Object.keys(o).filter((k) => o[k] !== undefined);

const isIterable = (v: unknown): v is Iterable<unknown> =>
  typeof v === "object" && v !== null && typeof (v as { [Symbol.iterator]?: unknown })[Symbol.iterator] === "function";

/** A value for a message: inspected, on one line where it fits, never longer than a screen. */
function short(v: unknown): string {
  const s = inspect(v, { depth: 4, breakLength: 100 });
  return s.length > 300 ? `${s.slice(0, 300)}…` : s;
}
