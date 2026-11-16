/**
 * Notes: what a lecturer adds to the board by hand. A `<note target="…">` is a mark drawn
 * on its target (a circle, a box, an underline, a strike, an arrow) and, when it has
 * content, a few handwritten words beside it.
 *
 * A mark is an SVG path in the board's overlay, made of a handful of points pushed a
 * little off the ideal shape and joined by a smooth curve: a line that bows, a circle that
 * does not quite close. The pushes come from a seeded generator, so a note is the same
 * note on every load. The label is ordinary HTML in the handwriting face, positioned
 * beside the mark; it is written like any other text.
 *
 * Nothing here is laid out by the page: `place()` measures the target and puts mark and
 * label around it, and is called again whenever the board is repainted.
 */

import { fadeIn, glyphsOf, inked, svg, write, RULES, type Box } from "./ink.ts";

type Point = [x: number, y: number];

/** A small deterministic generator (mulberry32): the same seed draws the same mark. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (v: number): string => v.toFixed(1);

/** A smooth curve through `points` (a Catmull-Rom spline, written as cubic Béziers). */
function curve(points: Point[]): string {
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    d +=
      ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)}` +
      ` ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)}` +
      ` ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** A hand-drawn stroke from `a` to `b`: it bows to one side and wavers a little. */
function stroke(a: Point, b: Point, rnd: () => number, bow = 0.035): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const side = (rnd() - 0.5) * 2 * bow * len;
  const points: Point[] = [a];
  for (const t of [0.3, 0.55, 0.8]) {
    const off = side * Math.sin(Math.PI * t) + (rnd() - 0.5) * 0.012 * len;
    points.push([a[0] + dx * t + nx * off, a[1] + dy * t + ny * off]);
  }
  points.push(b);
  return curve(points);
}

/** An ellipse drawn in one go: it starts top-left, drifts inward, and overshoots its start. */
function loop(box: Box, rnd: () => number): string {
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const rx = (box.right - box.left) / 2;
  const ry = (box.bottom - box.top) / 2;
  const start = -2.5 + (rnd() - 0.5) * 0.4;
  const sweep = 2 * Math.PI + 0.45;
  const n = 16;
  const points: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = 1.04 - 0.07 * t + (rnd() - 0.5) * 0.05;
    const angle = start + sweep * t;
    points.push([cx + rx * r * Math.cos(angle), cy + ry * r * Math.sin(angle)]);
  }
  return curve(points);
}

/** The paths of one mark around `box`, in drawing order, and the box the mark itself fills. */
function draw(
  mark: string,
  box: Box,
  em: number,
  rnd: () => number,
): { paths: string[]; outer: Box } {
  const pad = 0.28 * em;
  const jitter = (): number => (rnd() - 0.5) * 0.12 * em;
  switch (mark) {
    case "circle": {
      // An ellipse through a box's corners is √2 times the box; text rarely fills its corners.
      const w = (box.right - box.left) / 2;
      const h = (box.bottom - box.top) / 2;
      const cx = box.left + w;
      const cy = box.top + h;
      const outer = {
        left: cx - (w * 1.15 + pad * 1.2),
        right: cx + (w * 1.15 + pad * 1.2),
        top: cy - (h * 1.25 + pad),
        bottom: cy + (h * 1.25 + pad),
      };
      return { paths: [loop(outer, rnd)], outer };
    }
    case "box": {
      const o = {
        left: box.left - pad,
        right: box.right + pad,
        top: box.top - pad,
        bottom: box.bottom + pad,
      };
      const over = 0.18 * em; // each side runs a little past its corner, as a ruler-less hand does
      return {
        outer: o,
        // One stroke per side, as rows: top, right, bottom, left.
        // prettier-ignore
        paths: [
          stroke([o.left - over, o.top + jitter()], [o.right + over, o.top + jitter()], rnd, 0.012),
          stroke([o.right + jitter(), o.top - over], [o.right + jitter(), o.bottom + over], rnd, 0.012),
          stroke([o.right + over, o.bottom + jitter()], [o.left - over, o.bottom + jitter()], rnd, 0.012),
          stroke([o.left + jitter(), o.bottom + over], [o.left + jitter(), o.top - over], rnd, 0.012),
        ],
      };
    }
    case "underline": {
      const y = box.bottom + 0.16 * em;
      return {
        outer: { ...box, bottom: y + 0.1 * em },
        paths: [
          stroke(
            [box.left - 0.1 * em, y + jitter()],
            [box.right + 0.15 * em, y + jitter()],
            rnd,
            0.02,
          ),
        ],
      };
    }
    case "cross":
      return {
        outer: box,
        paths: [
          stroke(
            [box.left - 0.15 * em, box.bottom + 0.05 * em],
            [box.right + 0.15 * em, box.top - 0.05 * em],
            rnd,
            0.02,
          ),
        ],
      };
    default:
      return { outer: box, paths: [] }; // an arrow is drawn once the label is placed
  }
}

/** An arrow from `a` to `b`: a bowed shaft, then the two strokes of its head. */
function arrow(a: Point, b: Point, em: number, rnd: () => number): string[] {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const head = 0.42 * em;
  const barb = (turn: number): Point => [
    b[0] - head * Math.cos(angle + turn),
    b[1] - head * Math.sin(angle + turn),
  ];
  return [stroke(a, b, rnd, 0.09), stroke(barb(0.5), b, rnd, 0), stroke(barb(-0.5), b, rnd, 0)];
}

