/**
 * The presentation deck controller (`<document type="presentation">`). A singleton
 * set up once from runtime/index.ts, it pages through the
 * `<delta-slide>` elements: one slide visible at a time (fading in), keyboard
 * navigation, and step-by-step reveal of fragments (elements marked reveal="true")
 * within a slide before advancing to the next.
 *
 * Progressive enhancement: it only engages when the document is a presentation and
 * has at least one slide, and it marks the root `.deck-js` — the hide-inactive and
 * hide-fragment CSS are gated on that class, so with JS off every slide and fragment
 * stays visible and scrollable (the offline fallback). Position/paging is owned here,
 * not the compiler: slides carry no number.
 */

import { t } from "./i18n.ts";
import { button } from "./dom.ts";

/** What the deck needs from an `<animation>` board (elements/animation.ts provides it). */
interface Board extends HTMLElement {
  /** Steps on the board. */
  readonly length: number;
  /** True when the board's first step is empty, so a slide shows it blank before step 1. */
  readonly startsBlank: boolean;
  /** Shows step `pos`, animating the change when `animate`. */
  seek(pos: number, animate?: boolean): Promise<void>;
}

/** Public handle exposed as `window.Delta.deck` (null when not a deck). Lets
 *  add-ons (e.g. the upcoming progress bar) read position and drive navigation. */
export interface Deck {
  /** Zero-based index of the active slide. */
  readonly index: number;
  /** Fragments revealed on the active slide. */
  readonly step: number;
  /** Total number of slides. */
  readonly total: number;
  /** Activate slide `i` (clamped to range) with `step` fragments shown (default none). */
  go(i: number, step?: number): void;
  next(): void;
  prev(): void;
  /** Page to the slide that holds `#id` (or, for a section, its divider slide).
   *  Returns false if the id isn't found in any slide. */
  goToId(id: string): boolean;
  /** Subscribe to position changes (a new slide or a fragment step); fires immediately
   *  with the current position. */
  onChange(cb: (index: number, total: number) => void): void;
}

/** The deck, once `setupDeck` has built one; null off-deck. Runtime code asks here, not
 *  `window.Delta`, which is the surface for packs. */
export function getDeck(): Deck | null {
  return current;
}
let current: Deck | null = null;

