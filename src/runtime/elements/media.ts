/**
 * The media elements: <youtube>, <video>, <audio> (share a `.video-frame` shell
 * and the "Video/Audio N" caption) and <figure> (a framed <img> with a
 * "Figure N" caption). All caption labels are localized via `t`.
 */

import { t } from "../i18n";

/**
 * Lifts a `<delta-caption>` child into a caption row: adds `.video-cap` and a
 * "Video 1.2"-style `.lbl` prefix (localized via `t`). Shared by the media elements.
 */
function mediaCaption(
  host: HTMLElement,
  labelKey: string,
  num: string | null,
  capClass = "video-cap",
): void {
  const caption = host.querySelector(":scope > delta-caption");
  if (!caption) return;
  caption.classList.add(capClass);
  const lbl = document.createElement("span");
  lbl.className = "lbl";
  const word = t(labelKey, labelKey.charAt(0).toUpperCase() + labelKey.slice(1));
  lbl.textContent = word + (num ? ` ${num}` : "");
  caption.prepend(lbl, " ");
}

// Pull the 11-char id out of any common YouTube URL shape, or accept a
// bare id. Returns "" when nothing usable is found.
function youtubeId(input:string | null):string | null {
  input = (input || "").trim();
  if (/^[\w-]{11}$/.test(input)) return input;
  try {
    const u = new URL(input);
    if (u.hostname === "youtu.be") return u.pathname.slice(1, 12);
    if (u.searchParams.has("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/);
    if (m) return m[1];
  } catch { /* not a URL — fall through */ }
  return "";
}

/**
 * Defines the delta-youtube element, which embeds a YouTube video in an iframe. The src attribute is either a full YouTube URL or just the video ID. Example usage:
<delta-youtube src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></delta-youtube>
or
<delta-youtube src="dQw4w9WgXcQ"></delta-youtube>
 */
class DeltaYouTube extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    this.classList.add("video-frame");
    const id = youtubeId(this.getAttribute("src"));
    if (!id) {
      console.warn("delta-youtube: no valid video ID found in src", this.getAttribute("src"));
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${id}`;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.className = "video-media";
    iframe.loading = "lazy";
    this.prepend(iframe);
    mediaCaption(this, "video", this.getAttribute("num"));
  }
}

/** Builds a framed <video controls> from a relative `src`, with a "Video N" caption. */
class DeltaVideo extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    this.classList.add("video-frame");
    const src = this.getAttribute("src");
    if (!src) {
      const missing = document.createElement("div");
      missing.className = "video-missing";
      missing.textContent = "No video source.";
      this.prepend(missing);
      return;
    }
    const video = document.createElement("video");
    video.src = src;
    video.controls = true;
    video.className = "video-media";
    for (const attr of ["poster", "loop", "muted", "autoplay", "playsinline"]) {
      if (this.hasAttribute(attr)) video.setAttribute(attr, this.getAttribute(attr) ?? "");
    }
    this.prepend(video);
    mediaCaption(this, "video", this.getAttribute("num"));
  }
}

/** Builds a framed <audio controls> from a relative `src`, with an "Audio N" caption. */
class DeltaAudio extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    this.classList.add("video-frame");
    const src = this.getAttribute("src");
    if (!src) {
      const missing = document.createElement("div");
      missing.className = "video-missing";
      missing.textContent = "No audio source.";
      this.prepend(missing);
      return;
    }
    const audio = document.createElement("audio");
    audio.src = src;
    audio.controls = true;
    audio.className = "audio-media";
    if (this.hasAttribute("loop")) audio.loop = true;
    this.prepend(audio);
    mediaCaption(this, "audio", this.getAttribute("num"));
  }
}

/** Builds a framed <img> from a `data:`-inlined `src`, with a "Figure N" caption. */
class DeltaFigure extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    this.classList.add("figure");
    const src = this.getAttribute("src");
    if (!src) {
      const missing = document.createElement("div");
      missing.className = "video-missing";
      missing.textContent = "Image not found.";
      this.prepend(missing);
    } else {
      const frame = document.createElement("div");
      frame.className = "figure-frame";
      const img = document.createElement("img");
      img.src = src;
      const alt = this.getAttribute("alt");
      if (alt) img.alt = alt;
      frame.append(img);
      this.prepend(frame);
    }
    mediaCaption(this, "figure", this.getAttribute("num"), "figure-cap");
  }
}

export function defineMedia(): void {
  customElements.define("delta-youtube", class extends DeltaYouTube {});
  customElements.define("delta-video", class extends DeltaVideo {});
  customElements.define("delta-audio", class extends DeltaAudio {});
  customElements.define("delta-figure", class extends DeltaFigure {});
}
