/**
 * Ink: what an `<animation>` draws with. KaTeX and prose are font text, which the browser
 * can only paint whole; to *write* a formula we stand an SVG `<text>` proxy exactly on top
 * of each character, trace its outline, fill it, and then hand back to the real glyph.
 * Proxies live in one overlay per board (the formula's own DOM is never touched: KaTeX's
 * stylesheet pins every `svg` inside `.katex`), and they are placed by measuring, so nothing
 * about the fonts is shipped or computed at compile time.
 *
 * Everything here returns Web Animations: the timeline awaits them, cancels them when the
 * reader interrupts, and the tests finish them by hand.
 */

const NS = "http://www.w3.org/2000/svg";

/** An SVG element with its attributes set. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** A rectangle in the overlay's coordinates. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** One character as the page paints it: where its pen sits, in which face, in which colour. */
export interface Glyph {
  ch: string;
  /** Pen position (left edge, baseline) in the overlay's coordinates. */
  x: number;
  y: number;
  /** The character's line box (as tall as the font, whatever the character). */
  box: Box;
  /** Font size in px. */
  size: number;
  /** The computed font properties, ready to assign to a proxy's style. */
  font: Record<string, string>;
  color: string;
  /** Character and face (not size): two glyphs with the same key can morph into each other. */
  key: string;
  /** The innermost `\part{name}{…}` this glyph sits in, if any. */
  part: string | null;
}

/** The font properties a proxy copies, so SVG text shapes exactly like the HTML it covers. */
const FONT_PROPS = [
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "fontStretch",
  "fontVariationSettings",
  "fontOpticalSizing",
  "fontFeatureSettings",
  "fontKerning",
] as const;

/** KaTeX's ink that is not text: stretchy SVG (roots, braces, arrows) and ruled lines. */
export const RULES =
  "svg, .frac-line, .overline-line, .underline-line, .hline, .hdashline, .rule, .sout, .fbox, .vertical-separator";

/** A character that leaves ink: not a space, not KaTeX's zero-width filler. */
const INK = /[^\s\u200b]/;

/** True for a node that is laid out but switched off inside `root` (another form of a morph). */
function switchedOff(node: Element, root: Element): boolean {
  const off = node.closest(".anim-off");
  return off !== null && off !== root && root.contains(off);
}

/**
 * Measures every visible character under `roots`, in reading order. `layer` is a group of
 * the overlay the proxies will go into; positions are relative to that overlay.
 *
 * A `Range` over one character gives its box; a zero-size inline-block dropped in front of
 * the text sits on the baseline, which tells how far below the top of that box the baseline
 * is. The probes are taken out again before the characters are measured: one at the start
 * of a line turns the collapsed space after it into a real one and shifts the text.
 *
 * These are layout values, but the browser paints text on whole device pixels vertically,
 * so the baseline is snapped the same way: without that a proxy lands up to a pixel off its
 * glyph on a 1× screen.
 */
export function glyphsOf(roots: Iterable<Element>, layer: SVGGElement): Glyph[] {
  const origin = layer.ownerSVGElement!.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const snap = (v: number): number => Math.round(v * dpr) / dpr;
  const range = document.createRange();
  const out: Glyph[] = [];

  for (const root of roots) {
    // 1. Every text node that paints, and how far its baseline is below the top of its
    //    characters' boxes (one layout, with a probe in front of each).
    const texts: { node: Text; probe: HTMLElement; lift: number }[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const node = n as Text;
      const parent = node.parentElement;
      if (!parent || !INK.test(node.data)) continue;
      // Not KaTeX's hidden MathML, not another form of a morph, and not text drawn by an
      // SVG of the author's (a widget's own labels are part of its picture).
      if (parent.closest(".katex-mathml, svg") || switchedOff(parent, root)) continue;
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0";
      texts.push({ node, probe, lift: 0 });
    }
    for (const { node, probe } of texts) node.before(probe);
    for (const text of texts) {
      const first = text.node.data.search(INK);
      range.setStart(text.node, first);
      range.setEnd(text.node, first + 1);
      text.lift = text.probe.getBoundingClientRect().top - range.getBoundingClientRect().top;
    }
    for (const { probe } of texts) probe.remove();

    // 2. A second layout, the page as it really is: where each character sits.
    const found: { glyph: Glyph; math: Element | null }[] = [];
    for (const { node, lift } of texts) {
      const parent = node.parentElement!;
      const cs = getComputedStyle(parent);
      const font: Record<string, string> = {};
      for (const p of FONT_PROPS) font[p] = cs[p];
      const math = parent.closest(".katex");
      const part = parent.closest("[data-delta-part]")?.getAttribute("data-delta-part") ?? null;
      const key = `${cs.fontFamily}|${cs.fontStyle}|${cs.fontWeight}`;
      let i = 0;
      for (const ch of node.data) {
        range.setStart(node, i);
        range.setEnd(node, (i += ch.length));
        if (!INK.test(ch)) continue;
        const r = range.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        found.push({
          math,
          glyph: {
            ch,
            x: r.left - origin.left,
            y: snap(r.top) + snap(lift) - snap(origin.top),
            box: {
              left: r.left - origin.left,
              top: r.top - origin.top,
              right: r.right - origin.left,
              bottom: r.bottom - origin.top,
            },
            size: parseFloat(cs.fontSize),
            font,
            color: cs.color,
            key: `${ch}|${key}`,
            part,
          },
        });
      }
    }

    // 3. Reading order. Prose is already in it; inside a formula KaTeX's DOM order is not
    //    (a denominator comes before its numerator), so each formula is swept left to right.
    for (let a = 0; a < found.length;) {
      let b = a + 1;
      while (b < found.length && found[b].math === found[a].math) b++;
      const run = found.slice(a, b).map((f) => f.glyph);
      if (found[a].math) run.sort((p, q) => p.x - q.x);
      out.push(...run);
      a = b;
    }
  }
  return out;
}

