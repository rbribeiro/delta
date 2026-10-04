import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { ElementNode } from "./ast.ts";
import type { GraphNode, ProofGraph } from "./graph.ts";
import { AID_TAGS, PROOF_TAGS, RESULT_TAGS } from "../language/tags.ts";
import { collapseSpace } from "./paper.ts";

/**
 * The hash `delta verify` pins a verification to (`against="<hash>"` on the proof). The
 * graph recomputes it on every build; when it no longer matches, the verification is stale
 * and the proof counts as a sketch again. What goes in decides what "changing the proof"
 * means, so it is spelled out here and nowhere else.
 */

/** Hash length in hex characters: short enough to read, long enough never to collide by accident. */
const HASH_LENGTH = 12;

/**
 * What a verification of `n` vouches for: its statement, its (first) proof, and the
 * statements of the results it uses, each tagged with its id. Deliberately not the
 * parents' proofs: re-proving a lemma does not disturb what uses it, but changing what
 * the lemma *says* does. See `normalizedContent` for what counts as a change.
 */
export function checkedHash(graph: ProofGraph, n: GraphNode): string {
  const parts = [
    ["statement", normalizedContent(graph, n.el)],
    ["proof", n.proofs[0] ? normalizedContent(graph, n.proofs[0]) : ""],
    ...[...n.parents].sort().map((p) => [p, normalizedContent(graph, graph.nodes.get(p)!.el)]),
  ];
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, HASH_LENGTH);
}

/**
 * Not mathematics, so never part of a hash: the reader aids, a result's display title,
 * and review annotations (a comment on a verified proof must not unverify it).
 */
const UNCHECKED = new Set([...AID_TAGS, "title", "comment", "todo"]);

/**
 * The content of `el` as written (between its tags, so the proof's own `status`, `by` and
 * `against` never count), minus UNCHECKED elements at any depth (and, for a result, the
 * proofs nested in it), with every run of
 * whitespace collapsed: reflowing a paragraph changes nothing, any other edit does. An
 * `<include src>` counts as the included file's text, so editing that file is an edit too.
 */
function normalizedContent(graph: ProofGraph, el: ElementNode): string {
  const span = el.src;
  if (!span || !graph.sources.has(span.file)) return "";
  // Cuts per file: an included child's offsets are in its own file.
  const cuts = new Map<string, [number, number][]>();
  // A proof nested in a result is the proof, not the statement: it has its own part.
  const isStatement = RESULT_TAGS.has(el.tag);
  const collect = (e: ElementNode): void => {
    for (const c of e.children) {
      if (c.type !== "element") continue;
      const cut = UNCHECKED.has(c.tag) || (isStatement && e === el && PROOF_TAGS.has(c.tag));
      if (cut && c.src) {
        const list = cuts.get(c.src.file) ?? [];
        list.push([c.src.start, c.src.end]);
        cuts.set(c.src.file, list);
      } else collect(c);
    }
  };
  collect(el);
  return collapseSpace(sourceText(graph, cuts, span.file, span.inner, span.innerEnd, []));
}

const INCLUDE_TAG = /<include\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/g;

/** `file`'s text in [from, to) minus its cuts, each `<include src>` replaced by that file's text. */
function sourceText(
  graph: ProofGraph,
  cuts: Map<string, [number, number][]>,
  file: string,
  from: number,
  to: number,
  stack: string[],
): string {
  const text = graph.sources.get(file);
  if (text === undefined || stack.includes(file)) return "";
  let out = "";
  let at = from;
  const inRange = (cuts.get(file) ?? [])
    .filter(([s, e]) => s >= from && e <= to)
    .sort((x, y) => x[0] - y[0]);
  for (const [s, e] of inRange) {
    out += text.slice(at, s) + " ";
    at = e;
  }
  out += text.slice(at, to);
  return out.replace(INCLUDE_TAG, (_tag, _q, src: string) => {
    const inc = resolve(dirname(file), src);
    const incText = graph.sources.get(inc);
    return incText === undefined
      ? ""
      : ` ${sourceText(graph, cuts, inc, 0, incText.length, [...stack, file])} `;
  });
}
