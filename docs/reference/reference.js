/* ==================================================================
   Delta tag reference — shared behavior, one file, no build step.

   TAGS below is the SINGLE SOURCE OF TRUTH for the reference: it drives
   the sidebar on every page and the category grid on index.html. To add
   a tag, add one entry here and one <section class="tag-entry" id="…">
   to the matching category page (copy the shape from _template.html).

   No fetch/XHR — it's an in-file data array, so the site works from
   file:// as well as over http (GitHub Pages).
   ================================================================== */
(function () {
  "use strict";

  // category id → { label, desc, page, items:[{ id, name, summary }] }
  // `desc` is the one-line blurb shown on the index card; `name` is the
  // tag/attribute as written; `id` is its anchor on `page`.
  var TAGS = {
    structure: {
      label: "Structure",
      desc: "The skeleton of a document — the root element, headings, and an automatic table of contents.",
      page: "structure.html",
      items: [
        { id: "document", name: "document", summary: "The root element; sets lang, type, theme." },
        { id: "title", name: "title", summary: "Names a document, section, or environment." },
        { id: "section", name: "section", summary: "Numbered sectioning (section → subsubsection)." },
        { id: "toc", name: "toc", summary: "Auto table of contents." },
      ],
    },
    math: {
      label: "Math",
      desc: "LaTeX-style inline and display math, rendered to typeset HTML at compile time.",
      page: "math.html",
      items: [
        { id: "inline", name: "$…$", summary: "Inline math, written like LaTeX." },
        { id: "equation", name: "equation", summary: "A numbered display equation." },
        { id: "equations", name: "equations", summary: "Aligned multi-line equations." },
      ],
    },
    environments: {
      label: "Environments",
      desc: "Numbered, boxed blocks for an argument — theorems, definitions, and proofs that share a counter.",
      page: "environments.html",
      items: [
        { id: "theorem", name: "theorem", summary: "Numbered theorem family (lemma, prop…)." },
        { id: "definition", name: "definition", summary: "Definitions, examples, remarks." },
        { id: "proof", name: "proof", summary: "A proof block with a tombstone." },
        { id: "meta", name: "meta", summary: "Author/metadata shown in the header." },
      ],
    },
    references: {
      label: "References",
      desc: "Cross-references and citations that bring the result to the reader, with a hover preview.",
      page: "references.html",
      items: [
        { id: "ref", name: "ref", summary: "Cross-reference with a hover preview." },
        { id: "cite", name: "cite", summary: "Cite a paper as [1]." },
        { id: "bibliography", name: "bibliography", summary: "The paper database." },
      ],
    },
    media: {
      label: "Media",
      desc: "Figures, video, and audio — images are inlined so the output stays a single offline file.",
      page: "media.html",
      items: [
        { id: "figure", name: "figure", summary: "Images, inlined at compile time." },
        { id: "video", name: "video", summary: "Local video with captions." },
        { id: "audio", name: "audio", summary: "Local audio." },
      ],
    },
    layout: {
      label: "Prose & layout",
      desc: "The furniture of a readable page — margin notes, hints, columns, lists, code, and a floating nav.",
      page: "layout.html",
      items: [
        { id: "sidenote", name: "sidenote", summary: "Margin notes." },
        { id: "hint", name: "hint", summary: "A pop-over hint." },
        { id: "columns", name: "columns", summary: "Multi-column layout." },
        { id: "list", name: "list", summary: "Ordered/unordered lists." },
        { id: "code", name: "code", summary: "Code blocks with highlighting." },
        { id: "floating", name: "floating", summary: "A corner navigation button." },
      ],
    },
    presentations: {
      label: "Presentations",
      desc: "Turn a document into an offline, navigable slide deck — paged and progressively revealed.",
      page: "presentations.html",
      items: [
        { id: "slide", name: "slide", summary: "One deck slide." },
        { id: "cover", name: "cover", summary: "The title slide." },
        { id: "progress", name: "progress", summary: "Opt-in progress bar." },
      ],
    },
    theming: {
      label: "Theming & files",
      desc: "Accent and dark mode, author stylesheets, custom-element packs, and multi-file projects.",
      page: "theming.html",
      items: [
        { id: "theme", name: "theme", summary: "Author stylesheet + accent/dark mode." },
        { id: "import", name: "import", summary: "Custom-element packs." },
        { id: "include", name: "include", summary: "Merge another .dlt file." },
      ],
    },
  };

  var ORDER = ["structure", "math", "environments", "references", "media", "layout", "presentations", "theming"];

  function currentPage() {
    var path = location.pathname.split("/").pop();
    return path && path.indexOf(".html") > -1 ? path : "index.html";
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  // <tagname> for a tag, or the raw name for math/attribute entries (those that
  // aren't bare identifiers, e.g. "$…$").
  function tagLabel(name) {
    return /^[a-z][a-z-]*$/.test(name) ? "&lt;" + name + "&gt;" : name;
  }

  function buildSidebar() {
    var host = document.getElementById("doc-sidebar");
    if (!host) return;
    var page = currentPage();
    ORDER.forEach(function (key) {
      var cat = TAGS[key];
      var head = el("span", "cat", cat.label);
      host.appendChild(head);
      cat.items.forEach(function (it) {
        var a = el("a", null, "<code>" + tagLabel(it.name) + "</code>");
        a.href = cat.page + "#" + it.id;
        a.dataset.page = cat.page;
        a.dataset.id = it.id;
        host.appendChild(a);
      });
    });
    // Mark the active page's links; the scrollspy refines to the visible section.
    var first = host.querySelector('a[data-page="' + page + '"]');
    if (first) first.classList.add("is-active");
  }

  function buildIndex() {
    var host = document.getElementById("doc-index");
    if (!host) return;
    ORDER.forEach(function (key) {
      var cat = TAGS[key];
      var card = el("a", "cat-card");
      card.href = cat.page;
      card.appendChild(el("h3", null, cat.label));
      if (cat.desc) card.appendChild(el("p", null, cat.desc));
      var tags = el("div", "tags");
      cat.items.forEach(function (it) {
        tags.appendChild(el("code", null, tagLabel(it.name)));
      });
      card.appendChild(tags);
      host.appendChild(card);
    });
  }

  // Highlight the sidebar link of whichever .tag-entry is currently in view.
  function scrollSpy() {
    var host = document.getElementById("doc-sidebar");
    if (!host || !("IntersectionObserver" in window)) return;
    var page = currentPage();
    var entries = [].slice.call(document.querySelectorAll(".tag-entry[id]"));
    if (!entries.length) return;
    var linkFor = {};
    [].slice.call(host.querySelectorAll('a[data-page="' + page + '"]')).forEach(function (a) {
      linkFor[a.dataset.id] = a;
    });
    var visible = {};
    var io = new IntersectionObserver(function (recs) {
      recs.forEach(function (r) { visible[r.target.id] = r.isIntersecting; });
      var active = entries.filter(function (e) { return visible[e.id]; })[0] || null;
      Object.keys(linkFor).forEach(function (id) {
        linkFor[id].classList.toggle("is-active", !!active && active.id === id);
      });
    }, { rootMargin: "-88px 0px -65% 0px" });
    entries.forEach(function (e) { io.observe(e); });
  }

  // Mobile: a fixed "Contents" button toggles the off-canvas sidebar.
  function contentsToggle() {
    var host = document.getElementById("doc-sidebar");
    if (!host) return;
    var btn = el("button", "contents-toggle", "Contents");
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle reference navigation");
    btn.addEventListener("click", function () { host.classList.toggle("is-open"); });
    host.addEventListener("click", function (e) {
      if (e.target.tagName === "A") host.classList.remove("is-open");
    });
    document.body.appendChild(btn);
  }

  // Copy buttons (lifted from the landing page's inline script).
  function copyButtons() {
    document.querySelectorAll(".copy").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        try {
          await navigator.clipboard.writeText(btn.dataset.clip || "");
          var prev = btn.textContent;
          btn.textContent = "Copied";
          btn.classList.add("ok");
          setTimeout(function () { btn.textContent = prev; btn.classList.remove("ok"); }, 1400);
        } catch (e) { /* clipboard unavailable */ }
      });
    });
  }

  buildSidebar();
  buildIndex();
  scrollSpy();
  contentsToggle();
  copyButtons();
})();
