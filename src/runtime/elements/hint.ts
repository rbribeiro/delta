/**
 * <hint> — an inline click-to-reveal hint. Builds a quiet `.hint-trigger` in the
 * prose (labelled by an optional <delta-title>, else the localized "Hint") and
 * reveals the hint body in a shared `.delta-pop` bubble via Delta.popover.
 *
 *   <hint>Recall the difference of squares.</hint>
 *   <hint><title>Need a push?</title>Factor <m>a^2 - b^2</m>.</hint>
 */

import { t } from "../i18n";
import { popover } from "../utils";
import { button, takeTitle } from "./shared";

class DeltaHint extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    // An optional <delta-title> customizes the trigger label.
    const title = takeTitle(this);
    const showIcon = this.getAttribute("show-icon") !== "false";

    // The bubble holds the revealed content — everything left in the hint.
    const bubble = document.createElement("div");
    bubble.append(...this.childNodes);

    // Inline trigger: a small "? Hint" affordance the reader clicks.
    const trigger = button("hint-trigger");
    if (showIcon) {
      const marker = document.createElement("span");
      marker.className = "hint-marker";
      marker.textContent = "💡 ";
      trigger.append(marker);
    }
    trigger.append(...(title?.text ? title.nodes : [t("hint", "Hint")]));
    this.append(trigger);

    popover(trigger, bubble);
  }
}

export function defineHint(): void {
  customElements.define("delta-hint", DeltaHint);
}
