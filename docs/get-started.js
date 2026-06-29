/* Get-started page behavior: copy buttons + per-OS install tabs.
   Same logic as the landing page's inline script, factored out here. */
(function () {
  "use strict";

  // Copy buttons.
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

  // Install — OS tabs: switch the Node.js panel and aim the copy button at it.
  (function () {
    var card = document.getElementById("node-install");
    if (!card) return;
    var tabs = card.querySelectorAll(".code-tab");
    var copy = card.querySelector(".code-head .copy");
    function select(os) {
      tabs.forEach(function (t) {
        var on = t.dataset.os === os;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", String(on));
        if (on && copy) copy.dataset.clip = t.dataset.clip;
      });
      card.querySelectorAll(".code-panel").forEach(function (p) {
        var on = p.dataset.os === os;
        p.classList.toggle("is-active", on);
        p.hidden = !on;
      });
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () { select(t.dataset.os); });
    });
    // Pre-select the visitor's OS (fallback: Windows).
    var ua = (navigator.userAgent || "").toLowerCase();
    var os = ua.indexOf("mac") > -1 ? "mac"
      : (ua.indexOf("linux") > -1 || ua.indexOf("x11") > -1) ? "deb" : "win";
    select(os);
  })();
})();
