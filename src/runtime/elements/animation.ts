/**
 * <animation> — a board that builds itself up, step by step, the way a lecturer writes.
 *
 *   <animation id="anim:euler">
 *     <caption>…</caption>
 *     <equation id="e">e^{i\pi} \pause + 1 = 0</equation>
 *     <pause/>
 *     <morph target="e">e^{i\pi} = -1</morph>
 *   </animation>
 *
 * The content is ordinary Delta, laid out in its final place; it appears in document
 * order and `<pause/>` (or `\pause` inside a formula) hands over to the reader. This
 * element only builds the frame, the caption and the controls; what happens when is read
 * by `collect` and played by `Player` (runtime/animation/timeline.ts).
 *
 * In an article the board rests on its final state, as a figure would, and the controls
 * replay it. On a slide it has no frame and no controls: the deck's own keys step through
 * it (deck.ts), which is why `length`, `pos` and `seek` are public.
 *
 * With JS off, and inside a `<ref>` preview, nothing here runs and animation.css shows
 * the whole board.
 */

import { t } from "../i18n.ts";
import { button } from "../dom.ts";
import { mediaCaption } from "./media.ts";
import { svg } from "../animation/ink.ts";
import { collect, Player } from "../animation/timeline.ts";

const icon = (path: string): string =>
  `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="${path}"/></svg>`;
const ICON = {
  prev: icon("M10.5 3 5.5 8l5 5"),
  next: icon("M5.5 3l5 5-5 5"),
  play: icon("M5 3.2v9.6L12.5 8z"),
  pause: icon("M5 3.5v9M11 3.5v9"),
};

export class DeltaAnimation extends HTMLElement {
  private player: Player | undefined;

  /** How many steps the board has. */
  get length(): number {
    return this.player?.length ?? 0;
  }
  /** How many of them are showing (0 … length). */
  get pos(): number {
    return this.player?.pos ?? 0;
  }
  /** True when the board opens with a `<pause/>`, so it shows nothing until the first press. */
  get startsBlank(): boolean {
    return this.player?.startsBlank ?? false;
  }
  /** Goes to step `pos`; with `animate`, one step forward is played instead of painted. */
  seek(pos: number, animate = false): Promise<void> {
    return this.player?.seek(pos, animate) ?? Promise.resolve();
  }
  /** Plays the remaining steps one after another (from the start when at the end). */
  play(): void {
    void this.player?.play();
  }
  /** Stops `play()`. */
  stop(): void {
    this.player?.stop();
  }

  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    // A <ref> preview is a still: the stylesheet shows the finished board.
    if (this.closest(".xref-pop-body")) return;

    const onSlide =
      document.documentElement.dataset.type === "presentation" &&
      this.closest("delta-slide") !== null;
    this.classList.add("anim");
    if (onSlide) this.classList.add("anim-bare");

    // The board holds the author's content; the ink overlay and the notes' labels cover it.
    const caption = this.querySelector(":scope > delta-caption");
    const board = document.createElement("div");
    board.className = "anim-board";
    for (const child of [...this.childNodes]) if (child !== caption) board.append(child);
    const ink = svg("svg", { class: "anim-ink", "aria-hidden": "true" });
    const marks = svg("g");
    const proxies = svg("g");
    ink.append(marks, proxies);
    const notes = document.createElement("div");
    notes.className = "anim-notes";
    const frame = document.createElement("div");
    frame.className = "anim-frame";
    frame.append(board, ink, notes);
    this.prepend(frame);
    mediaCaption(this, "animation", this.getAttribute("num"), "figure-cap");

    const stage = { board, marks, proxies, notes };
    const timeline = collect(stage, this.getAttribute("enter"));
    // A slide starts the board from nothing (the deck seeks it); an article rests on the end.
    const player = new Player(timeline, stage, onSlide ? 0 : timeline.parts.length);
    this.player = player;

    // What was measured is stale after a resize, and once the fonts have arrived (a note
    // placed around a formula in a fallback face is in the wrong place): land on the
    // current step, which measures again.
    new ResizeObserver(() => player.settle()).observe(board);
    void document.fonts.ready.then(() => player.settle());
    window.addEventListener("beforeprint", () => {
      player.stop();
      void player.seek(player.length);
    });

    if (!onSlide && player.length > 0) frame.after(this.controls(player, board));
  }

  /** The control bar of a board in running text: previous, play/pause, next, and "3/7". */
  private controls(player: Player, board: HTMLElement): HTMLElement {
    const prev = (): void => {
      player.stop();
      void player.seek(player.pos - 1);
    };
    // At the end, "next" starts over: the board is cleared and its first step plays.
    const next = (): void => {
      player.stop();
      if (player.pos >= player.length) void player.seek(0);
      void player.seek(player.pos + 1, true);
    };
    const toggle = (): void => (player.playing ? player.stop() : void player.play());

    const control = (cls: string, label: string, run: () => void): HTMLButtonElement => {
      const b = button(`anim-btn ${cls}`);
      b.setAttribute("aria-label", label);
      b.title = label;
      b.addEventListener("click", run);
      return b;
    };
    const prevBtn = control("anim-prev", t("animPrev", "Previous step"), prev);
    const playBtn = control("anim-play", t("animPlay", "Play"), toggle);
    const nextBtn = control("anim-next", t("animNext", "Next step"), next);
    prevBtn.innerHTML = ICON.prev;
    nextBtn.innerHTML = ICON.next;
    const count = document.createElement("span");
    count.className = "anim-count";

    const bar = document.createElement("div");
    bar.className = "anim-controls";
    bar.append(prevBtn, playBtn, nextBtn, count);

    player.onChange = () => {
      const label = player.playing ? t("animPause", "Pause") : t("animPlay", "Play");
      playBtn.innerHTML = player.playing ? ICON.pause : ICON.play;
      playBtn.setAttribute("aria-label", label);
      playBtn.title = label;
      prevBtn.disabled = player.pos === 0;
      count.textContent = `${player.pos}/${player.length}`;
    };
    player.onChange();

    // With the board focused, the arrows and the space bar step through it.
    board.tabIndex = 0;
    board.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
      else return;
      e.preventDefault();
    });
    return bar;
  }
}

export function defineAnimation(): void {
  customElements.define("delta-animation", DeltaAnimation);
}
