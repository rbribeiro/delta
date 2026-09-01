/**
 * Calcula o fecho convexo de um conjunto de pontos 2D usando o algoritmo
 * Monotone Chain (Andrew's Algorithm) em tempo O(N log N).
 */
function convexHull(points) {
  if (points.length < 3) return points.slice();
  const sorted = points.slice().sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

class DeltaConvexHull extends HTMLElement {
  points = [];
  hull = null;
  selectedId = null;
  draggingId = null;
  hoverId = null;
  nextId = 1;
  timer = null;

  /**
   * Ciclo de vida: inicializa o componente no DOM, lê atributos de configuração e inicia a interface.
   */
  connectedCallback() {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    this.tabIndex = 0;

    const delay = parseFloat(this.getAttribute("delay") || "0.5");
    this.delayMs = isNaN(delay) ? 500 : Math.max(0, delay * 1000);

    this.build();
    this.bind();
    this.resize();
    this.render();
  }

  /**
   * Cria e insere os elementos HTML internos (container, cabeçalho de status e canvas).
   */
  build() {
    this.innerHTML = "";
    this.container = document.createElement("div");
    this.container.className = "convex-hull-container";

    this.header = document.createElement("div");
    this.header.className = "convex-hull-header";

    this.statusEl = document.createElement("span");
    this.statusEl.className = "convex-hull-status";
    this.statusEl.textContent = "Clique para adicionar pontos";

    const controls = document.createElement("div");
    controls.className = "convex-hull-controls";

    this.countEl = document.createElement("span");
    this.countEl.className = "convex-hull-count";
    this.countEl.textContent = "0 pontos";

    this.clearBtn = document.createElement("button");
    this.clearBtn.type = "button";
    this.clearBtn.className = "convex-hull-btn";
    this.clearBtn.textContent = "Limpar";

    controls.append(this.countEl, this.clearBtn);
    this.header.append(this.statusEl, controls);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "convex-hull-canvas";
    this.ctx = this.canvas.getContext("2d");

    this.container.append(this.header, this.canvas);
    this.append(this.container);
  }

  /**
   * Registra os listeners de eventos delegando a execução para métodos específicos.
   */
  bind() {
    new ResizeObserver(() => this.onResize()).observe(this.canvas);
    this.clearBtn.addEventListener("click", () => this.onClear());

    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.canvas.addEventListener("pointerleave", () => this.onPointerLeave());

    this.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  /**
   * Trata o clique inicial no canvas: seleciona ponto existente ou cria um novo ponto no vazio.
   */
  onPointerDown(e) {
    this.focus();
    this.canvas.setPointerCapture(e.pointerId);
    const pos = this.canvasPos(e);
    const hit = this.hitTest(pos.x, pos.y);

    if (hit) {
      this.selectedId = hit.id;
      this.draggingId = hit.id;
      this.dragOffset = { x: hit.x - pos.x, y: hit.y - pos.y };
    } else {
      this.addPoint(pos.x, pos.y);
    }
    this.render();
  }

  /**
   * Trata a movimentação do mouse: move o ponto em arraste ou atualiza o cursor de hover.
   */
  onPointerMove(e) {
    const pos = this.canvasPos(e);

    if (this.draggingId !== null) {
      this.moveDraggingPoint(pos);
    } else {
      this.updateHover(pos);
    }
  }

  /**
   * Finaliza o arraste do ponto e libera o pointer.
   */
  onPointerUp(e) {
    if (this.draggingId === null) return;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    this.draggingId = null;
    this.render();
  }

  /**
   * Limpa o estado de hover quando o cursor sai do canvas.
   */
  onPointerLeave() {
    if (this.draggingId === null && this.hoverId !== null) {
      this.hoverId = null;
      this.render();
    }
  }

  /**
   * Deleção de pontos com backspace ou delete.
   */
  onKeyDown(e) {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selectedId !== null) {
        e.preventDefault();
        this.deleteSelectedPoint();
      }
    }
  }

  /**
   * Reseta e remove todos os pontos registrados no canvas.
   */
  onClear() {
    this.points = [];
    this.selectedId = null;
    this.hoverId = null;
    this.trigger();
  }

  /**
   * Redimensiona e redesenha o canvas quando o container muda de tamanho.
   */
  onResize() {
    this.resize();
    this.render();
  }

  /**
   * Adiciona um novo ponto nas coordenadas especificadas e agenda o recálculo do fecho.
   */
  addPoint(x, y) {
    const pt = { id: this.nextId++, x: Math.round(x), y: Math.round(y) };
    this.points.push(pt);
    this.selectedId = pt.id;
    this.draggingId = pt.id;
    this.dragOffset = { x: 0, y: 0 };
    this.trigger();
  }

  /**
   * Move o ponto atualmente arrastado respeitando as bordas do canvas.
   */
  moveDraggingPoint(pos) {
    const p = this.points.find((pt) => pt.id === this.draggingId);
    if (!p) return;

    const r = this.canvas.getBoundingClientRect();
    p.x = Math.max(8, Math.min(r.width - 8, Math.round(pos.x + this.dragOffset.x)));
    p.y = Math.max(8, Math.min(r.height - 8, Math.round(pos.y + this.dragOffset.y)));
    this.trigger();
  }

  /**
   * Atualiza o ponto sob foco do mouse (hover) e o cursor correspondente.
   */
  updateHover(pos) {
    const hit = this.hitTest(pos.x, pos.y);
    const newHover = hit ? hit.id : null;
    if (newHover !== this.hoverId) {
      this.hoverId = newHover;
      this.canvas.style.cursor = hit ? "pointer" : "crosshair";
      this.render();
    }
  }

  /**
   * Exclui o ponto atualmente selecionado e agenda o recálculo do fecho.
   */
  deleteSelectedPoint() {
    this.points = this.points.filter((p) => p.id !== this.selectedId);
    this.selectedId = null;
    this.hoverId = null;
    this.trigger();
  }

  /**
   * Converte as coordenadas do evento na tela para coordenadas relativas ao canvas.
   */
  canvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /**
   * Identifica se existe algum ponto registrado sob o raio de clique nas coordenadas (x, y).
   */
  hitTest(x, y) {
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy <= 169) return p;
    }
    return null;
  }

  /**
   * Ajusta o tamanho do buffer do canvas considerando a densidade de pixels da tela.
   */
  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Apaga o hull anterior imediatamente e agenda o novo cálculo após o delay.
   */
  trigger() {
    this.hull = null;
    this.statusEl.textContent = "Calculando...";
    this.countEl.textContent = `${this.points.length} ${this.points.length === 1 ? "ponto" : "pontos"}`;

    if (this.timer) clearTimeout(this.timer);
    this.render();

    this.timer = setTimeout(() => {
      this.hull = convexHull(this.points);
      this.updateStatus();
      this.render();
    }, this.delayMs);
  }

  /**
   * Atualiza a mensagem de status exibida no cabeçalho.
   */
  updateStatus() {
    const count = this.points.length;
    this.countEl.textContent = `${count} ${count === 1 ? "ponto" : "pontos"}`;

    if (count === 0) {
      this.statusEl.textContent = "Clique para adicionar pontos";
    } else if (this.hull && this.hull.length >= 3) {
      this.statusEl.textContent = `Fecho convexo: ${this.hull.length} vértices`;
    } else {
      this.statusEl.textContent = `${count} ${count === 1 ? "ponto" : "pontos"}`;
    }
  }

  /**
   * Orquestra o desenho do canvas: limpa a tela, desenha a grade, o fecho e os pontos.
   */
  render() {
    if (!this.ctx) return;
    const r = this.canvas.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    this.ctx.clearRect(0, 0, w, h);

    const style = getComputedStyle(this);
    const accent = style.getPropertyValue("--delta-accent").trim() || "#4f46e5";
    const text = style.getPropertyValue("--delta-color-text").trim() || "#333333";

    this.drawGrid(w, h);
    this.drawHull(accent);
    this.drawPoints(accent, text);
  }

  /**
   * Desenha as linhas da grade suave de fundo do canvas.
   */
  drawGrid(width, height) {
    this.ctx.strokeStyle = "rgba(128, 128, 128, 0.08)";
    this.ctx.lineWidth = 1;

    for (let x = 24; x < width; x += 24) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
    for (let y = 24; y < height; y += 24) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  /**
   * Desenha o polígono ou segmento de reta representando o fecho convexo.
   */
  drawHull(accentColor) {
    if (!this.hull || this.hull.length < 2) return;

    this.ctx.beginPath();
    this.ctx.moveTo(this.hull[0].x, this.hull[0].y);
    for (let i = 1; i < this.hull.length; i++) {
      this.ctx.lineTo(this.hull[i].x, this.hull[i].y);
    }

    if (this.hull.length >= 3) {
      this.ctx.closePath();
      this.ctx.fillStyle = "rgba(79, 70, 229, 0.12)";
      this.ctx.fill();
    }

    this.ctx.strokeStyle = accentColor;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  /**
   * Desenha todos os pontos, seus halos de seleção e etiquetas de coordenadas.
   */
  drawPoints(accentColor, textColor) {
    for (const p of this.points) {
      const isSel = p.id === this.selectedId;
      const isHov = p.id === this.hoverId;
      const isVertex = this.hull && this.hull.some((hp) => hp.x === p.x && hp.y === p.y);

      if (isSel) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        this.ctx.fillStyle = "rgba(79, 70, 229, 0.2)";
        this.ctx.fill();
        this.ctx.strokeStyle = accentColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      this.ctx.fillStyle = isSel || isVertex ? accentColor : "#ffffff";
      this.ctx.fill();
      this.ctx.strokeStyle = isSel || isVertex ? "#ffffff" : textColor;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      if (isSel || isHov) {
        this.ctx.font = "11px system-ui, sans-serif";
        this.ctx.fillStyle = textColor;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "bottom";
        this.ctx.fillText(`(${p.x}, ${p.y})`, p.x, p.y - 10);
      }
    }
  }

  /**
   * Ciclo de vida: limpa os timers ativos quando o componente é desconectado do DOM.
   */
  disconnectedCallback() {
    if (this.timer) clearTimeout(this.timer);
  }
}

customElements.define("delta-convex-hull", DeltaConvexHull);
