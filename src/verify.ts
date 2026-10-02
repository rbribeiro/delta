import { readFileSync, writeFileSync } from "node:fs";
import type { SourceSpan } from "./compiler/ast";
import type { ProofGraph } from "./compiler/graph";
import { escapeAttr } from "./compiler/preprocess";
import { trustRank } from "./language/trust";

/**
 * `delta verify`: sign a result's proof as checked. Its one edit sets attributes on the
 * proof's opening tag, in place, leaving every other byte of the file as the author wrote
 * it. It is the only command that writes a `.dlt`; everything else about a proof is edited
 * by hand (or by an agent) as text.
 */

/**
 * `text` with the opening tag at `span` rewritten: each attribute in `attrs` replaces the
 * existing value (either quote style), or is appended at the end of the tag.
 */
export function setAttributes(text: string, span: SourceSpan, attrs: Record<string, string>): string {
  let tag = text.slice(span.start, span.inner);
  for (const [name, value] of Object.entries(attrs)) {
    const quoted = `"${escapeAttr(value)}"`;
    const existing = new RegExp(`(\\s${name}\\s*=\\s*)("[^"]*"|'[^']*')`);
    if (existing.test(tag)) {
      tag = tag.replace(existing, (_m, lead: string) => lead + quoted);
    } else {
      // Before the closing `>` (or `/>`), keeping any whitespace (a multi-line tag stays multi-line).
      const close = tag.endsWith("/>") ? "/>" : ">";
      const body = tag.slice(0, -close.length);
      const kept = body.trimEnd();
      tag = `${kept} ${name}=${quoted}${body.slice(kept.length)}${close}`;
    }
  }
  return text.slice(0, span.start) + tag + text.slice(span.inner);
}

/** What `delta verify` did: the result signed, the hash it is pinned to, where the proof is. */
export interface Verification {
  id: string;
  against: string;
  verifiedBy?: string;
  file: string;
  /** Line of the proof's opening `<`. */
  line: number;
  /** Signed anyway, but worth saying: several proofs, or an ancestor not yet verified. */
  warnings: string[];
}

/**
 * A human's sign-off on the result `id`: its (first) proof gets `status="verified"`,
 * `verified-by` (when `by` is given) and `against`, the hash of what was checked (its
 * statement, its proof, and the statements it uses; see graph-hash.ts), written into the
 * source file in place. Editing any of those later makes the verification stale.
 *
 * Verifying on top of an unverified result is allowed (the check is still true) with a
 * warning: the effective status stays lower until the base is verified too. Returns the
 * reason instead when there is nothing to sign: an unknown id, a definition, no proof.
 */
export function verify(graph: ProofGraph, id: string, by?: string): Verification | { error: string } {
  const node = graph.nodes.get(id);
  if (!node) return { error: graph.byId.has(id) ? `"${id}" is not a result` : `no element with id "${id}"` };
  if (node.tag === "definition") return { error: `${id} is a definition: there is nothing to verify` };
  const proof = node.proofs[0];
  if (!proof) return { error: `${id} has no proof yet` };
  if (!proof.src) return { error: `cannot locate the proof of ${id} in its source` };

  const warnings: string[] = [];
  if (node.proofs.length > 1) warnings.push(`${id} has ${node.proofs.length} proofs; verifying the first`);
  for (const p of node.parents) {
    const up = graph.nodes.get(p)!;
    if (trustRank(up.eff) < trustRank("verified")) {
      warnings.push(`${id} uses ${p}, which is ${up.eff}: its effective status stays ${up.eff} until that is verified`);
    }
  }

  const attrs: Record<string, string> = { status: "verified", ...(by ? { "verified-by": by } : {}), against: node.hash };
  const { file, start } = proof.src;
  const text = readFileSync(file, "utf8");
  writeFileSync(file, setAttributes(text, proof.src, attrs));
  // The edit is inside the opening tag, so the lines before it are unchanged.
  const line = text.slice(0, start).split("\n").length;
  return { id, against: node.hash, ...(by ? { verifiedBy: by } : {}), file, line, warnings };
}
