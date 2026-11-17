/**
 * How far a result can be trusted, in increasing order. The proof graph propagates it
 * (a result is only as trusted as the weakest thing its proof uses), the proof map
 * colours by it, and `delta verify` refuses to verify what rests on something weaker.
 */
export const TRUST = ["open", "heuristic", "sketch", "verified", "formalized"] as const;
export type Trust = (typeof TRUST)[number];

export const trustRank = (t: Trust): number => TRUST.indexOf(t);
export const weaker = (a: Trust, b: Trust): Trust => (trustRank(a) <= trustRank(b) ? a : b);

/**
 * The `status` a block may carry → its trust. The collaboration vocabulary maps in
 * (`draft` reads as heuristic, `review` as sketch). Its keys are the whole `status`
 * vocabulary of a block (results also accept `open`). A proof without a status is a
 * sketch: trust is declared, never assumed.
 */
export const TRUST_OF: Readonly<Record<string, Trust>> = {
  draft: "heuristic",
  heuristic: "heuristic",
  sketch: "sketch",
  review: "sketch",
  verified: "verified",
  formalized: "formalized",
};

/**
 * The `status` the compiler itself writes on a proof whose verification no longer holds: the
 * mathematics changed since it was checked (graph.ts, `markStale`). It reads as a sketch, and
 * the page shows the verification stamp struck through (runtime/status.ts). Not an author
 * value, so it is not in TRUST_OF.
 */
export const STALE_STATUS = "stale";

/** True for a `status` that says someone checked the block (`verified` or `formalized`). */
export function isChecked(status: string | undefined): boolean {
  const trust = status === undefined ? undefined : TRUST_OF[status];
  return trust !== undefined && trustRank(trust) >= trustRank("verified");
}
