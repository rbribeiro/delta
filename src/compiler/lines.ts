/**
 * Line numbers by offset in a text: for diagnostics, `delta show`, `delta verify` and the TOML
 * parser's errors. One definition, so every report counts lines the same way.
 */

export interface LineIndex {
  /** The 1-based line holding the character at `offset`: the newlines before it, plus one. */
  lineOf(offset: number): number;
  /** Where that line starts: just after the last newline before `offset` (0 on line 1). */
  startOf(offset: number): number;
}

/**
 * Indexes the newlines of `text` once; each lookup is then a binary search, so a long file
 * with many lookups (every element of a book) costs nothing.
 */
export function lineIndex(text: string): LineIndex {
  const newlines: number[] = [];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) newlines.push(i);
  /** How many newlines come before `offset`. */
  const before = (offset: number): number => {
    let lo = 0;
    let hi = newlines.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (newlines[mid] < offset) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return {
    lineOf: (offset) => before(offset) + 1,
    startOf: (offset) => {
      const n = before(offset);
      return n === 0 ? 0 : newlines[n - 1] + 1;
    },
  };
}

/** The line of one offset, for a single lookup. */
export function lineOf(text: string, offset: number): number {
  return lineIndex(text).lineOf(offset);
}
