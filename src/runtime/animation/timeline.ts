/**
 * The timeline of an `<animation>` board: what happens, in which order, and how to be at
 * any point of it.
 *
 * The author writes ordinary Delta, in the order it should happen, with `<pause/>` where
 * the reader takes over. `collect` reads that once, in document order, into *parts* (what
 * one press of "next" plays), each a list of *beats* (played one after another), each a
 * list of *actions* (played together).
 *
 * An action never changes the page by itself. It `fold`s a small `State` (which elements
 * are switched off, which attributes were set), and `paint` is the only place that writes a
 * state to the DOM. So being at part k is `paint(stateAt(k))`: going back, reloading,
 * printing and reduced motion are all the same code path, and an animation is only a
 * decoration played on the way from one state to the next.
 *
 * Everything is laid out in its final place from the start; switched-off elements are
 * `visibility: hidden` (`.anim-off`), so the board never reflows.
 */

import { ACTION_TAGS } from "../../language/tags.ts";
import { fadeIn, fadeOut, morph, write } from "./ink.ts";
import { makeNote, type Note } from "./marks.ts";

/** What the board shows at one moment. Pure data. */
export interface State {
  /** Elements that are switched off (hidden, but keeping their place). */
  off: Set<Element>;
  /** Attribute values written by `<set>`, per element. */
  attr: Map<Element, Record<string, string>>;
}

/** Where animations draw. */
export interface Stage {
  /** The board: the positioned box the overlay covers. */
  board: HTMLElement;
  /** Overlay group for the marks of notes (they stay as long as their note does). */
  marks: SVGGElement;
  /** Layer over the board for the labels of notes. */
  notes: HTMLElement;
  /** Overlay group for glyph proxies (emptied after every beat). */
  proxies: SVGGElement;
}

export interface Action {
  /** Applies this action to `s`: the state once it has happened. Touches no DOM. */
  fold(s: State): void;
  /** Plays the way there, starting from `s` (the state before). Optional: no motion, no method. */
  play?(s: State, stage: Stage): Animation[];
}
/** Actions played together. */
export type Beat = Action[];
/** Beats played in sequence; the reader presses once per part. */
export type Part = Beat[];

export interface Timeline {
  parts: Part[];
  /** The state before anything has happened. */
  initial: State;
  /** Every element some action switches on or off: what `paint` keeps in step. */
  tracked: Set<Element>;
  /** A formula written in pieces → its first piece (its number shows with that piece). */
  hosts: Map<Element, Element[]>;
  /** The board opens with a `<pause/>`: nothing is on it until the reader's first press. */
  startsBlank: boolean;
  /** The notes on the board: placed around their targets at every paint. */
  notes: Note[];
}

/** Tags a board walks into instead of showing whole: something inside them is a step. */
const SPLITTERS = [...ACTION_TAGS].map((tag) => `delta-${tag}`).join(", ") + ", [data-delta-pause]";

/** Formula hosts, and the bare KaTeX of a `$…$` / `$$…$$` in prose. */
const MATH = "delta-equation, delta-equations, delta-math, delta-m, .katex-display, .katex";

/** `duration="1.5s"`, `"800ms"` or a bare number of seconds → milliseconds; undefined when absent or unreadable. */
export function duration(el: Element, attr = "duration"): number | undefined {
  const m = /^\s*(\d*\.?\d+)\s*(ms|s)?\s*$/.exec(el.getAttribute(attr) ?? "");
  if (!m) return undefined;
  return Number(m[1]) * (m[2] === "ms" ? 1 : 1000);
}

/**
 * Splits a formula at its `\pause` markers. Only markers at the top level of the formula
 * count, plus those at the top level of an `aligned` cell (cells are taken row by row):
 * inside a fraction, a root or a script KaTeX's DOM is not in reading order, so "what comes
 * after the marker" has no meaning there. Each segment is the list of KaTeX nodes to show.
 */
export function mathSegments(html: Element): Element[][] {
  const segments: Element[][] = [[]];
  const walk = (nodes: Iterable<Element>): void => {
    for (const el of nodes) {
      if (el.hasAttribute("data-delta-pause")) segments.push([]);
      else if (el.matches(".base, .enclosing") && el.querySelector("[data-delta-pause]"))
        walk(el.children);
      else if (isTable(el) && el.querySelector("[data-delta-pause]")) {
        for (const cell of cellsRowMajor(el.firstElementChild!)) walk(cell.children);
      } else segments[segments.length - 1].push(el);
    }
  };
  walk(html.children);
  return segments.filter((seg) => seg.length > 0);
}

