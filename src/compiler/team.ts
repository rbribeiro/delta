import { elements, type ElementNode } from "./ast";
import { warn, type CompileContext, type TeamMember } from "./context";

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

/** base.css accent palette names, in the order auto-assigned to color-less members. */
export const PALETTE = [
  "blue", "purple", "orange", "teal", "pink", "green",
  "red", "indigo", "sky", "lime", "yellow", "slate",
];

const KINDS = new Set(["human", "agent"]);

export function collectTeam(doc: ElementNode, ctx: CompileContext): void {
  const teams: ElementNode[] = [];
  for (const el of elements(doc)) {
    if (el.tag !== "team" || el === doc) continue;
    if (doc.children.includes(el)) teams.push(el);
    else warn(ctx, "<team> must be a direct child of <document>; ignored", el.pos);
  }
  if (teams.length === 0) return;

  // Colors already spoken for: earlier files' members plus every explicit choice here.
  const taken = new Set<string>([...ctx.team.values()].map((m) => m.color));
  for (const team of teams) {
    for (const m of team.children) {
      if (m.type === "element" && m.tag === "member" && m.attrs.color && PALETTE.includes(m.attrs.color)) {
        taken.add(m.attrs.color);
      }
    }
  }
  let cursor = 0;
  const pick = (): string => {
    for (let i = 0; i < PALETTE.length; i++) {
      const c = PALETTE[(cursor + i) % PALETTE.length];
      if (!taken.has(c)) {
        cursor = (cursor + i + 1) % PALETTE.length;
        taken.add(c);
        return c;
      }
    }
    return PALETTE[cursor++ % PALETTE.length]; // more members than hues: wrap around
  };

  for (const team of teams) {
    for (const m of team.children) {
      if (m.type !== "element") continue;
      if (m.tag !== "member") {
        warn(ctx, `unexpected <${m.tag}> inside <team> (only <member> is allowed); ignored`, m.pos);
        continue;
      }
      const id = m.attrs.id?.trim();
      const name = m.attrs.name?.trim();
      if (!id || !name) {
        warn(ctx, "<member> needs both an id and a name; skipped", m.pos);
        continue;
      }
      let kind = m.attrs.kind ?? "human";
      if (!KINDS.has(kind)) {
        warn(ctx, `<member id="${id}"> has unknown kind "${kind}" (expected human or agent); using human`, m.pos);
        kind = "human";
      }
      let color: string | undefined = m.attrs.color;
      if (color !== undefined && !PALETTE.includes(color)) {
        warn(ctx, `<member id="${id}"> has unknown color "${color}" (expected one of ${PALETTE.join(", ")})`, m.pos);
        color = undefined;
      }
      const prev = ctx.team.get(id);
      if (prev) {
        // A project re-declares the team in every file: identical → fine; different → warn.
        if (prev.name !== name || prev.kind !== kind || (color !== undefined && prev.color !== color)) {
          warn(ctx, `duplicate <member id="${id}"> with different attributes; keeping the first`, m.pos);
        }
        continue;
      }
      ctx.team.set(id, { id, name, kind: kind as TeamMember["kind"], color: color ?? pick() });
    }
  }

  doc.children = doc.children.filter((c) => !(c.type === "element" && c.tag === "team"));
}
