/**
 * The presentation deck controller (`<document type="presentation">`). A singleton
 * set up once from runtime/index.ts (beside flashHash), it pages through the
 * `<delta-slide>` elements: one slide visible at a time, keyboard navigation, and
 * a direction-aware enter transition.
 *
 * Progressive enhancement: it only engages when the document is a presentation and
 * has at least one slide, and it marks the root `.deck-js` — the hide-inactive CSS
 * is gated on that class, so with JS off every slide stays visible and scrollable
 * (the offline fallback). Position/paging is owned here, not the compiler: slides
 * carry no number.
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
  let prevProgress = 0;
  const listeners: ((index: number, total: number) => void)[] = [];

  const clamp = (i: number): number => Math.max(0, Math.min(slides.length - 1, i));

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

  const go = (i: number): void => {
    const next = clamp(i);
    if (next === index && slides[index].classList.contains("is-active")) return;
    slides[index]?.classList.remove("is-active");
    index = next;
    setProgress();
    slides[index].classList.add("is-active");
    for (const cb of listeners) cb(index, slides.length);
  };

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
        go(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
        e.preventDefault();
        go(index - 1);
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

  // Activate the first slide (progress set first so its line fills in from 0).
  setProgress();
  slides[0].classList.add("is-active");

  return {
    get index() {
      return index;
    },
    get total() {
      return slides.length;
    },
    go,
    next: () => go(index + 1),
    prev: () => go(index - 1),
    onChange(cb) {
      listeners.push(cb);
      cb(index, slides.length);
    },
  };
}
