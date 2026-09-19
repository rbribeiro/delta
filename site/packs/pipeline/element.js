/* <pipeline-explorer>: o explorador do pipeline do compilador Delta.
 *
 * Lê window.DeltaPipelineTrace — gerado por scripts/trace.ts rodando o compilador de verdade
 * sobre o projeto de exemplo em sample/ — e mostra, passo a passo, a árvore de cada arquivo,
 * o contexto por arquivo e o estado compartilhado, destacando o que cada passo mudou.
 *
 * Script clássico (sem import/export), como todo pacote Delta. Estilo em theme.css, só com
 * tokens --delta-*, então o tema, o acento e o modo escuro da página valem aqui também.
 */
(function () {
  "use strict";
  const DATA = window.DeltaPipelineTrace;

  /* ---------- pequenos utilitários de DOM ---------- */

  function el(tag, cls, ...children) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : String(c));
    }
    return node;
  }
  function btn(label, cls, onClick) {
    const b = el("button", "btn " + (cls || ""), label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const fmt = (v) => (typeof v === "string" ? v : JSON.stringify(v));

  /* ---------- os eventos, com "unchanged" resolvido ---------- */

  /** Cada evento guarda a árvore inteira; "unchanged" aponta para a anterior. Aqui a referência é materializada. */
  function resolveEvents(events) {
    const last = [];
    return events.map((e) => ({
      ...e,
      files: e.files.map((f, i) => {
        if (f.ast !== "unchanged") last[i] = f.ast;
        return { ast: last[i] ?? null, ctx: f.ctx, html: f.html ?? null };
      }),
    }));
  }

  /* ---------- diffs ---------- */

  /**
   * Compara duas árvores posição a posição. Devolve, por caminho ("0.2.1"), o estado do nó
   * ("added" | "changed") e, por atributo, "added" | "changed"; mais os atributos removidos e
   * quantos nós sumiram. Um passo que reescreve os filhos (matemática, quebras de linha)
   * aparece como "changed" nos irmãos deslocados, o que é exatamente o que aconteceu.
   */
  function diffAst(prev, next) {
    const marks = new Map();
    const out = { marks, added: 0, changed: 0, attrsAdded: 0, attrsChanged: 0, removed: 0 };
    const walk = (a, b, path) => {
      if (!b) return;
      const m = { node: null, attrs: {}, removedAttrs: [] };
      if (!a) {
        m.node = "added";
        out.added++;
      } else if (a.tag !== b.tag || ("text" in a) !== ("text" in b) || ("raw" in a) !== ("raw" in b)) {
        m.node = "changed";
        out.changed++;
      } else if ("text" in b && a.text !== b.text) {
        m.node = "changed";
        out.changed++;
      } else if ("raw" in b && a.raw !== b.raw) {
        m.node = "changed";
        out.changed++;
      }
      // Atributos só são comparados entre o "mesmo" nó (mesma tag na mesma posição); um nó
      // reescrito ou deslocado já conta como tal, sem inflar a contagem de atributos.
      if (b.attrs && !m.node) {
        const oldAttrs = (a && a.attrs) || {};
        for (const k of Object.keys(b.attrs)) {
          if (!(k in oldAttrs)) { m.attrs[k] = "added"; out.attrsAdded++; }
          else if (oldAttrs[k] !== b.attrs[k]) { m.attrs[k] = "changed"; out.attrsChanged++; }
        }
        for (const k of Object.keys(oldAttrs)) if (!(k in b.attrs)) m.removedAttrs.push(k);
      }
      if (m.node || Object.keys(m.attrs).length || m.removedAttrs.length) marks.set(path, m);
      const bc = b.children || [];
      const ac = (a && a.children) || [];
      if (ac.length > bc.length) out.removed += ac.length - bc.length;
      bc.forEach((child, i) => walk(m.node === "added" ? null : ac[i], child, path + "." + i));
    };
    walk(prev, next, "r");
    return out;
  }

  /** As chaves cujo valor mudou entre dois objetos rasos. */
  function diffObj(prev, next) {
    const changed = new Set();
    for (const k of new Set([...Object.keys(prev || {}), ...Object.keys(next || {})])) {
      if (!same(prev ? prev[k] : undefined, next ? next[k] : undefined)) changed.add(k);
    }
    return changed;
  }

  /* ---------- o elemento ---------- */

  class PipelineExplorer extends HTMLElement {
    connectedCallback() {
      if (this.dataset.deltaReady) return;
      this.dataset.deltaReady = "1";
      if (!DATA) {
        this.append(el("p", "px-missing", "Dados do explorador não gerados: rode ", el("code", null, "npm run trace"), "."));
        return;
      }
      this.events = resolveEvents(DATA.events);
      this.state = { index: 0, file: 0, panel: "tree" };
      this.build();
      this.render();
    }

    /* Estrutura fixa; o conteúdo dos painéis é refeito a cada render. */
    build() {
      const root = el("div", "px");
      root.tabIndex = 0;
      root.setAttribute("aria-label", "Explorador do pipeline do compilador");
      root.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowRight") { this.go(this.state.index + 1); ev.preventDefault(); }
        if (ev.key === "ArrowLeft") { this.go(this.state.index - 1); ev.preventDefault(); }
        if (ev.key === "Home") { this.go(0); ev.preventDefault(); }
        if (ev.key === "End") { this.go(this.events.length - 1); ev.preventDefault(); }
      });

      // A linha do tempo: uma linha da esquerda para a direita, dividida em fases; um ponto por
      // evento (um passo por arquivo é um par de pontos, um passo do projeto inteiro é um ponto só).
      this.track = this.buildTrack();

      // "Ir para o passo": a lista completa de nomes, para quem procura um passo pelo nome.
      this.jump = el("select", "input px-jump");
      this.jump.setAttribute("aria-label", "Ir para o passo");
      for (const phase of DATA.phases) {
        const group = el("optgroup");
        group.label = phase.name;
        for (const step of phase.steps) {
          const opt = el("option", null, step.name + (step.kind === "all" ? " · projeto" : ""));
          opt.value = step.name;
          group.append(opt);
        }
        this.jump.append(group);
      }
      this.jump.addEventListener("change", () => this.go(this.firstEventOf(this.jump.value)));

      // Cabeçalho: navegação, passo atual, descrição, o que mudou.
      this.pos = el("span", "px-pos");
      this.prevBtn = btn("← anterior", "ghost", () => this.go(this.state.index - 1));
      this.nextBtn = btn("próximo →", "primary", () => this.go(this.state.index + 1));
      this.stepTitle = el("div", "px-step-title");
      this.what = el("p", "px-what");
      this.changes = el("p", "px-changes");
      const head = el("div", "px-head",
        el("div", "px-nav", this.prevBtn, this.pos, this.nextBtn, el("span", "px-nav-gap"), this.jump),
        this.stepTitle, this.what, this.changes);

      // Abas de arquivo e de painel.
      this.fileTabs = el("div", "px-tabs px-files");
      this.fileButtons = DATA.files.map((name, i) => {
        const b = btn(name, "ghost px-tab", () => { this.state.file = i; this.render(); });
        this.fileTabs.append(b);
        return b;
      });
      this.panelTabs = el("div", "px-tabs px-panels");
      this.panelButtons = {};
      for (const [key, label] of [["tree", "Árvore"], ["ctx", "Contexto"], ["shared", "Compartilhado"], ["html", "Saída"], ["source", "Fonte"]]) {
        const b = btn(label, "ghost px-tab", () => { this.state.panel = key; this.render(); });
        this.panelButtons[key] = b;
        this.panelTabs.append(b);
      }
      this.panel = el("div", "px-panel");

      root.append(this.track, head, el("div", "px-tabbar", this.fileTabs, this.panelTabs), this.panel);
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => this.layoutTrack()).observe(this.track);
      this.append(root);
    }

    /* A linha do tempo. Estrutura: track > phases > phase > (label, groups > group > dots). */
    buildTrack() {
      const track = el("div", "px-track");
      track.setAttribute("role", "group");
      track.setAttribute("aria-label", "Linha do tempo do pipeline");
      const inner = el("div", "px-track-inner");
      const phases = el("div", "px-phases");
      this.dots = [];
      this.labels = []; // { el, anchor, center } — posicionados por layoutTrack()
      const byStep = new Map();
      this.events.forEach((e, i) => {
        if (!byStep.has(e.step)) byStep.set(e.step, []);
        byStep.get(e.step).push(i);
      });
      DATA.phases.forEach((phase, pi) => {
        const groups = el("div", "px-groups");
        let count = 0;
        for (const step of phase.steps) {
          const group = el("div", "px-group");
          for (const i of byStep.get(step.name) || []) {
            const ev = this.events[i];
            const dot = btn("", "px-dot" + (ev.file === null ? " is-all" : ""), () => this.go(i));
            dot.title = step.name + (ev.file === null ? " · projeto inteiro" : " · " + DATA.files[ev.file]);
            dot.setAttribute("aria-label", dot.title);
            this.dots[i] = dot;
            group.append(dot);
            count++;
          }
          groups.append(group);
        }
        const node = el("div", "px-phase" + (pi % 2 ? " is-alt" : ""), groups);
        node.style.flexGrow = String(count);
        phases.append(node);
        const label = el("div", "px-phase-label", phase.name);
        label.title = DATA.descriptions.phases[phase.name] || phase.what;
        this.labels.push({ el: label, anchor: node, center: false });
        if (phase.bail && pi < DATA.phases.length - 1) {
          const gate = el("div", "px-gate", el("span", "px-gate-bar"));
          gate.title = "Ao fim desta fase, qualquer erro em qualquer arquivo interrompe a compilação.";
          phases.append(gate);
          const glabel = el("div", "px-phase-label px-gate-label", "pára se houver erro");
          glabel.title = gate.title;
          this.labels.push({ el: glabel, anchor: gate, center: true });
        }
      });
      this.line = el("div", "px-line");
      this.fill = el("div", "px-fill");
      this.marker = el("div", "px-marker", el("span", "px-marker-caret"), el("span", "px-marker-label"));
      this.labelRow = el("div", "px-labels", ...this.labels.map((l) => l.el));
      inner.append(this.labelRow, this.line, this.fill, phases, this.marker);
      this.phases = phases;
      track.append(inner);
      return track;
    }

    /* Posiciona rótulos, linha, preenchimento e marcador a partir da geometria real; roda a cada
       render e a cada redimensionamento. Rótulos que colidiriam sobem para uma linha extra. */
    layoutTrack() {
      const inner = this.track.firstElementChild;
      if (!inner.offsetParent) return;
      const innerRect = inner.getBoundingClientRect();
      const rel = (r) => ({ left: r.left - innerRect.left, top: r.top - innerRect.top, right: r.right - innerRect.left, bottom: r.bottom - innerRect.top });

      // 1. Rótulos das fases (e do portão) em linhas: o primeiro que couber sem sobrepor.
      const rowH = 15;
      const rows = []; // right edge of the last label on each row
      let used = 1;
      for (const l of this.labels) {
        const ar = rel(l.anchor.getBoundingClientRect());
        const w = l.el.offsetWidth;
        let left = l.center ? ar.left + (ar.right - ar.left) / 2 - w / 2 : ar.left + 2;
        left = Math.max(0, Math.min(innerRect.width - w - 10, left)); // 10: o recuo lateral da linha
        let row = 0;
        while (rows[row] !== undefined && rows[row] + 6 > left) row++;
        rows[row] = left + w;
        used = Math.max(used, row + 1);
        l.el.style.left = left + "px";
        l.el.style.top = row * rowH + "px";
      }
      this.labelRow.style.height = used * rowH + "px";

      // 2. A linha passa pelo centro dos pontos; o marcador fica logo abaixo deles.
      const g = rel(this.phases.getBoundingClientRect());
      const y = g.top + (g.bottom - g.top) / 2;
      this.line.style.top = this.fill.style.top = y - 1.5 + "px";
      this.marker.style.top = g.bottom + 3 + "px";

      // 3. Preenchimento até o ponto atual, e o rótulo do marcador sem sair da linha.
      const dot = this.dots[this.state.index];
      if (!dot) return;
      const dr = rel(dot.getBoundingClientRect());
      const x = (dr.left + dr.right) / 2;
      this.fill.style.width = x + "px";
      this.marker.style.left = x + "px";
      // O rótulo do marcador fica dentro da linha: primeiro sem o deslocamento anterior (que,
      // se ficasse, faria a linha "transbordar" por um instante e rolar sem motivo), depois
      // preso ao intervalo visível.
      const label = this.marker.lastElementChild;
      label.style.transform = "";
      const half = label.offsetWidth / 2;
      const clampTo = (lo, hi) => {
        const c = Math.max(lo, Math.min(hi, x));
        label.style.transform = "translateX(" + (c - x) + "px)";
      };
      clampTo(half + 4, innerRect.width - half - 4);
      // Só em telas estreitas (a linha tem largura mínima) o trilho rola: mantém o ponto atual
      // à vista e o rótulo dentro da parte visível.
      const view = this.track;
      if (view.scrollWidth > view.clientWidth) {
        if (x - view.scrollLeft < 60) view.scrollLeft = Math.max(0, x - 60);
        else if (x - view.scrollLeft > view.clientWidth - 60) view.scrollLeft = x - view.clientWidth + 60;
        clampTo(view.scrollLeft + half + 4, view.scrollLeft + view.clientWidth - half - 4);
      }
    }

    firstEventOf(stepName) {
      const i = this.events.findIndex((e) => e.step === stepName);
      return i < 0 ? 0 : i;
    }

    go(index) {
      const i = Math.max(0, Math.min(this.events.length - 1, index));
      if (i === this.state.index) return;
      this.state.index = i;
      const ev = this.events[i];
      if (ev.file !== null) this.state.file = ev.file; // segue o arquivo que o passo acabou de processar
      this.render();
    }

    render() {
      const { index, file, panel } = this.state;
      const ev = this.events[index];
      const prev = index > 0 ? this.events[index - 1] : null;
      const stepInfo = DATA.phases.flatMap((p) => p.steps).find((s) => s.name === ev.step) || {};

      // linha do tempo
      this.dots.forEach((d, i) => {
        d.classList.toggle("is-done", i < index);
        d.classList.toggle("is-current", i === index);
      });
      this.marker.lastElementChild.textContent = ev.step + (ev.file === null ? "" : " · " + DATA.files[ev.file]);
      this.jump.value = ev.step;
      this.layoutTrack();
      // cabeçalho
      this.pos.textContent = `${index + 1} / ${this.events.length}`;
      this.prevBtn.disabled = index === 0;
      this.nextBtn.disabled = index === this.events.length - 1;
      this.stepTitle.replaceChildren(
        el("span", "px-kind", ev.file === null ? "projeto inteiro" : "por arquivo · " + DATA.files[ev.file]),
        el("code", "px-step-name", ev.step),
        el("span", "px-phase-tag", ev.phase),
      );
      this.what.textContent = DATA.descriptions.steps[ev.step] || stepInfo.what || "";

      // diffs deste evento contra o anterior
      const astDiff = diffAst(prev ? prev.files[file].ast : null, ev.files[file].ast);
      const ctxChanged = diffObj(prev ? prev.files[file].ctx : null, ev.files[file].ctx);
      const sharedChanged = diffObj(prev ? prev.shared : null, ev.shared);
      const htmlChanged = !same(prev ? prev.files[file].html : null, ev.files[file].html);
      this.changes.replaceChildren(...this.describeChanges(astDiff, ctxChanged, sharedChanged, htmlChanged, prev, ev));

      // abas
      this.fileButtons.forEach((b, i) => b.classList.toggle("is-current", i === file));
      for (const [key, b] of Object.entries(this.panelButtons)) {
        b.classList.toggle("is-current", key === panel);
        const dirty = key === "tree" ? astDiff.marks.size > 0 || astDiff.removed > 0
          : key === "ctx" ? ctxChanged.size > 0
          : key === "shared" ? sharedChanged.size > 0
          : key === "html" ? htmlChanged : false;
        b.classList.toggle("is-dirty", dirty);
      }

      // painel
      this.panel.replaceChildren(
        panel === "tree" ? this.renderTree(ev.files[file].ast, astDiff)
        : panel === "ctx" ? this.renderObject(ev.files[file].ctx, ctxChanged, "ctx")
        : panel === "shared" ? this.renderShared(ev.shared, sharedChanged, prev ? prev.shared : null)
        : panel === "html" ? this.renderHtml(ev.files[file].html, DATA.files[file])
        : this.renderSource(DATA.files[file]),
      );
    }

    describeChanges(astDiff, ctxChanged, sharedChanged, htmlChanged, prev, ev) {
      if (!prev) return [el("span", "px-muted", "Estado inicial: antes de qualquer passo.")];
      const parts = [];
      const tree = [];
      if (astDiff.attrsAdded) tree.push(`+${astDiff.attrsAdded} atributo${astDiff.attrsAdded > 1 ? "s" : ""}`);
      if (astDiff.attrsChanged) tree.push(`${astDiff.attrsChanged} atributo${astDiff.attrsChanged > 1 ? "s" : ""} alterado${astDiff.attrsChanged > 1 ? "s" : ""}`);
      if (astDiff.added) tree.push(`+${astDiff.added} nó${astDiff.added > 1 ? "s" : ""}`);
      if (astDiff.changed) tree.push(`${astDiff.changed} nó${astDiff.changed > 1 ? "s" : ""} reescrito${astDiff.changed > 1 ? "s" : ""}`);
      if (astDiff.removed) tree.push(`−${astDiff.removed} nó${astDiff.removed > 1 ? "s" : ""}`);
      if (tree.length) parts.push(el("span", "px-chip", el("b", null, "Árvore: "), tree.join(", ")));
      if (ctxChanged.size) parts.push(el("span", "px-chip", el("b", null, "Contexto: "), [...ctxChanged].join(", ")));
      if (sharedChanged.size) {
        const items = [...sharedChanged].map((k) => {
          if (k === "registry") {
            const before = Object.keys(prev.shared.registry).length;
            const after = Object.keys(ev.shared.registry).length;
            return after > before ? `registry (+${after - before})` : "registry";
          }
          return k;
        });
        parts.push(el("span", "px-chip", el("b", null, "Compartilhado: "), items.join(", ")));
      }
      if (htmlChanged) {
        const h = ev.files[this.state.file].html;
        const bits = [];
        if (h) {
          bits.push(`${h.templates.length} template${h.templates.length === 1 ? "" : "s"}`);
          if (h.islands.length) bits.push("ilhas: " + h.islands.map((i) => i.replace("delta-", "")).join(", "));
          if (h.katexCss) bits.push("CSS do KaTeX");
        }
        parts.push(el("span", "px-chip", el("b", null, "Saída: "), bits.join(", ") || "HTML gerado"));
      }
      if (!parts.length) {
        const which = ev.file === null ? "neste passo" : `neste passo, para ${DATA.files[this.state.file]}`;
        return [el("span", "px-muted", `Nada mudou ${which}.`)];
      }
      return [el("b", null, "Mudou · "), ...parts];
    }

    renderTree(ast, diff) {
      if (!ast) return el("p", "px-muted", "Ainda não há árvore: o arquivo só é lido e analisado nos passos readSource e parse.");
      const box = el("div", "px-tree");
      const line = (node, path, depth) => {
        const m = diff.marks.get(path);
        const row = el("div", "px-node" + (m && m.node ? " is-" + m.node : ""));
        row.style.setProperty("--depth", depth);
        if ("text" in node) {
          row.append(el("span", "px-text", "“" + node.text + "”"));
        } else if ("raw" in node) {
          row.append(el("span", "px-raw", "⟨" + node.raw + "⟩"));
        } else {
          row.append(el("span", "px-tag", "<" + node.tag));
          for (const [k, v] of Object.entries(node.attrs)) {
            const status = m && m.attrs[k];
            row.append(" ", el("span", "px-attr" + (status ? " is-" + status : ""), el("span", "px-attr-k", k), "=", el("span", "px-attr-v", "\"" + v + "\"")));
          }
          if (m && m.removedAttrs.length) {
            for (const k of m.removedAttrs) row.append(" ", el("span", "px-attr is-removed", k));
          }
          row.append(el("span", "px-tag", ">"));
        }
        box.append(row);
        if (node.children) node.children.forEach((c, i) => line(c, path + "." + i, depth + 1));
      };
      line(ast, "r", 0);
      if (diff.removed) box.append(el("div", "px-muted px-note", `${diff.removed} nó(s) que existiam antes deste passo não existem mais.`));
      return box;
    }

    renderObject(obj, changed, kind) {
      const table = el("table", "px-kv");
      for (const [k, v] of Object.entries(obj)) {
        const empty = v === null || v === false || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);
        const row = el("tr", (changed.has(k) ? "is-changed" : "") + (empty ? " is-empty" : ""),
          el("th", null, el("code", null, k)),
          el("td", null, this.renderValue(v)));
        table.append(row);
      }
      const note = kind === "ctx"
        ? "O CompileContext deste arquivo. registry, papers, citedPapers e team são compartilhados, e globalById/idToFile são do projeto: veja a aba Compartilhado."
        : "";
      return el("div", "px-object", note ? el("p", "px-muted px-note", note) : null, table);
    }

    renderValue(v) {
      if (v === null || v === undefined) return el("span", "px-muted", "—");
      if (typeof v === "boolean") return el("code", null, String(v));
      if (typeof v === "string" || typeof v === "number") return el("code", null, String(v));
      if (Array.isArray(v)) {
        if (!v.length) return el("span", "px-muted", "[ ]");
        return el("code", "px-json", v.map(fmt).join("\n"));
      }
      const keys = Object.keys(v);
      if (!keys.length) return el("span", "px-muted", "{ }");
      return el("code", "px-json", keys.map((k) => `${k}: ${fmt(v[k])}`).join("\n"));
    }

    renderShared(shared, changed, prevShared) {
      const wrap = el("div", "px-object");
      wrap.append(el("p", "px-muted px-note", "O estado que todos os arquivos compartilham: os contadores atravessam os arquivos, e cada ctx aponta para os mesmos mapas."));

      // Contadores: os dois mapas lado a lado.
      const counters = el("table", "px-kv px-counters");
      counters.append(el("tr", null, el("th", null, "contador"), el("th", null, "valor"), el("th", null, "exibido")));
      const names = new Set([...Object.keys(shared.counters), ...Object.keys(shared.display)]);
      for (const name of names) {
        const before = prevShared ? prevShared.counters[name] : undefined;
        const row = el("tr", before !== shared.counters[name] ? "is-changed" : "",
          el("th", null, el("code", null, name)),
          el("td", null, el("code", null, String(shared.counters[name] ?? 0))),
          el("td", null, el("code", null, shared.display[name] ?? "")));
        counters.append(row);
      }
      wrap.append(el("h4", "px-h", "numbering", changed.has("counters") || changed.has("display") ? el("span", "px-dot") : null),
        names.size ? counters : el("p", "px-muted", "Nenhum contador ainda."));

      // Registro: id → tag, num. Só o que uma referência precisa para montar o rótulo.
      const reg = el("table", "px-kv px-registry");
      reg.append(el("tr", null, el("th", null, "id"), el("th", null, "tag"), el("th", null, "num")));
      for (const [id, e] of Object.entries(shared.registry)) {
        const isNew = !prevShared || !(id in prevShared.registry);
        reg.append(el("tr", isNew && prevShared ? "is-changed" : "",
          el("th", null, el("code", null, id)), el("td", null, el("code", null, e.tag)),
          el("td", null, el("code", null, e.num || "—"))));
      }
      wrap.append(el("h4", "px-h", "registry", changed.has("registry") ? el("span", "px-dot") : null),
        el("p", "px-muted px-note", "id → { tag, num }: escrito por numberDocument, lido por resolveReferences (o rótulo da referência) e por renderMath (\\ref{})."),
        Object.keys(shared.registry).length ? reg : el("p", "px-muted", "Vazio até numberDocument."));

      // globalById + idToFile: id → o nó inteiro (aqui, sua tag) e o arquivo de saída onde ele mora.
      const gb = el("table", "px-kv px-global");
      gb.append(el("tr", null, el("th", null, "id"), el("th", null, "nó (tag)"), el("th", null, "arquivo de saída")));
      for (const [id, tag] of Object.entries(shared.globalById || {})) {
        const isNew = !prevShared || !((prevShared.globalById || {})[id]);
        gb.append(el("tr", isNew && prevShared ? "is-changed" : "",
          el("th", null, el("code", null, id)), el("td", null, el("code", null, tag)),
          el("td", null, el("code", null, shared.idToFile[id] || "—"))));
      }
      wrap.append(el("h4", "px-h", "globalById + idToFile", changed.has("globalById") || changed.has("idToFile") ? el("span", "px-dot") : null),
        el("p", "px-muted px-note", "Construídos por buildIdMaps sobre todos os arquivos. globalById guarda o próprio nó (não uma cópia): emit o serializa num <template> em cada saída que o referencia. idToFile dá o arquivo do salto (data-target-href)."),
        Object.keys(shared.globalById || {}).length ? gb : el("p", "px-muted", "Vazios até buildIdMaps."));

      // O resto, como pares chave/valor.
      const rest = {};
      for (const k of ["papers", "citedPapers", "team", "bibOut", "projectImports", "projectDiagnostics"]) rest[k] = shared[k];
      wrap.append(el("h4", "px-h", "o resto"), this.renderObject(rest, changed, "shared"));
      return wrap;
    }

    renderHtml(h, name) {
      const wrap = el("div", "px-object");
      if (!h) {
        wrap.append(el("p", "px-muted", `${name} ainda não foi emitido: o HTML só existe depois do passo emit.`));
        return wrap;
      }
      wrap.append(el("p", "px-muted px-note", `O que emit escreveu em ${name.replace(/\.dlt$/, ".html")} além da árvore serializada: ${(h.bytes / 1024).toFixed(0)} KB no total.`));
      const t = el("table", "px-kv px-templates");
      t.append(el("tr", null, el("th", null, "template (id)"), el("th", null, "nó vindo de"), el("th", null, "conteúdo serializado")));
      for (const tp of h.templates) {
        t.append(el("tr", null, el("th", null, el("code", null, tp.id)), el("td", null, el("code", null, tp.from)), el("td", null, el("code", "px-json", tp.html))));
      }
      wrap.append(el("h4", "px-h", "templates para as prévias"),
        el("p", "px-muted px-note", "Um por id em referencedIds; o nó vem de globalById, mesmo quando mora em outro arquivo. O runtime clona o template no popover, sem fetch."),
        h.templates.length ? t : el("p", "px-muted", "Nenhum: este arquivo não referencia nada."));
      const rest = { islands: h.islands, katexCss: h.katexCss, packs: h.packs };
      wrap.append(el("h4", "px-h", "ilhas, CSS e pacotes"), this.renderObject(rest, new Set(), "html"));
      return wrap;
    }

    renderSource(name) {
      const src = DATA.sources[name] || "";
      return el("div", "px-object",
        el("p", "px-muted px-note", `${name}, como o autor escreveu. Compare com a árvore após o passo parse.`),
        el("pre", "px-src", src));
    }
  }

  customElements.define("delta-pipeline-explorer", PipelineExplorer);
})();