export function setupDeck(): Deck | null {
  const root = document.documentElement;
  if (root.dataset.type !== "presentation") return null; // exposes the deck only for presentation docs

  const slides = [...document.querySelectorAll<HTMLElement>("delta-slide")];
  if (slides.length === 0) return null;

  root.classList.add("deck-js");

  // Opt-in progress bar: the author drops a <progress/> marker; it renders nothing
  // itself (hidden by CSS) but turns on the per-slide title/body separator line,
  // whose fill reads the --deck-progress variable we set below.
  if (document.querySelector("delta-progress")) root.classList.add("deck-progress-on");

  let index = 0;
  let step = 0; // fragments revealed in the current slide
  let prevProgress = 0;
  const listeners: ((index: number, total: number) => void)[] = [];

  const clamp = (i: number): number => Math.max(0, Math.min(slides.length - 1, i));

  // An <animation> board on a slide steps with the deck: each of its steps is one advance.
  const isBoard = (el: Element): el is Board => el.localName === "delta-animation";
  // Steps a board shows without an advance: its first one comes with the slide, unless the
  // board is itself a fragment (its reveal then plays that step) or opens with a <pause/>.
  const given = (board: Board): number =>
    board.matches('[reveal="true"]') || board.startsBlank ? 0 : Math.min(1, board.length);

  // Per-slide ordered fragment lists (elements the author marked reveal="true", and
  // boards). Effective order = reveal-order if given, else the element's DOM position; a
  // stable sort keeps DOM order as the natural default and the tiebreak, so
  // reveal-order just repositions an element relative to its peers. A board appears in
  // the list once per step the reader advances through.
  const fragmentsOf = (slide: HTMLElement): HTMLElement[] =>
    [...slide.querySelectorAll<HTMLElement>('[reveal="true"], delta-animation')]
      .map((el, i) => ({
        el,
        order: el.hasAttribute("reveal-order") ? Number(el.getAttribute("reveal-order")) : i,
      }))
      .sort((a, b) => a.order - b.order)
      .flatMap(({ el }) =>
        isBoard(el) ? Array<HTMLElement>(el.length - given(el)).fill(el) : [el],
      );
  const frags = slides.map(fragmentsOf);

  // `animate`: the reader advanced, so a board plays the step it gains instead of jumping.
  const showFragments = (i: number, count: number, animate = false): void => {
    const steps = new Map<Board, number>();
    for (const board of slides[i].querySelectorAll<Board>("delta-animation")) {
      steps.set(board, given(board));
    }
    frags[i].forEach((el, k) => {
      if (!isBoard(el)) el.classList.toggle("is-revealed", k < count);
      else if (k < count) steps.set(el, steps.get(el)! + 1);
    });
    for (const [board, pos] of steps) {
      if (board.matches('[reveal="true"]')) board.classList.toggle("is-revealed", pos > 0);
      void board.seek(pos, animate);
    }
  };

  // Fraction of the deck reached (slide 1 of 4 → 0.25, last slide → 1), published
  // alongside the previous fraction so the active slide's line can animate from
  // where it was to where it is. One global pair on the root feeds whichever slide
  // is visible. Set *before* activating the slide so its keyframe reads both ends.
  const setProgress = (): void => {
    const frac = (index + 1) / slides.length;
    root.style.setProperty("--deck-progress-prev", String(prevProgress));
    root.style.setProperty("--deck-progress", String(frac));
    prevProgress = frac;
  };

  const notify = (): void => {
    for (const cb of listeners) cb(index, slides.length);
  };

  // Show `count` fragments of the active slide (clamped to how many it has).
  const setStep = (count: number, animate = false): void => {
    step = Math.max(0, Math.min(frags[index].length, count));
    showFragments(index, step, animate);
    notify();
  };

  // Switch the active slide, entering it with `count` fragments shown: none going
  // forward or jumping, all (Infinity) when stepping back into a prior slide. Entering by
  // an advance (`animate`), the slide's boards start from nothing and write their first step.
  const enter = (i: number, count: number, animate = false): void => {
    slides[index]?.classList.remove("is-active");
    index = clamp(i);
    setProgress();
    slides[index].classList.add("is-active");
    if (animate) {
      for (const board of slides[index].querySelectorAll<Board>("delta-animation")) {
        void board.seek(0);
      }
    }
    setStep(count, animate);
  };

  // Reveal the next fragment; once a slide's fragments are all shown, advance.
  const next = (): void => {
    if (step < frags[index].length) setStep(step + 1, true);
    else if (index < slides.length - 1) enter(index + 1, 0, true);
  };
  // Hide the last fragment; with none left, step back into the prior slide shown.
  const prev = (): void => {
    if (step > 0) setStep(step - 1);
    else if (index > 0) enter(index - 1, Infinity);
  };
  // Jump straight to a slide (Home/End, a link, the URL) — fragments hidden unless given.
  const go = (i: number, count = 0): void => enter(i, count);

  // Keyboard navigation: ←/↑/PageUp back, →/↓/PageDown/Space forward, Home/End ends.
  // Ignored while typing into a field so embedded widgets keep their keys.
  document.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
      case " ":
        e.preventDefault();
        next();
        break;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
        e.preventDefault();
        prev();
        break;
      case "Home":
        e.preventDefault();
        go(0);
        break;
      case "End":
        e.preventDefault();
        go(slides.length - 1);
        break;
    }
  });

  // Overlay touch controls — a deck must be navigable without a keyboard. A subtle
  // prev / next cluster (CSS: bottom-center, brighter on hover/touch) plus
  // swipe. Buttons reuse the fragment-aware next/prev, so taps behave like the keys.
  const navBtn = (cls: string, glyph: string, label: string, fn: () => void): HTMLButtonElement => {
    const b = button(`deck-nav ${cls}`, glyph);
    b.setAttribute("aria-label", label);
    b.addEventListener("click", fn);
    return b;
  };
  const controls = document.createElement("div");
  controls.className = "deck-controls";
  controls.append(
    navBtn("deck-prev", "‹", t("prevSlide", "Previous slide"), prev),
    navBtn("deck-next", "›", t("nextSlide", "Next slide"), next),
  );
  document.body.append(controls);

  // Swipe left/right to navigate. Passive (never blocks scroll); the horizontal-
  // dominance check keeps a vertical scroll of a tall slide from paging.
  let sx = 0;
  let sy = 0;
  document.addEventListener(
    "touchstart",
    (e) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    },
    { passive: true },
  );
  document.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
    },
    { passive: true },
  );

  // Running header — a subtle "AUTHOR · AFFILIATION" eyebrow at the top edge, built
  // from the <cover> metadata already in the DOM (no compiler work). The talk title
  // is left out on purpose: it can be long and clutter the header. Styled by
  // components/slide.css; faded out on the cover (redundant) and on the inverted
  // dividers via the .topbar-hidden class the listener below toggles.
  const coverText = (tag: string): string =>
    document.querySelector(`delta-slide[cover="true"] ${tag}`)?.textContent?.trim() ?? "";
  const span = (cls: string, txt: string): HTMLElement => {
    const el = document.createElement("span");
    el.className = cls;
    el.textContent = txt;
    return el;
  };
  const author = coverText("delta-author");
  const affiliation = coverText("delta-affiliation");
  const parts = [
    ...(author ? [span("tb-author", author)] : []),
    ...(affiliation ? [span("tb-affiliation", affiliation)] : []),
  ];
  if (parts.length) {
    const topbar = document.createElement("div");
    topbar.className = "deck-topbar eyebrow";
    parts.forEach((el, i) => {
      if (i > 0) topbar.append(" · ");
      topbar.append(el);
    });
    document.body.append(topbar);
    listeners.push((i) =>
      topbar.classList.toggle(
        "topbar-hidden",
        slides[i].matches('[cover="true"], [divider="true"]'),
      ),
    );
  }

  // Activate the first slide (fragments hidden, progress filled in from 0). The
  // address (address.ts) may page elsewhere right after.
  enter(0, 0);

  current = {
    get index() {
      return index;
    },
    get step() {
      return step;
    },
    get total() {
      return slides.length;
    },
    go,
    next,
    prev,
    goToId(id) {
      const el = document.getElementById(id);
      if (!el) return false;
      // An element inside a slide → that slide. A section is display:contents and
      // holds the divider + its child slides, so it has no enclosing slide — use its
      // first slide descendant (the divider).
      const slide = el.closest("delta-slide") ?? el.querySelector("delta-slide");
      const i = slide ? slides.indexOf(slide as HTMLElement) : -1;
      if (i < 0) return false;
      go(i);
      return true;
    },
    onChange(cb) {
      listeners.push(cb);
      cb(index, slides.length);
    },
  };
  return current;
}