/** The SVG stand-in for one glyph, filled and unstroked: it looks like the glyph it covers. */
export function proxy(g: Glyph): SVGTextElement {
  const t = svg("text", { x: g.x, y: g.y });
  t.textContent = g.ch;
  Object.assign(t.style, g.font);
  t.style.fill = g.color;
  t.style.stroke = g.color;
  t.style.strokeWidth = "0";
  return t;
}

let measurer: CanvasRenderingContext2D | null | undefined;

/**
 * The box a glyph actually inks (an "x" is much shorter than its line box). The DOM only
 * knows line boxes; a canvas measures the character itself.
 */
export function inked(g: Glyph): Box {
  measurer ??= document.createElement("canvas").getContext("2d");
  if (!measurer) return g.box;
  measurer.font = `${g.font.fontStyle} ${g.font.fontWeight} ${g.font.fontSize} ${g.font.fontFamily}`;
  const m = measurer.measureText(g.ch);
  return {
    left: g.x - m.actualBoundingBoxLeft,
    right: g.x + m.actualBoundingBoxRight,
    top: g.y - m.actualBoundingBoxAscent,
    bottom: g.y + m.actualBoundingBoxDescent,
  };
}

/**
 * A dash long enough to cover a glyph's longest contour (SVG has no outline length for
 * text). A dash restarts on every contour, so one length serves all of them; too long only
 * means the outline closes a little early. Estimated from the inked box of the character.
 */
function contourLength(g: Glyph): number {
  const ink = inked(g);
  return Math.max(g.size, 4.5 * (ink.right - ink.left + ink.bottom - ink.top));
}

/** Longest a single piece takes to write, however many characters it has. */
const WRITE_MAX = 2200;
/** One glyph: its outline is traced, then it fills. */
const GLYPH_MS = 560;
/** The pen moves on to the next glyph this long after starting one. */
const GLYPH_LAG = 60;
/** Past this many characters a piece is not handwriting any more: it fades in. */
const WRITE_LIMIT = 400;

/**
 * Writes `els` (which are switched off, so their real glyphs are hidden): every character
 * is traced and filled by a proxy, one after another; KaTeX's rules and stretchy SVG are
 * wiped in as the pen passes them. When the animations end the caller removes the proxies
 * and switches the elements on, in the same frame.
 */
export function write(els: Element[], layer: SVGGElement, total?: number, delay = 0): Animation[] {
  const glyphs = glyphsOf(els, layer);
  if (glyphs.length === 0 || glyphs.length > WRITE_LIMIT) {
    return els.map((el) => fadeIn(el, total, delay));
  }

  const span = total ?? Math.min(WRITE_MAX, GLYPH_MS + GLYPH_LAG * (glyphs.length - 1));
  const each = Math.min(GLYPH_MS, span);
  const lag = glyphs.length > 1 ? (span - each) / (glyphs.length - 1) : 0;

  const anims = glyphs.map((g, i) => {
    const t = proxy(g);
    const len = contourLength(g);
    const pen = 0.045 * g.size;
    t.style.strokeDasharray = `${len} ${len}`;
    layer.append(t);
    return t.animate(
      [
        { strokeDashoffset: len, fillOpacity: 0, strokeWidth: pen },
        { strokeDashoffset: 0, fillOpacity: 0, strokeWidth: pen, offset: 0.62 },
        { strokeDashoffset: 0, fillOpacity: 1, strokeWidth: 0 },
      ],
      { duration: each, delay: delay + i * lag, fill: "both", easing: "linear" },
    );
  });

  // Rules and stretchy SVG: shown through the hidden element, wiped in when the pen arrives.
  const origin = layer.ownerSVGElement!.getBoundingClientRect();
  for (const el of els) {
    for (const rule of el.querySelectorAll<HTMLElement>(RULES)) {
      if (!rule.closest(".katex-html") || switchedOff(rule, el)) continue;
      const left = rule.getBoundingClientRect().left - origin.left;
      const before = glyphs.filter((g) => g.x < left).length;
      anims.push(
        rule.animate(
          [
            { visibility: "visible", clipPath: "inset(0 100% 0 0)" },
            { visibility: "visible", clipPath: "inset(0 0 0 0)" },
          ],
          { duration: each, delay: delay + before * lag, fill: "both", easing: "ease-out" },
        ),
      );
    }
  }
  return anims;
}

