import { elements, type ElementNode, type Node, type Position } from "./ast.ts";
import { warn, type CompileContext, type TeamMember } from "./context.ts";
import { PALETTE } from "../language/palette.ts";

/**
 * `<team>` — the collaborators registry, a direct child of `<document>`:
 *
 *   <team>
 *     <member id="rodrigo" name="Rodrigo Ribeiro" kind="human" color="blue"/>
 *     <member id="claude"  name="Claude"          kind="agent" color="purple"/>
 *   </team>
 *
 * `collectTeam` reads it into `ctx.team` (id → member) and then REMOVES the node from the
 * tree — the data ships in the `#delta-review` island, not as markup (like `<import>`).
 * Every other collaboration pass resolves `by`/`for` against this map, and the runtime
 * colors and badges the author chips from it. `kind` defaults to `human`; `color` is one
 * of base.css's accent palette names and defaults round-robin over the palette, skipping
 * colors members chose explicitly, so two agents never share a hue by accident.
 *
 * On the project path the map is shared across files and a second, identical
 * declaration is silently accepted (each `.dlt` stays independently compilable).
 */

const KINDS = new Set(["human", "agent"]);

export function collectTeam(doc: ElementNode, ctx: CompileContext): void {
  const teams: ElementNode[] = [];
  for (const el of elements(doc)) {
    if (el.tag !== "team" || el === doc) continue;
    if (doc.children.includes(el)) teams.push(el);
    else warn(ctx, "<team> must be a direct child of <document>; ignored", el.pos);
  }
  if (teams.length === 0) return;

  const members = teams.flatMap((team) => team.children).flatMap((m) => readMember(m, ctx) ?? []);
  // Colors already spoken for: earlier files' members plus every explicit choice here.
  const pick = colorPicker([
    ...[...ctx.team.values()].map((m) => m.color),
    ...members.flatMap((m) => m.color ?? []),
  ]);

  for (const m of members) {
    const prev = ctx.team.get(m.id);
    if (prev) {
      // A project re-declares the team in every file: identical → fine; different → warn.
      if (
        prev.name !== m.name ||
        prev.kind !== m.kind ||
        (m.color !== undefined && prev.color !== m.color)
      ) {
        warn(
          ctx,
          `duplicate <member id="${m.id}"> with different attributes; keeping the first`,
          m.pos,
        );
      }
      continue;
    }
    ctx.team.set(m.id, { id: m.id, name: m.name, kind: m.kind, color: m.color ?? pick() });
  }

  doc.children = doc.children.filter((c) => !(c.type === "element" && c.tag === "team"));
}

/** A `<member>` as written, validated: `color` is a palette name or absent. */
type MemberDecl = Omit<TeamMember, "color"> & { color?: string; pos?: Position };

/** Reads one child of `<team>`; warns and returns undefined for anything that is not a valid member. */
function readMember(m: Node, ctx: CompileContext): MemberDecl | undefined {
  if (m.type !== "element") return undefined;
  if (m.tag !== "member") {
    warn(ctx, `unexpected <${m.tag}> inside <team> (only <member> is allowed); ignored`, m.pos);
    return undefined;
  }
  const id = m.attrs.id?.trim();
  const name = m.attrs.name?.trim();
  if (!id || !name) {
    warn(ctx, "<member> needs both an id and a name; skipped", m.pos);
    return undefined;
  }
  let kind = m.attrs.kind ?? "human";
  if (!KINDS.has(kind)) {
    warn(
      ctx,
      `<member id="${id}"> has unknown kind "${kind}" (expected human or agent); using human`,
      m.pos,
    );
    kind = "human";
  }
  let color: string | undefined = m.attrs.color;
  if (color !== undefined && !PALETTE.includes(color)) {
    warn(
      ctx,
      `<member id="${id}"> has unknown color "${color}" (expected one of ${PALETTE.join(", ")})`,
      m.pos,
    );
    color = undefined;
  }
  return { id, name, kind: kind as TeamMember["kind"], color, pos: m.pos };
}

/** Hands out palette colors in order, skipping `taken`; wraps around when there are more members than hues. */
function colorPicker(taken: string[]): () => string {
  const used = new Set(taken);
  let cursor = 0;
  return () => {
    for (let i = 0; i < PALETTE.length; i++) {
      const c = PALETTE[(cursor + i) % PALETTE.length];
      if (!used.has(c)) {
        cursor = (cursor + i + 1) % PALETTE.length;
        used.add(c);
        return c;
      }
    }
    return PALETTE[cursor++ % PALETTE.length];
  };
}