/** KaTeX wraps an `aligned` (or any array) in a lone `.mord > .mtable`. */
function isTable(el: Element): boolean {
  return (
    el.matches(".mord") && el.children.length === 1 && el.firstElementChild!.matches(".mtable")
  );
}

/** The cells of a KaTeX table in reading order. KaTeX stores them column by column. */
function cellsRowMajor(table: Element): Element[] {
  const columns = [...table.children]
    .filter((col) => /\bcol-align-/.test(col.className))
    .map((col) => [
      ...col.querySelectorAll(":scope > .vlist-t > .vlist-r:first-child > .vlist > span > .mord"),
    ]);
  const rows = Math.max(0, ...columns.map((col) => col.length));
  const cells: Element[] = [];
  for (let r = 0; r < rows; r++) for (const col of columns) if (col[r]) cells.push(col[r]);
  return cells;
}

/**
 * Reads the board into a timeline, moving what needs moving on the way: loose text is
 * wrapped so it can be switched off, and each `<morph>` form joins the equation it replaces.
 */
export function collect(stage: Stage, boardEnter: string | null): Timeline {
  const { board } = stage;
  const parts: Part[] = [[]];
  const notes: Note[] = [];
  /** A `<note>` that became a mark and a label: actions naming it mean those. */
  const noteEls = new Map<Element, Element[]>();
  const initial: State = { off: new Set(), attr: new Map() };
  const tracked = new Set<Element>();
  const hosts = new Map<Element, Element[]>();
  /** The form of each morphed equation that is on the board at this point of the walk. */
  const forms = new Map<Element, Element>();

  type Sink = (action: Action) => void;
  const beat: Sink = (action) => parts[parts.length - 1].push([action]);

  /** An element that starts switched off and comes in at its turn. */
  const unit = (els: Element[], owner: Element): Action => {
    for (const el of els) {
      tracked.add(el);
      initial.off.add(el);
    }
    const enter = owner.getAttribute("enter") ?? boardEnter ?? defaultEnter(owner);
    const total = duration(owner);
    return {
      fold: (s) => els.forEach((el) => s.off.delete(el)),
      play: (_s, stage) =>
        enter === "write"
          ? write(els, stage.proxies, total)
          : enter === "fade"
            ? els.map((el) => fadeIn(el, total))
            : [],
    };
  };

  /** The element an action names with `target` (and `part`): always something on this board. */
  const targetOf = (action: Element): Element[] => {
    const id = action.getAttribute("target") ?? "";
    const el = id ? board.querySelector(`[id="${CSS.escape(id)}"]`) : null;
    if (!el) {
      console.warn(`<${action.localName.replace("delta-", "")}>: no "${id}" on this board`);
      return [];
    }
    const part = action.getAttribute("part");
    if (!part) return noteEls.get(el) ?? [el];
    // A part is looked up in the form of the equation that is showing at this point.
    const scope = forms.get(el.querySelector(".katex-display") ?? el) ?? el;
    return [...scope.querySelectorAll(`[data-delta-part="${CSS.escape(part)}"]`)];
  };

  const walk = (node: Element, sink: Sink): void => {
    for (const child of [...node.childNodes]) {
      if (child instanceof Text) {
        if (!child.data.trim()) continue;
        const run = document.createElement("span");
        run.className = "anim-run";
        child.replaceWith(run);
        run.append(child);
        sink(unit([run], run));
        continue;
      }
      if (!(child instanceof Element) || child.localName === "br") continue;

      switch (child.localName) {
        case "delta-pause": {
          const ms = duration(child, "for");
          // Timed: a rest inside the step. Bare: the step ends here (not inside <together>).
          if (ms !== undefined)
            sink({ fold: () => {}, play: (_s, stage) => [stage.board.animate([], ms)] });
          else if (sink === beat) parts.push([]);
          continue;
        }
        case "delta-together": {
          const group: Beat = [];
          walk(child, (action) => group.push(action));
          if (group.length) parts[parts.length - 1].push(group);
          continue;
        }
        case "delta-morph": {
          const [target] = targetOf(child);
          const cell = target?.querySelector(".katex-display");
          const to = child.querySelector(".katex-display > .katex");
          if (!cell || !to) continue;
          const from = forms.get(cell) ?? cell.querySelector(":scope > .katex")!;
          // Both forms share one grid cell, on one baseline: the cell is as large as the
          // largest form, so nothing moves when one replaces the other. Inline, because
          // KaTeX's own sheet (unlayered) sets `display` on this element.
          Object.assign((cell as HTMLElement).style, {
            display: "grid",
            alignItems: "baseline",
            justifyItems: "center",
          });
          cell.classList.add("anim-forms");
          cell.append(to);
          forms.set(cell, to);
          tracked.add(from).add(to);
          initial.off.add(to);
          const ms = duration(child);
          sink({
            fold: (s) => {
              s.off.add(from);
              s.off.delete(to);
            },
            play: (_s, stage) => morph(from, to, stage.proxies, ms),
          });
          continue;
        }
        case "delta-note": {
          // Without a target it is a handwritten line in the flow: a piece like any other.
          if (!child.hasAttribute("target")) break;
          const targets = targetOf(child);
          if (!targets.length) continue;
          const ms = duration(child);
          const note = makeNote(child, targets, stage, notes.length + 1);
          notes.push(note);
          noteEls.set(child, note.els);
          for (const el of note.els) {
            tracked.add(el);
            initial.off.add(el);
          }
          sink({
            fold: (s) => note.els.forEach((el) => s.off.delete(el)),
            play: (_s, stage) => note.play(stage.proxies, ms),
          });
          continue;
        }
        case "delta-set": {
          const [target] = targetOf(child);
          if (!target) continue;
          const to: Record<string, string> = {};
          for (const { name, value } of child.attributes) if (!SET_OWN.has(name)) to[name] = value;
          // Where each value starts: what the element has now, before any <set> touched it.
          const start = initial.attr.get(target) ?? {};
          initial.attr.set(target, start);
          for (const name of Object.keys(to)) start[name] ??= target.getAttribute(name) ?? "0";
          const ms = duration(child);
          sink({
            fold: (s) => void Object.assign(s.attr.get(target)!, to),
            play: (s, stage) => [tween(target, { ...s.attr.get(target)! }, to, stage.board, ms)],
          });
          continue;
        }
        case "delta-hide":
        case "delta-show": {
          const els = targetOf(child);
          if (!els.length) continue;
          const on = child.localName === "delta-show";
          const ms = duration(child);
          for (const el of els) tracked.add(el);
          sink({
            fold: (s) => els.forEach((el) => (on ? s.off.delete(el) : s.off.add(el))),
            play: () => els.map((el) => (on ? fadeIn(el, ms) : fadeOut(el, ms))),
          });
          continue;
        }
      }

      // A formula with \pause markers comes in piece by piece.
      const formula = child.matches(MATH) && child.querySelector("[data-delta-pause]");
      if (formula) {
        const html = child.matches(".katex-html") ? child : child.querySelector(".katex-html");
        const segments = html ? mathSegments(html) : [];
        segments.forEach((segment, i) => {
          if (i > 0 && sink === beat) parts.push([]);
          sink(unit(segment, child));
        });
        if (segments.length) hosts.set(child, segments[0]);
        continue;
      }

      // A container holding a step is walked into: its content comes in step by step,
      // inside a frame (a list, a column, a box) that is there from the start.
      if (!child.matches(MATH) && child.querySelector(SPLITTERS)) walk(child, sink);
      else sink(unit([child], child));
    }
  };

  walk(board, beat);
  const startsBlank = parts.length > 1 && parts[0].length === 0;
  return {
    parts: parts.filter((part) => part.length > 0),
    initial,
    tracked,
    hosts,
    startsBlank,
    notes,
  };
}

