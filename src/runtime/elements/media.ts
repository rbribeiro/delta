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

/** Wrap a media element in the shared framed box and prepend it to `host`, so the
 *  caption (a sibling of the frame, not a child) renders *outside* the box — the same
 *  layout <figure> uses, keeping video/audio captions consistent with figures. */
function frameMedia(host: HTMLElement, media: HTMLElement): void {
  const frame = document.createElement("div");
  frame.className = "video-frame";
  frame.append(media);
  host.prepend(frame);
}

// Pull the 11-char id out of any common YouTube URL shape, or accept a
// bare id. Returns "" when nothing usable is found.
function youtubeId(input: string | null): string | null {
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
    this.classList.add("video");
    const id = youtubeId(this.getAttribute("src"));
    if (!id) {
      console.warn("delta-youtube: no valid video ID found in src", this.getAttribute("src"));
      return;
    }

    if (location.protocol === "file:") {
      // A file:// page sends no Referer (browsers never leak file:// paths), and YouTube
      // rejects a referrer-less embed — "Video unavailable", error 153. Nothing on the
      // iframe can supply a Referer, so an inline embed simply can't work from file://.
      // Degrade to a thumbnail that opens the video on youtube.com (works on any machine
      // with internet). Serve the file over http(s) instead — the VS Code extension
      // preview, or `npx serve` — and the branch below embeds it inline.
      const link = document.createElement("a");
      link.className = "yt-facade video-media";
      link.href = `https://www.youtube.com/watch?v=${id}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.setAttribute("aria-label", "Watch on YouTube");
      const thumb = document.createElement("img");
      thumb.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      thumb.alt = "";
      thumb.loading = "lazy";
      const play = document.createElement("span");
      play.className = "yt-play";
      play.setAttribute("aria-hidden", "true");
      link.append(thumb, play);
      frameMedia(this, link);
    } else {
      // Served over http(s): the embed has a valid origin/referrer, so it plays inline.
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${id}`;
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.className = "video-media";
      iframe.loading = "lazy";
      frameMedia(this, iframe);
    }
    mediaCaption(this, "video", this.getAttribute("num"));
  }
}

/** Builds a framed <video controls> from a relative `src`, with a "Video N" caption. */
class DeltaVideo extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    this.classList.add("video");
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
    frameMedia(this, video);
    mediaCaption(this, "video", this.getAttribute("num"));
  }
}

/** Builds a framed <audio controls> from a relative `src`, with an "Audio N" caption. */
class DeltaAudio extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    this.classList.add("video");
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
    frameMedia(this, audio);
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



class DeltaInteractive extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady == "1") return;
    this.dataset.deltaReady = "1";

    this.classList.add("figure");
    const caption = this.querySelector(":scope > delta-caption");
    const wrapperFrame = document.createElement("div");
    wrapperFrame.className = "figure-frame";
    for (const child of [...this.childNodes]) {
      if (child !== caption) wrapperFrame.append(child);
    }
    this.prepend(wrapperFrame);
    mediaCaption(this, "interactive", this.getAttribute("num"), "figure-cap")

  }
}

export function defineMedia(): void {
  customElements.define("delta-youtube", class extends DeltaYouTube { });
  customElements.define("delta-video", class extends DeltaVideo { });
  customElements.define("delta-audio", class extends DeltaAudio { });
  customElements.define("delta-figure", class extends DeltaFigure { });
  customElements.define("delta-interactive", class extends DeltaInteractive { });
}