/** Default length of a fade. */
const FADE_MS = 420;

/** Fades in an element that is switched off (the animation shows it; the caller then switches it on). */
export function fadeIn(el: Element, ms = FADE_MS, delay = 0): Animation {
  return el.animate(
    [
      { visibility: "visible", opacity: 0 },
      { visibility: "visible", opacity: 1 },
    ],
    { duration: ms, delay, fill: "both", easing: "ease-out" },
  );
}

/** Fades out an element that is showing (the caller then switches it off). */
export function fadeOut(el: Element, ms = FADE_MS): Animation {
  return el.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: ms,
    fill: "both",
    easing: "ease-in",
  });
}

/** Default length of a morph. */
const MORPH_MS = 1100;

/**
 * Pairs the glyphs of two forms of a formula. Glyphs inside a `\part` of the same name pair
 * first; then the k-th remaining occurrence of each character (in the same face) pairs with
 * the k-th on the other side. What is left over has no partner: it fades.
 */
export function matchGlyphs(from: Glyph[], to: Glyph[]): Map<Glyph, Glyph> {
  const pairs = new Map<Glyph, Glyph>();
  const taken = new Set<Glyph>();
  const pair = (olds: Glyph[], news: Glyph[], keyOf: (g: Glyph) => string): void => {
    const waiting = new Map<string, Glyph[]>();
    for (const g of news) {
      if (taken.has(g)) continue;
      const list = waiting.get(keyOf(g));
      if (list) list.push(g);
      else waiting.set(keyOf(g), [g]);
    }
    for (const g of olds) {
      if (pairs.has(g)) continue;
      const partner = waiting.get(keyOf(g))?.shift();
      if (!partner) continue;
      pairs.set(g, partner);
      taken.add(partner);
    }
  };
  const named = (list: Glyph[]): Glyph[] => list.filter((g) => g.part !== null);
  pair(named(from), named(to), (g) => `${g.part}\u0000${g.key}`);
  pair(from, to, (g) => g.key);
  return pairs;
}

/**
 * Morphs the showing form `from` into the switched-off form `to`, which shares its place.
 * Both real forms stay hidden while proxies do the work: a paired glyph travels from its old
 * place and size to its new one, an unpaired old glyph fades away early and an unpaired new
 * one fades in late. Rules and stretchy SVG cross-fade with their forms.
 */
export function morph(from: Element, to: Element, layer: SVGGElement, ms = MORPH_MS): Animation[] {
  const olds = glyphsOf([from], layer);
  const news = glyphsOf([to], layer);
  const pairs = matchGlyphs(olds, news);
  const arriving = new Set(pairs.values());
  const timing: KeyframeAnimationOptions = {
    duration: ms,
    fill: "both",
    easing: "cubic-bezier(.45,0,.2,1)",
  };
  const anims: Animation[] = [
    from.animate([{ visibility: "hidden" }, { visibility: "hidden" }], {
      duration: ms,
      fill: "both",
    }),
  ];

  for (const g of olds) {
    const t = proxy(g);
    layer.append(t);
    const partner = pairs.get(g);
    if (!partner) {
      anims.push(t.animate([{ opacity: 1 }, { opacity: 0, offset: 0.4 }, { opacity: 0 }], timing));
      continue;
    }
    // Scale about the pen position, so the glyph lands exactly on its partner.
    t.style.transformOrigin = `${g.x}px ${g.y}px`;
    const dx = partner.x - g.x;
    const dy = partner.y - g.y;
    anims.push(
      t.animate(
        [
          { transform: "translate(0px, 0px) scale(1)", fill: g.color },
          {
            transform: `translate(${dx}px, ${dy}px) scale(${partner.size / g.size})`,
            fill: partner.color,
          },
        ],
        timing,
      ),
    );
  }
  for (const g of news) {
    if (arriving.has(g)) continue;
    const t = proxy(g);
    layer.append(t);
    anims.push(t.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], timing));
  }

  const crossFade = (form: Element, keyframes: Keyframe[]): void => {
    for (const rule of form.querySelectorAll(RULES)) {
      if (rule.closest(".katex-html")) anims.push(rule.animate(keyframes, timing));
    }
  };
  crossFade(from, [
    { visibility: "visible", opacity: 1 },
    { visibility: "visible", opacity: 0, offset: 0.5 },
    { visibility: "visible", opacity: 0 },
  ]);
  crossFade(to, [
    { visibility: "visible", opacity: 0 },
    { visibility: "visible", opacity: 0, offset: 0.5 },
    { visibility: "visible", opacity: 1 },
  ]);
  return anims;
}
