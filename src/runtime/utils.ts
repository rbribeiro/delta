/**
 * Delta.popover — a reusable top-layer bubble controller shared by every
 * component that needs a hovercard/menu (refs, hints, citations, …).
 *
 * Pass a `trigger` and a `content` element; the controller anchors the content
 * under the trigger — flipping above when the room below runs out, capping the
 * bubble's height to the roomier side (content with a scroll container scrolls
 * internally), clamping on-screen on both axes, pointing the caret (`--arrow-x`)
 * at the trigger, re-anchoring on scroll/resize, and dismissing on Esc or
 * outside-click. Only one popover is
 * open at a time. It uses the Popover API (real top layer) where available and
 * falls back to a fixed-positioned `.is-open` toggle otherwise. Build or refresh
 * the bubble in the `onOpen` hook. The shared look lives in
 * `styles/components/popover.css` (`.delta-pop`).
 */

export interface PopoverOptions {
  /** Runs just before the bubble is shown — build or refresh `content` here. */
  onOpen?: (content: HTMLElement, trigger: HTMLElement) => void;
  /** Runs just after it closes. */
  onClose?: (content: HTMLElement, trigger: HTMLElement) => void;
  /** Gap in px between the trigger and the bubble (room for the caret). Default 10. */
  gap?: number;
  /** Wire a click on the trigger to toggle the bubble. Default true. */
  triggerClick?: boolean;
}

export interface Popover {
  open(): void;
  close(): void;
  toggle(): void;
  readonly isOpen: boolean;
  /** Re-run anchoring — call after changing the content's size while open. */
  reposition(): void;
  /** Unwire all listeners and remove the content element. */
  destroy(): void;
}

const HAS_POPOVER = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;
const EDGE = 8; // keep the bubble at least this far from the viewport edges
const CARET_INSET = 12; // keep the caret this far from the bubble's corners

// Only one popover open at a time: the currently-open instance's close fn.
let closeOpen: (() => void) | null = null;

export function popover(
  trigger: HTMLElement,
  content: HTMLElement,
  options: PopoverOptions = {},
): Popover {
  const { onOpen, onClose, gap = 10, triggerClick = true } = options;

  content.classList.add("delta-pop");
  // The Popover API gives us a real top layer; "manual" means we own dismissal
  // (Esc / outside-click), so the behaviour matches the fallback path exactly.
  if (HAS_POPOVER) content.setAttribute("popover", "manual");
  // position:fixed and the top layer are viewport-relative — host the bubble on
  // <body> so no transformed ancestor (e.g. the tweaks panel) distorts it.
  if (content.parentElement !== document.body) document.body.appendChild(content);
  trigger.setAttribute("aria-haspopup", "dialog");

  let isOpen = false;

  function position(): void {
    const tr = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    // Room on each side of the trigger.
    const roomBelow = vh - EDGE - (tr.bottom + gap);
    const roomAbove = tr.top - gap - EDGE;

    content.style.maxHeight = ""; // measure the natural height (un-cap after a resize)
    let cr = content.getBoundingClientRect();

    // Flip above when it doesn't fit below and there is more room above —
    // when neither side fits, this picks the roomier side.
    const above = cr.height > roomBelow && roomAbove > roomBelow;
    const room = above ? roomAbove : roomBelow;
    if (cr.height > room) {
      // Cap to the available room; content with a scroll container (.floating-body,
      // .xref-pop-body) scrolls internally instead of leaving the viewport.
      content.style.maxHeight = `${Math.max(0, Math.floor(room))}px`;
      cr = content.getBoundingClientRect();
    }
    content.classList.toggle("is-above", above);
    const top = above ? tr.top - gap - cr.height : tr.bottom + gap;

    // Clamp both axes within the viewport (the top clamp is a safety net for
    // content that can't shrink to the cap).
    const clampedTop = Math.min(Math.max(EDGE, top), Math.max(EDGE, vh - cr.height - EDGE));
    const left = Math.min(Math.max(EDGE, tr.left), Math.max(EDGE, vw - cr.width - EDGE));

    content.style.top = `${Math.round(clampedTop)}px`;
    content.style.left = `${Math.round(left)}px`;

    // Caret points at the trigger's centre, clamped within the bubble.
    const caretMax = Math.max(CARET_INSET, cr.width - CARET_INSET);
    const caret = Math.min(Math.max(CARET_INSET, tr.left + tr.width / 2 - left), caretMax);
    content.style.setProperty("--arrow-x", `${Math.round(caret)}px`);
  }

  const onScrollResize = (): void => position();
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") close();
  };
  const onPointerDown = (e: Event): void => {
    const target = e.target as Node;
    if (!content.contains(target) && !trigger.contains(target)) close();
  };

  function open(): void {
    if (isOpen) return;
    if (closeOpen && closeOpen !== close) closeOpen(); // one at a time
    onOpen?.(content, trigger);
    if (HAS_POPOVER) content.showPopover();
    else content.classList.add("is-open");
    position(); // synchronous → positioned before the first paint, no flash

    window.addEventListener("scroll", onScrollResize, { capture: true, passive: true });
    window.addEventListener("resize", onScrollResize);
    document.addEventListener("keydown", onKeydown);
    // Defer outside-click wiring so the opening click doesn't immediately close it.
    setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);

    isOpen = true;
    closeOpen = close;
    trigger.setAttribute("aria-expanded", "true");
  }

  function close(): void {
    if (!isOpen) return;
    if (HAS_POPOVER) {
      if (content.matches(":popover-open")) content.hidePopover();
    } else {
      content.classList.remove("is-open");
    }
    content.classList.remove("is-above");

    window.removeEventListener("scroll", onScrollResize, { capture: true } as EventListenerOptions);
    window.removeEventListener("resize", onScrollResize);
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("pointerdown", onPointerDown);

    isOpen = false;
    if (closeOpen === close) closeOpen = null;
    trigger.setAttribute("aria-expanded", "false");
    onClose?.(content, trigger);
  }

  function toggle(): void {
    if (isOpen) close();
    else open();
  }

  // If the browser dismisses an API popover on its own, keep our state in sync.
  if (HAS_POPOVER) {
    content.addEventListener("toggle", (e: Event) => {
      const newState = (e as unknown as { newState?: string }).newState;
      if (newState === "closed" && isOpen) close();
    });
  }

  const onTriggerClick = (e: Event): void => {
    e.preventDefault();
    toggle();
  };
  if (triggerClick) {
    trigger.addEventListener("click", onTriggerClick);
    trigger.setAttribute("aria-expanded", "false");
  }

  return {
    open,
    close,
    toggle,
    reposition: position,
    get isOpen() {
      return isOpen;
    },
    destroy() {
      close();
      if (triggerClick) trigger.removeEventListener("click", onTriggerClick);
      content.remove();
    },
  };
}
