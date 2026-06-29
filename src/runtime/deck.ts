/**
 * The presentation deck controller (`<document type="presentation">`). A singleton
 * set up once from runtime/index.ts (beside flashHash), it pages through the
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

/** Public handle exposed as `window.Delta.deck` (null when not a deck). Lets
 *  add-ons (e.g. the upcoming progress bar) read position and drive navigation. */
export interface Deck {
  /** Zero-based index of the active slide. */
  readonly index: number;
  /** Total number of slides. */
  readonly total: number;
  /** Activate slide `i` (clamped to range). */
  go(i: number): void;
  next(): void;
  prev(): void;
  /** Page to the slide that holds `#id` (or, for a section, its divider slide).
   *  Returns false if the id isn't found in any slide. */
  goToId(id: string): boolean;
  /** Subscribe to slide changes; fires immediately with the current position. */
  onChange(cb: (index: number, total: number) => void): void;
}

export function setupDeck(): Deck | null {
  const root = document.documentElement;
  if (root.dataset.type !== "presentation") return null;

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

  // Per-slide ordered fragment lists (elements the author marked reveal="true").
  // Effective order = reveal-order if given, else the element's DOM position; a
  // stable sort keeps DOM order as the natural default and the tiebreak, so
  // reveal-order just repositions an element relative to its peers.
  const fragmentsOf = (slide: HTMLElement): HTMLElement[] =>
    [...slide.querySelectorAll<HTMLElement>('[reveal="true"]')]
      .map((el, i) => ({ el, order: el.hasAttribute("reveal-order") ? Number(el.getAttribute("reveal-order")) : i }))
      .sort((a, b) => a.order - b.order)
      .map((x) => x.el);
  const frags = slides.map(fragmentsOf);

  const showFragments = (i: number, count: number): void =>
    frags[i].forEach((el, k) => el.classList.toggle("is-revealed", k < count));

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

  // Switch the active slide. `atEnd` enters it with every fragment already shown
  // (stepping back into a prior slide) vs none (forward / a direct jump).
  const enter = (i: number, atEnd: boolean): void => {
    slides[index]?.classList.remove("is-active");
    index = clamp(i);
    step = atEnd ? frags[index].length : 0;
    showFragments(index, step);
    setProgress();
    slides[index].classList.add("is-active");
    for (const cb of listeners) cb(index, slides.length);
  };

  // Reveal the next fragment; once a slide's fragments are all shown, advance.
  const next = (): void => {
    if (step < frags[index].length) showFragments(index, ++step);
    else if (index < slides.length - 1) enter(index + 1, false);
  };
  // Hide the last fragment; with none left, step back into the prior slide shown.
  const prev = (): void => {
    if (step > 0) showFragments(index, --step);
    else if (index > 0) enter(index - 1, true);
  };
  // Jump straight to a slide (Home/End, external) — fragments reset to hidden.
  const go = (i: number): void => enter(i, false);

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

  // Activate the first slide (fragments hidden, progress filled in from 0).
  enter(0, false);

  return {
    get index() {
      return index;
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
}
