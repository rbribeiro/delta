/**
 * What `delta agent-guide` prints: the conventions an agent needs to work on a Delta proof
 * with a human, in one screen. Plain text, English (like every CLI message), no I/O, so a
 * test can hold it to the commands that really exist. The same workflow is written up for
 * people in site/colaboracao.dlt ("Trabalhando com um agente").
 */
export const AGENT_GUIDE = `DELTA AGENT GUIDE: working on a proof with a human

THE MODEL
A proof is a graph of results. The nodes are theorems, lemmas, propositions, corollaries,
conjectures, claims and definitions that have an id. There is an edge u -> v when the
statement or the proof of v refers to u (<ref to="u"/>, or \\ref{u} in math). A ref to an
equation counts for the result that contains it. Refs inside <intuition>, <strategy> and
<obstacle> are commentary and create no edge.

Trust: open < heuristic < sketch < verified < formalized. A result's own trust is its
proof's status (open when it has no proof). Its effective trust is the weakest of its own
and that of everything it uses. Only a human's \`delta verify\` makes a proof verified. The
verification is pinned to a hash of the statement, the proof and the statements it uses;
change any of them and it goes stale.

THE WORKFLOW
1. Agree on the architecture first. Give the main theorem a <strategy>. Add each planned
   lemma as a stub with status="open": its statement, no proof. Put
   <proof-map of="thm:main"/> near the theorem so everyone sees the plan.
2. Pick work: delta graph --frontier --json
   These results need a proof (or have a sketch) and rest on nothing weaker than a sketch.
3. Read only what you need: delta show <id> --context
   You get the result and the statements (not the proofs) of what it uses.
4. Write <proof of="<id>" status="sketch" by="<your id>">...</proof>.
   Use only the statements you were shown. If you need a fact that is not among them, do
   not prove it inline: add a lemma stub with status="open", ref it, and it becomes new
   work for the next round.
5. Check: delta lint must exit 0. Fix cycles, dangling refs and misplaced elements, and
   read the warnings (unused hypotheses, unproved steps).
6. A human reviews and runs delta verify <id> --by <name>. Never write status="verified",
   verified-by= or against= yourself.
7. Repeat until delta outline shows the main theorem as [verified].

WRITING A RESULT
- Ids: kind:short-name, for example lem:coupling, thm:main, hyp:supercrit, st:bound.
- Put each hypothesis of a statement in <hyp id="...">...</hyp>, and ref it in the step
  that uses it. lint warns about hypotheses the proof never uses. Show why one is needed
  with <counterexample breaks="hyp:...">.
- Long proofs go in steps, nested as deep as needed:
    <step id="st:1"><claim>...</claim><proof>...</proof></step>
- Inside the result: <intuition> (why it is true), <strategy> (how the proof goes),
  <obstacle> (where it is hard). A <step> may carry its own, after its <claim>. A
  non-rigorous argument is a <proof status="heuristic">, never a verified one.
- Write <proof of="id">. A proof without of proves the result right before it, which
  breaks silently if text lands in between.
- Math: $...$ inline, $$...$$ or <equation id="..."> for display. Inside math write a bare
  < and &, never &lt;. A literal dollar is \\$; a lone $ is a compile error.

COLLABORATING
- Sign everything you write with by="<your id>". If the document has a <team>, use your
  <member> id there.
- Never rewrite someone else's text silently. Wrap the edit:
  <change by="..."><old>...</old><new>...</new></change>
- Ask where the question applies: <comment by="...">. Request work with <todo for="...">.
- Changing a statement makes every verification that depends on it stale. delta lint
  lists them; say why in a <comment>.
- Read the review state with delta review --json. Do not parse the HTML.

COMMANDS (every one accepts --json; the input defaults to ./project.toml)
  delta outline                  sections and results, with own -> effective trust
  delta show <id> [--context]    the exact source; --context adds what it may use
  delta uses <id>                everything downstream of a result
  delta graph [--frontier]       the whole graph, or the work available now
  delta lint                     problems with the structure; exit 1 when there is an error
  delta review                   comments, tasks, changes and statuses
  delta verify <id> --by <name>  for humans only: sign a proof as verified
Exit codes: 0 means success; 1 means a problem (lint errors, an unknown id, a file that
will not load).
`;
