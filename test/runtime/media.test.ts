import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

/**
 * Smoke tests for the media elements other than <figure> (in blocks.test.ts): each builds its
 * framed player, or a placeholder when it has no source, and its numbered caption. Offline,
 * a <youtube> is a thumbnail link to the video, never an embedded frame.
 */

const DOC = `<document lang="en">
  <title>Media</title>
  <section id="s"><title>S</title>
    <video src="clip.mp4"><caption>A clip.</caption></video>
    <youtube src="dQw4w9WgXcQ"><caption>A talk.</caption></youtube>
    <audio src="talk.mp3"><caption>A recording.</caption></audio>
    <video><caption>Nothing to play.</caption></video>
    <audio/>
    <interactive>Drag me.<caption>A demo.</caption></interactive>
  </section>
</document>`;

const PROBE = `
  const box = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const [video, emptyVideo] = $$("delta-video");
  const [audio, emptyAudio] = $$("delta-audio");
  const yt = $("delta-youtube");
  const inter = $("delta-interactive");
  return {
    video: {
      player: !!$(".video-frame > video.video-media[controls]", video),
      src: $("video", video) ? $("video", video).getAttribute("src") : null,
      caption: text(".video-cap .lbl", video),
      painted: box($(".video-frame", video)),
    },
    youtube: {
      facade: !!$(".video-frame > a.yt-facade", yt),
      href: $("a.yt-facade", yt) ? $("a.yt-facade", yt).getAttribute("href") : null,
      label: $("a.yt-facade", yt) ? $("a.yt-facade", yt).getAttribute("aria-label") : null,
      iframe: !!$("iframe", yt),
      caption: text(".video-cap .lbl", yt),
    },
    audio: {
      player: !!$("audio.audio-media[controls]", audio),
      caption: text(".video-cap .lbl", audio),
    },
    missing: {
      video: text(".video-missing", emptyVideo),
      audio: text(".video-missing", emptyAudio),
    },
    interactive: {
      framed: text(".interactive-frame", inter).trim() === "Drag me.",
      caption: text(".interactive-cap .lbl", inter),
      painted: box($(".interactive-frame", inter)),
    },
  };`;

type Facts = Record<string, Record<string, unknown>>;

describe.skipIf(!BROWSER)("media elements", () => {
  const facts = lazy(() => inspect<Facts>(DOC, PROBE));

  it("<video> is a framed player with controls and a numbered caption", () => {
    expect(facts().video).toEqual({
      player: true,
      src: "clip.mp4",
      caption: "Video 1.1",
      painted: true,
    });
  });

  it("<youtube> offline is a thumbnail link to the video, numbered with the videos", () => {
    expect(facts().youtube).toEqual({
      facade: true,
      href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      label: "Watch on YouTube",
      iframe: false,
      caption: "Video 1.2",
    });
  });

  it("<audio> is a player with controls and its own numbering", () => {
    expect(facts().audio).toEqual({ player: true, caption: "Audio 1.1" });
  });

  it("a video or audio without a source says so", () => {
    expect(facts().missing).toEqual({ video: "No video source.", audio: "No audio source." });
  });

  it("<interactive> frames its content and captions it", () => {
    expect(facts().interactive).toEqual({
      framed: true,
      caption: "Interactive 1.1",
      painted: true,
    });
  });
});
