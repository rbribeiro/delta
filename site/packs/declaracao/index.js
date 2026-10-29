(function () {
  "use strict";

  var META_TAGS = ["DELTA-MODEL", "DELTA-DATE", "DELTA-LINK", "DELTA-PROMPT", "DELTA-ANSWER"];

  function isMeta(node) {
    return node.nodeType === 1 && META_TAGS.indexOf(node.tagName) !== -1;
  }

  function linkHref(link) {
    if (!link) return "";
    return link.getAttribute("to") || link.getAttribute("href") || "";
  }

  function buildThread(turns, threadClass, msgClass, bubbleClass) {
    var thread = document.createElement("div");
    thread.className = threadClass;
    turns.forEach(function (t) {
      var isPrompt = t.tagName === "DELTA-PROMPT";
      var msg = document.createElement("div");
      msg.className = msgClass + " " + (isPrompt ? "is-prompt" : "is-answer");
      var bubble = document.createElement("div");
      bubble.className = bubbleClass;
      for (var i = 0; i < t.childNodes.length; i++) {
        bubble.appendChild(t.childNodes[i].cloneNode(true));
      }
      msg.appendChild(bubble);
      thread.appendChild(msg);
    });
    return thread;
  }

  var ICON_SPARKLE =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 2c.6 3.6 1.4 6 3 7.6 1.6 1.6 4 2.4 7 3-3 .6-5.4 1.4-7 3-1.6 1.6-2.4 4-3 7.4-.6-3.4-1.4-5.8-3-7.4-1.6-1.6-4-2.4-7-3 3-.6 5.4-1.4 7-3 1.6-1.6 2.4-4 3-7.6Z"/>' +
    "</svg>";

  var ICON_LINK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M10 14 21 3"/><path d="M21 3h-6"/><path d="M21 3v6"/>' +
    '<path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></svg>';

  customElements.define(
    "delta-ai-use",
    class extends HTMLElement {
      connectedCallback() {
        if (this.dataset.deltaReady) return;
        this.dataset.deltaReady = "true";

        var model = this.querySelector(":scope > delta-model");
        var date = this.querySelector(":scope > delta-date");
        var link = this.querySelector(":scope > delta-link");
        var turns = [].slice.call(
          this.querySelectorAll(":scope > delta-prompt, :scope > delta-answer"),
        );
        var baseNodes = [].slice.call(this.childNodes).filter(function (n) {
          return !isMeta(n);
        });

        var type = (this.getAttribute("type") || "box").toLowerCase();
        if (type === "icon") {
          this.renderIcon(model, date, link, turns, baseNodes);
        } else {
          this.renderBox(model, date, link, turns, baseNodes);
        }
      }

      renderIcon(model, date, link, turns, baseNodes) {
        var trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "desc-trigger";
        trigger.innerHTML = ICON_SPARKLE;
        trigger.setAttribute(
          "aria-label",
          window.Delta.t("ai-use-label", "Conteúdo com apoio de IA — ver conversa"),
        );

        var base = document.createElement("div");
        base.className = "desc-base";
        baseNodes.forEach(function (n) {
          base.appendChild(n);
        });

        this.replaceChildren(trigger, base);

        var card = document.createElement("div");
        card.className = "desc-pop";

        var head = document.createElement("div");
        head.className = "desc-head";

        if (model) {
          var modelEl = document.createElement("span");
          modelEl.className = "desc-model";
          modelEl.textContent = model.textContent.trim();
          head.appendChild(modelEl);
        }
        if (date) {
          var dateEl = document.createElement("span");
          dateEl.className = "desc-date";
          dateEl.textContent = date.textContent.trim();
          head.appendChild(dateEl);
        }
        var href = linkHref(link);
        if (href) {
          var a = document.createElement("a");
          a.className = "desc-link";
          a.href = href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.innerHTML = ICON_LINK;
          a.setAttribute(
            "aria-label",
            window.Delta.t("ai-use-open", "Abrir conversa original"),
          );
          head.appendChild(a);
        }
        card.appendChild(head);

        if (turns.length) {
          var sep = document.createElement("hr");
          sep.className = "desc-sep";
          card.appendChild(sep);
          card.appendChild(buildThread(turns, "desc-thread", "desc-msg", "desc-bubble"));
        }

        window.Delta.popover(trigger, card);
      }

      renderBox(model, date, link, turns, baseNodes) {
        var fallbackText = baseNodes
          .map(function (n) {
            return n.textContent || "";
          })
          .join("")
          .trim();

        this.replaceChildren();

        var box = document.createElement("div");
        box.className = "ai-use-box";

        var row = document.createElement("div");
        row.className = "ai-use-row";
        row.innerHTML =
          '<svg viewBox="0 0 24 24" class="ai-use-icon" aria-hidden="true">' +
          '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>';

        var label = document.createElement("span");
        label.className = "ai-use-label";
        var modelSpan = document.createElement("span");
        modelSpan.className = "ai-use-model";
        modelSpan.textContent = model
          ? model.textContent.trim()
          : window.Delta.t("ai-use-model-fallback", "IA");
        label.append(window.Delta.t("ai-use-prefix", "Gerado com") + " ", modelSpan);
        row.appendChild(label);

        if (date) {
          var dateEl2 = document.createElement("span");
          dateEl2.className = "ai-use-date";
          dateEl2.textContent = date.textContent.trim();
          row.appendChild(dateEl2);
        }

        var href2 = linkHref(link);
        if (href2) {
          var a2 = document.createElement("a");
          a2.className = "ai-use-link";
          a2.href = href2;
          a2.target = "_blank";
          a2.rel = "noopener noreferrer";
          a2.textContent = window.Delta.t("ai-use-link-text", "conversa original");
          row.appendChild(a2);
        }

        var hasThread = turns.length > 0;
        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "ai-use-toggle";
        var showText = hasThread
          ? window.Delta.t("ai-use-show-thread", "ver conversa")
          : window.Delta.t("ai-use-show", "ver prompt");
        var hideText = hasThread
          ? window.Delta.t("ai-use-hide-thread", "ocultar conversa")
          : window.Delta.t("ai-use-hide", "ocultar prompt");
        toggle.textContent = showText;
        toggle.setAttribute("aria-expanded", "false");
        row.appendChild(toggle);

        box.appendChild(row);

        var body;
        if (hasThread) {
          body = buildThread(
            turns,
            "ai-use-thread",
            "ai-use-msg",
            "ai-use-bubble",
          );
        } else {
          body = document.createElement("pre");
          body.className = "ai-use-prompt";
          body.textContent = fallbackText;
        }
        body.hidden = true;
        box.appendChild(body);

        toggle.addEventListener("click", function () {
          var open = !body.hidden;
          body.hidden = open;
          toggle.textContent = open ? showText : hideText;
          toggle.setAttribute("aria-expanded", String(!open));
        });

        this.appendChild(box);
      }
    },
  );
})();
