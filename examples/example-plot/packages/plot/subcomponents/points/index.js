class DeltaPoints extends HTMLElement {
    build(plot) {
        this.sizeAttr = this.getAttribute("size") || "1";
        this.interactionAttr = this.getAttribute("interaction") || "true";

        parsePointsAttributes(this, this.sizeAttr, this.interactionAttr, plot);

        this.floatingBadge = this.buildFloatingBadge(plot);
        plot.container.append(this.floatingBadge);

        this.footer = this.buildFooter(plot);
        plot.container.append(this.footer);
    }

    bind(plot) {
        this.plot = plot;
        plot.tabIndex = 0;

        plot.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e, plot));
        plot.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e, plot));
        plot.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e, plot));
        plot.canvas.addEventListener("pointercancel", (e) => this.onPointerUp(e, plot));
        plot.canvas.addEventListener("pointerleave", () => {
            if (this.mode && this.draggingId === null) this.hoverId = null;
        });

        plot.addEventListener("keydown", (e) => this.onKeyDown(e, plot));

        document.addEventListener("pointerdown", (e) => {
            if (!plot.contains(e.target) && this.selectedId !== null) {
                this.selectedId = null;
                plot.render();
            }
        });
    }

    render(ctx, w, h, plot) {
        if (this.deleteSelectedBtn) {
            this.deleteSelectedBtn.disabled = (this.selectedId === null);
        }
        this.updateFloatingBadge();
        this.updateStatus();

        const points = plot.data?.points || [];
        if (!points.length) return;

        const defaultAccent = getComputedStyle(plot).getPropertyValue("--delta-accent").trim() || "rgb(80, 80, 80)";

        for (const p of points) {
            if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;

            const pos = worldToScreen(p.x, p.y, plot, w, h);
            const radius = 3 * (p.size || this.size || 1);
            const pointColor = p.color || defaultAccent;
            const isSel = p.id === this.selectedId;

            if (isSel) {
                ctx.beginPath();
                ctx.arc(pos.sx, pos.sy, radius + 6, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(80, 80, 80, 0.18)";
                ctx.fill();
                ctx.strokeStyle = pointColor;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(pos.sx, pos.sy, radius, 0, Math.PI * 2);
            ctx.fillStyle = isSel ? pointColor : "#ffffff";
            ctx.fill();
            ctx.strokeStyle = isSel ? "#ffffff" : pointColor;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    // UI Construction

    buildFooter(plot) {
        const footer = document.createElement("div");
        footer.className = "plot-footer";

        this.statusEl = document.createElement("span");
        this.statusEl.className = "plot-footer-status";
        this.updateStatus();
        footer.append(this.statusEl);

        if (this.interaction === "false") return footer;

        const actions = document.createElement("div");
        actions.className = "plot-footer-actions";

        // Mode toggle button
        const modeTitle = this.interaction === "move" ? "Modo de movimentação de pontos" : "Modo de manipulação de pontos";
        this.modeBtn = this.createBtn("plot-footer-btn", modeTitle,
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/></svg>`,
            () => {
                this.setMode(!this.mode);
                if (this.mode) plot.focus();
            }
        );
        actions.append(this.modeBtn);

        if (this.interaction === "true") {
            this.deleteSelectedBtn = this.createBtn("plot-footer-btn", "Deletar ponto selecionado",
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M18 6L6 18M6 6l12 12"/></svg>`,
                () => {
                    if (this.selectedId !== null) {
                        this.removePoint(this.selectedId);
                        if (this.mode) plot.focus();
                    }
                }
            );
            this.deleteSelectedBtn.disabled = true;
            actions.append(this.deleteSelectedBtn);

            this.clearBtn = this.createBtn("plot-footer-btn", "Limpar todos os pontos",
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/></svg>`,
                () => {
                    this.clearPoints();
                    if (this.mode) plot.focus();
                }
            );
            actions.append(this.clearBtn);
        }

        footer.append(actions);
        return footer;
    }

    buildFloatingBadge(plot) {
        const badge = document.createElement("div");
        badge.className = "plot-point-badge";

        this.floatingBadgeCoords = document.createElement("span");
        badge.append(this.floatingBadgeCoords);

        this.floatingBadgeDelete = document.createElement("button");
        this.floatingBadgeDelete.type = "button";
        this.floatingBadgeDelete.className = "plot-point-badge-delete";
        this.floatingBadgeDelete.title = "Deletar ponto";
        this.floatingBadgeDelete.setAttribute("aria-label", "Deletar ponto");
        this.floatingBadgeDelete.textContent = "×";
        this.floatingBadgeDelete.addEventListener("pointerdown", (e) => e.stopPropagation());
        this.floatingBadgeDelete.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (this.selectedId !== null) {
                this.removePoint(this.selectedId);
                if (this.mode) plot.focus();
            }
        });

        badge.append(this.floatingBadgeDelete);
        return badge;
    }

    createBtn(className, title, innerHTML, onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = className;
        btn.title = title;
        btn.setAttribute("aria-label", title);
        btn.innerHTML = innerHTML;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            onClick(e);
        });
        return btn;
    }

    updateFloatingBadge() {
        if (!this.floatingBadge || !this.plot) return;
        const p = this.plot.data?.points?.find(pt => pt && pt.id === this.selectedId);
        if (!p || typeof p.x !== "number" || typeof p.y !== "number" || this.interaction === "false") {
            this.floatingBadge.style.display = "none";
            return;
        }

        if (this.floatingBadgeDelete) {
            this.floatingBadgeDelete.style.display = (this.interaction === "true") ? "inline-flex" : "none";
        }

        const pos = worldToScreen(p.x, p.y, this.plot);
        const radius = 3 * (p.size || this.size || 1);
        const cx = (this.plot.canvas.offsetLeft || 0) + pos.sx;
        const cy = (this.plot.canvas.offsetTop || 0) + pos.sy - radius - 6;

        if (pos.sx >= 0 && pos.sx <= this.plot.canvas.clientWidth && pos.sy >= 0 && pos.sy <= this.plot.canvas.clientHeight) {
            this.floatingBadge.style.display = "flex";
            this.floatingBadge.style.left = `${cx}px`;
            this.floatingBadge.style.top = `${cy}px`;
            this.floatingBadgeCoords.textContent = `(${formatNumber(p.x)}, ${formatNumber(p.y)})`;
        } else {
            this.floatingBadge.style.display = "none";
        }
    }

    updateStatus() {
        if (!this.statusEl) return;
        const count = (this.plot?.data?.points || []).length;
        this.statusEl.textContent = `${count} ${count === 1 ? "ponto" : "pontos"}`;
    }

    setMode(mode) {
        this.mode = Boolean(mode);
        this.modeBtn?.classList.toggle("active", this.mode);
        if (!this.mode) {
            this.selectedId = this.draggingId = this.hoverId = null;
            if (this.plot?.canvas) this.plot.canvas.style.cursor = this.plot.grab ? "grab" : "default";
        } else {
            if (this.plot?.canvas) this.plot.canvas.style.cursor = this.interaction === "move" ? "default" : "crosshair";
        }
        if (this.plot) this.plot.render();
    }

    isDraggingEntity() {
        return this.mode && this.interaction !== "false";
    }

    // Points Operations

    addPoint(x, y, size = this.size, color) {
        const pt = { x, y, size, ...(color && { color }) };
        this.plot.data.points.push(pt);
        this.selectedId = this.draggingId = pt.id;
        this.dragOffset = { x: 0, y: 0 };
        return pt;
    }

    removePoint(id) {
        const idx = this.plot.data.points.findIndex(p => p && p.id === id);
        if (idx !== -1) this.plot.data.points.splice(idx, 1);
        if (this.selectedId === id) this.selectedId = null;
        if (this.draggingId === id) this.draggingId = null;
        if (this.hoverId === id) this.hoverId = null;
    }

    clearPoints() {
        this.plot.data.points.length = 0;
        this.selectedId = this.draggingId = this.hoverId = null;
    }

    movePoint(id, x, y) {
        const p = this.plot.data.points.find(pt => pt && pt.id === id);
        if (p) {
            p.x = x;
            p.y = y;
        }
    }

    hitTest(sx, sy, plot) {
        const points = plot.data?.points || [];
        for (let i = points.length - 1; i >= 0; i--) {
            const p = points[i];
            if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;
            const pos = worldToScreen(p.x, p.y, plot);
            const r = Math.max(12, 3 * (p.size || this.size || 1) + 6);
            if (Math.hypot(pos.sx - sx, pos.sy - sy) <= r) return p;
        }
        return null;
    }

    // Event Handlers

    onPointerDown(e, plot) {
        if (!this.mode || this.interaction === "false") return;
        plot.focus();
        const r = plot.canvas.getBoundingClientRect();
        const sx = e.clientX - r.left;
        const sy = e.clientY - r.top;

        const hit = this.hitTest(sx, sy, plot);
        if (hit) {
            this.selectedId = this.draggingId = hit.id;
            const hitScreen = worldToScreen(hit.x, hit.y, plot);
            this.dragOffset = { x: hitScreen.sx - sx, y: hitScreen.sy - sy };
            try { plot.canvas.setPointerCapture(e.pointerId); } catch (_) {}
            plot.render();
        } else if (this.interaction === "true") {
            const world = screenToWorld(sx, sy, plot);
            this.addPoint(world.x, world.y, this.size);
            try { plot.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        } else if (this.interaction === "move" && this.selectedId !== null) {
            this.selectedId = null;
            plot.render();
        }
    }

    onPointerMove(e, plot) {
        if (!this.mode || this.interaction === "false") return;
        const r = plot.canvas.getBoundingClientRect();
        const sx = e.clientX - r.left;
        const sy = e.clientY - r.top;

        if (this.draggingId !== null) {
            const world = screenToWorld(sx + this.dragOffset.x, sy + this.dragOffset.y, plot);
            this.movePoint(this.draggingId, world.x, world.y);
        } else {
            const hit = this.hitTest(sx, sy, plot);
            const newHover = hit ? hit.id : null;
            if (newHover !== this.hoverId) {
                this.hoverId = newHover;
                plot.canvas.style.cursor = hit ? "pointer" : (this.interaction === "move" ? "default" : "crosshair");
            }
        }
    }

    onPointerUp(e, plot) {
        if (!this.mode) return;
        if (this.draggingId !== null) {
            try { plot.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
            this.draggingId = null;
            plot.render();
        }
    }

    onKeyDown(e, plot) {
        if (e.key === "Escape" && this.selectedId !== null) {
            e.preventDefault();
            this.selectedId = null;
            plot.render();
        } else if ((e.key === "Delete" || e.key === "Backspace") && this.interaction === "true" && this.mode && this.selectedId !== null) {
            e.preventDefault();
            this.removePoint(this.selectedId);
        }
    }
}

customElements.define("delta-points", DeltaPoints);