/** Attributes of a `<set>` that are about the action; every other one is a value to set. */
const SET_OWN = new Set(["target", "duration", "id"]);
/** Default length of a `<set>`. */
const SET_MS = 900;

/**
 * Moves the attributes of `target` from `from` to `to`, frame by frame: the whole protocol
 * of an animated parameter. An element that redraws when its attribute changes (a custom
 * element observing it) animates; nothing else is asked of it. Numbers are interpolated;
 * any other value is simply written when the step lands.
 *
 * Returns the animation that keeps time: when it ends, or is cancelled, the frames stop
 * and the timeline paints the end values.
 */
function tween(
  target: Element,
  from: Record<string, string>,
  to: Record<string, string>,
  board: HTMLElement,
  ms = SET_MS,
): Animation {
  const numeric = Object.keys(to)
    .map((name) => ({ name, a: Number(from[name]), b: Number(to[name]) }))
    .filter(({ a, b }) => Number.isFinite(a) && Number.isFinite(b));
  const clock = board.animate([], { duration: ms, easing: "ease-in-out" });
  const frame = (): void => {
    const progress = clock.effect?.getComputedTiming().progress;
    if (clock.playState !== "running" || progress == null) return;
    for (const { name, a, b } of numeric) {
      target.setAttribute(name, String(Math.round((a + (b - a) * progress) * 1e4) / 1e4));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return clock;
}

/** Text and mathematics are written; anything with a frame of its own (a box, a figure, a table) fades in. */
function defaultEnter(el: Element): string {
  if (el.matches(`${MATH}, .anim-run, li, delta-note`)) return "write";
  return getComputedStyle(el).display.startsWith("inline") ? "write" : "fade";
}

/** How long play-all rests between two parts. */
const REST_MS = 900;

/**
 * Plays a timeline. `pos` is how many parts are showing (0 … length). `seek` moves there:
 * one part forward with `animate` plays it; anything else is painted at once.
 */
export class Player {
  pos: number;
  /** True while play-all is running. */
  playing = false;
  /** Called whenever `pos` or `playing` changes. */
  onChange: () => void = () => {};

  /** Bumped whenever the running animation is abandoned; a run compares it to know. */
  private generation = 0;
  private running: Animation[] = [];
  private readonly timeline: Timeline;
  private readonly stage: Stage;

  constructor(timeline: Timeline, stage: Stage, pos: number) {
    this.timeline = timeline;
    this.stage = stage;
    this.pos = Math.max(0, Math.min(timeline.parts.length, pos));
    this.paint(this.stateAt(this.pos));
  }

  get length(): number {
    return this.timeline.parts.length;
  }

  get startsBlank(): boolean {
    return this.timeline.startsBlank;
  }

  /** The state once the first `k` parts have happened. */
  stateAt(k: number): State {
    const { off, attr } = this.timeline.initial;
    const s: State = {
      off: new Set(off),
      attr: new Map([...attr].map(([el, values]) => [el, { ...values }])),
    };
    for (const part of this.timeline.parts.slice(0, k)) {
      for (const b of part) for (const action of b) action.fold(s);
    }
    return s;
  }

  /** Writes a state to the page. The only place the board's elements change. */
  private paint(s: State): void {
    for (const note of this.timeline.notes) note.place(); // around its target as it is now
    for (const el of this.timeline.tracked) el.classList.toggle("anim-off", s.off.has(el));
    for (const [host, first] of this.timeline.hosts) {
      host.classList.toggle(
        "anim-blank",
        first.every((el) => s.off.has(el)),
      );
    }
    for (const [el, values] of s.attr) {
      for (const [name, value] of Object.entries(values)) el.setAttribute(name, value);
    }
  }

  /** Abandons whatever is playing and shows the board as it is at `pos`. */
  settle(): void {
    this.generation++;
    this.clear();
    this.paint(this.stateAt(this.pos));
  }

  private clear(): void {
    for (const a of this.running) a.cancel();
    this.running = [];
    this.stage.proxies.replaceChildren();
  }

  /**
   * Goes to `pos`. With `animate`, one part forward is played (unless the reader prefers
   * reduced motion); every other move is immediate. Seeking where the board already is, or
   * is heading, does nothing, so a part that is playing is not cut short by a repeat.
   */
  seek(pos: number, animate = false): Promise<void> {
    const k = Math.max(0, Math.min(this.length, pos));
    if (k === this.pos) return Promise.resolve();
    const step =
      animate && k === this.pos + 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.settle(); // a part cut short lands on its end before the next one starts
    if (step) return this.run(k);
    this.pos = k;
    this.paint(this.stateAt(k));
    this.onChange();
    return Promise.resolve();
  }

  /** Plays part `k` (1-based: the part that takes the board from k-1 to k). */
  private async run(k: number): Promise<void> {
    const generation = this.generation;
    const s = this.stateAt(k - 1);
    this.pos = k; // where the board is heading: an interruption settles there
    this.onChange();
    for (const b of this.timeline.parts[k - 1]) {
      this.running = b.flatMap((action) => action.play?.(s, this.stage) ?? []);
      await Promise.allSettled(this.running.map((a) => a.finished));
      if (generation !== this.generation) return; // settled meanwhile
      for (const action of b) action.fold(s);
      this.clear();
      this.paint(s); // same frame as the proxies leaving: the real glyphs take over
    }
  }

  /** Plays every remaining part with a rest between them; from the start when at the end. */
  async play(): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    if (this.pos >= this.length) await this.seek(0);
    this.onChange();
    while (this.playing && this.pos < this.length) {
      const generation = this.generation;
      await this.seek(this.pos + 1, true);
      if (!this.playing || this.pos >= this.length) break;
      if (generation + 1 !== this.generation) break; // the reader moved the board: stop following
      const rest = this.stage.board.animate([], REST_MS);
      this.running.push(rest);
      await rest.finished.catch(() => {});
    }
    this.stop();
  }

  /** Stops play-all; the part that is playing runs to its end. */
  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    this.onChange();
  }
}