/** Targets whose ink is their text: a mark hugs the glyphs. Anything else is marked by its box. */
const TEXTUAL =
  "[data-delta-part], .katex, .katex-display, .anim-run, delta-equation, delta-equations, delta-math, delta-m";

/** The box a mark goes around, in the overlay's coordinates. */
function targetBox(targets: Element[], layer: SVGGElement): Box | null {
  const origin = layer.ownerSVGElement!.getBoundingClientRect();
  const boxes: Box[] = [];
  const whole = (el: Element): void => {
    const r = el.getBoundingClientRect();
    if (r.width || r.height) {
      boxes.push({
        left: r.left - origin.left,
        top: r.top - origin.top,
        right: r.right - origin.left,
        bottom: r.bottom - origin.top,
      });
    }
  };
  for (const el of targets) {
    const textual = el.matches(TEXTUAL) || getComputedStyle(el).display.startsWith("inline");
    const glyphs = textual ? glyphsOf([el], layer) : [];
    if (glyphs.length === 0) {
      whole(el);
      continue;
    }
    for (const g of glyphs) boxes.push(inked(g));
    for (const rule of el.querySelectorAll(RULES)) if (rule.closest(".katex-html")) whole(rule);
  }
  if (boxes.length === 0) return null;
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    top: Math.min(...boxes.map((b) => b.top)),
    right: Math.max(...boxes.map((b) => b.right)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
}

export interface Note {
  /** What the note is made of: its mark, and its label when it has one. Switched on and off together. */
  els: Element[];
  /** Puts mark and label around the target as it is laid out now. */
  place(): void;
  /** Draws the mark, then writes the label. */
  play(proxies: SVGGElement, ms?: number): Animation[];
}

/** How long a mark takes to draw. */
const MARK_MS = 520;

/**
 * Builds the note `source` (a `<delta-note>`) puts on `targets`. Its content becomes the
 * label, in `layers.notes`; its mark is a group of paths in `layers.marks`.
 */
export function makeNote(
  source: Element,
  targets: Element[],
  layers: { marks: SVGGElement; notes: HTMLElement },
  seed: number,
): Note {
  const hasText = (source.textContent ?? "").trim() !== "";
  const mark = source.getAttribute("mark") ?? (hasText ? "arrow" : "circle");
  const side = source.getAttribute("side") ?? "bottom";

  const group = svg("g", { class: "anim-mark" });
  layers.marks.append(group);
  let label: HTMLElement | null = null;
  if (hasText) {
    label = document.createElement("div");
    label.className = "anim-note";
    label.dataset.side = side;
    label.append(...source.childNodes);
    layers.notes.append(label);
  }

  const place = (): void => {
    const box = targetBox(targets, layers.marks);
    if (!box) return; // not laid out (a slide that is not showing): placed when it is
    const em = parseFloat(getComputedStyle(layers.notes).fontSize);
    const rnd = seeded(seed);
    const { paths, outer } = draw(mark, box, em, rnd);

    // The label stands off the mark, on its side; an arrow needs room to be an arrow.
    const gap = mark === "arrow" ? 1.9 * em : 0.45 * em;
    const cx = (outer.left + outer.right) / 2;
    const cy = (outer.top + outer.bottom) / 2;
    const lw = label?.offsetWidth ?? 0;
    const lh = label?.offsetHeight ?? 0;
    const at: Record<string, Point> = {
      bottom: [cx - lw / 2, outer.bottom + gap],
      top: [cx - lw / 2, outer.top - gap - lh],
      right: [outer.right + gap, cy - lh / 2],
      left: [outer.left - gap - lw, cy - lh / 2],
    };
    const [x, y] = at[side] ?? at.bottom;
    if (label) {
      label.style.left = `${f(x)}px`;
      label.style.top = `${f(y)}px`;
    }

    if (mark === "arrow") {
      // From the label's near edge (or from where it would be) to just short of the target.
      const off = 0.25 * em;
      // One row per side: [from, to].
      // prettier-ignore
      const ends: Record<string, [Point, Point]> = {
        bottom: [[cx + 0.6 * em, y - off], [cx, outer.bottom + off]],
        top: [[cx + 0.6 * em, y + lh + off], [cx, outer.top - off]],
        right: [[x - off, cy + 0.4 * em], [outer.right + off, cy]],
        left: [[x + lw + off, cy + 0.4 * em], [outer.left - off, cy]],
      };
      const [from, to] = ends[side] ?? ends.bottom;
      paths.push(...arrow(from, to, em, rnd));
    }

    group.replaceChildren(...paths.map((d) => svg("path", { d, pathLength: 1 })));
  };

  return {
    els: label ? [group, label] : [group],
    place,
    play(proxies, ms = MARK_MS) {
      place();
      const strokes = [...group.children];
      const each = ms / Math.max(1, strokes.length);
      const anims: Animation[] = [fadeIn(group, 1)]; // the group shows at once; its strokes draw
      strokes.forEach((path, i) =>
        anims.push(
          path.animate(
            [
              { strokeDasharray: "1 1", strokeDashoffset: 1 },
              { strokeDasharray: "1 1", strokeDashoffset: 0 },
            ],
            { duration: each, delay: i * each, fill: "both", easing: "ease-in-out" },
          ),
        ),
      );
      if (label) anims.push(...write([label], proxies, undefined, ms * 0.7));
      return anims;
    },
  };
}
