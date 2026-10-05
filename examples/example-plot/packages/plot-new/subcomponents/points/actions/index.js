// Points Controller Actions

// Options & Controller State
function parsePointsOptions(el) {
    const rawSize = parseFloat(el.getAttribute("size"));
    const defaultSize = isNaN(rawSize) ? 1 : Math.max(0.1, Math.min(10, rawSize));
    const defaultColor = el.getAttribute("color") || null;
    const interaction = parseOption(el.getAttribute("interaction"), ["true", "false", "move"]);

    return { defaultSize, defaultColor, interaction };
}

function createPointsState() {
    return {
        mode: false,
        selectedId: null,
        draggingId: null,
        hoverId: null,
        dragOffset: { x: 0, y: 0 }
    };
}

// Hit Testing
function hitTestPoint(plot, sx, sy, defaultSize) {
    const points = plot.data?.points || [];
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;

        const pos = worldToScreen(p.x, p.y, plot);
        const radius = Math.max(12, 3 * (p.size || defaultSize) + 6);
        if (Math.hypot(pos.sx - sx, pos.sy - sy) <= radius) {
            return p;
        }
    }
    return null;
}

function deleteSelectedPoint(controller, plot) {
    if (controller.state.selectedId === null) return;
    removePoint(plot, controller.state.selectedId);
    controller.state.selectedId = null;
    if (controller.state.mode) plot.focus();
}

// UI Elements Construction
function createPointsFooter(controller, plot) {
    const footer = document.createElement("div");
    footer.className = "plot-footer";

    controller.statusEl = document.createElement("span");
    controller.statusEl.className = "plot-footer-status";
    footer.append(controller.statusEl);

    if (controller.options.interaction === "false") {
        return footer;
    }

    const actions = document.createElement("div");
    actions.className = "plot-footer-actions";

    // Mode Toggle Button
    const isMoveOnly = (controller.options.interaction === "move");
    const modeTitle = isMoveOnly ? "Modo de movimentação de pontos" : "Modo de manipulação de pontos";
    controller.modeBtn = createButton("plot-footer-btn", modeTitle,
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/></svg>`,
        () => {
            setPointsMode(controller, plot, !controller.state.mode);
            if (controller.state.mode) plot.focus();
        }
    );
    actions.append(controller.modeBtn);

    if (controller.options.interaction === "true") {
        // Delete Selected Button
        controller.deleteSelectedBtn = createButton("plot-footer-btn", "Deletar ponto selecionado",
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M18 6L6 18M6 6l12 12"/></svg>`,
            () => deleteSelectedPoint(controller, plot)
        );
        controller.deleteSelectedBtn.disabled = true;
        actions.append(controller.deleteSelectedBtn);

        // Clear All Points Button
        controller.clearBtn = createButton("plot-footer-btn", "Limpar todos os pontos",
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/></svg>`,
            () => {
                clearPoints(plot);
                controller.state.selectedId = null;
                controller.state.draggingId = null;
                if (controller.state.mode) plot.focus();
            }
        );
        actions.append(controller.clearBtn);
    }

    footer.append(actions);
    return footer;
}

function createFloatingBadge(controller, plot) {
    const badge = document.createElement("div");
    badge.className = "plot-point-badge";

    controller.badgeCoords = document.createElement("span");
    badge.append(controller.badgeCoords);

    controller.badgeDelete = document.createElement("button");
    controller.badgeDelete.type = "button";
    controller.badgeDelete.className = "plot-point-badge-delete";
    controller.badgeDelete.title = "Deletar ponto";
    controller.badgeDelete.textContent = "×";

    controller.badgeDelete.addEventListener("pointerdown", e => e.stopPropagation());
    controller.badgeDelete.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSelectedPoint(controller, plot);
    });

    badge.append(controller.badgeDelete);
    return badge;
}

function createButton(className, title, innerHTML, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.title = title;
    btn.innerHTML = innerHTML;
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick(e);
    });
    return btn;
}

function setPointsMode(controller, plot, active) {
    controller.state.mode = Boolean(active);
    controller.modeBtn?.classList.toggle("active", controller.state.mode);

    if (!controller.state.mode) {
        controller.state.selectedId = null;
        controller.state.draggingId = null;
        controller.state.hoverId = null;
        if (plot.canvas) plot.canvas.style.cursor = plot.grab ? "grab" : "default";
    } else {
        if (plot.canvas) {
            const isMoveOnly = (controller.options.interaction === "move");
            plot.canvas.style.cursor = isMoveOnly ? "default" : "crosshair";
        }
    }
    plot.render();
}

function updatePointsUI(controller, plot) {
    // Update footer status text
    const count = (plot.data?.points || []).length;
    if (controller.statusEl) {
        controller.statusEl.textContent = `${count} ${count === 1 ? "ponto" : "pontos"}`;
    }

    // Update delete button state
    if (controller.deleteSelectedBtn) {
        controller.deleteSelectedBtn.disabled = (controller.state.selectedId === null);
    }

    // Update floating badge position & visibility
    if (!controller.badge) return;
    const selected = plot.data?.points?.find(p => p && p.id === controller.state.selectedId);
    if (!selected || typeof selected.x !== "number" || typeof selected.y !== "number" || controller.options.interaction === "false") {
        controller.badge.style.display = "none";
        return;
    }

    if (controller.badgeDelete) {
        controller.badgeDelete.style.display = (controller.options.interaction === "true") ? "inline-flex" : "none";
    }

    const pos = worldToScreen(selected.x, selected.y, plot);
    const radius = 3 * (selected.size || controller.options.defaultSize);
    const cx = (plot.canvas.offsetLeft || 0) + pos.sx;
    const cy = (plot.canvas.offsetTop || 0) + pos.sy - radius - 6;

    if (pos.sx >= 0 && pos.sx <= plot.canvas.clientWidth && pos.sy >= 0 && pos.sy <= plot.canvas.clientHeight) {
        controller.badge.style.display = "flex";
        controller.badge.style.left = `${cx}px`;
        controller.badge.style.top = `${cy}px`;
        controller.badgeCoords.textContent = `(${formatNumber(selected.x)}, ${formatNumber(selected.y)})`;
    } else {
        controller.badge.style.display = "none";
    }
}

// Canvas Points Layer Rendering
function drawPointsLayer(ctx, w, h, plot, controller) {
    const points = plot.data?.points || [];
    if (!points.length) return;

    const defaultAccent = getPlotStyles(plot).accent;

    for (const p of points) {
        if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;

        const pos = worldToScreen(p.x, p.y, plot, w, h);
        const radius = 3 * (p.size || controller.options.defaultSize);
        const pointColor = p.color || controller.options.defaultColor || defaultAccent;
        const isSelected = (p.id === controller.state.selectedId);

        // Highlight ring for selected point
        if (isSelected) {
            ctx.beginPath();
            ctx.arc(pos.sx, pos.sy, radius + 6, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(80, 80, 80, 0.18)";
            ctx.fill();
            ctx.strokeStyle = pointColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Point body and border
        ctx.beginPath();
        ctx.arc(pos.sx, pos.sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? pointColor : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = isSelected ? "#ffffff" : pointColor;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Event Bindings
function bindPointsInteractions(controller, plot) {
    plot.tabIndex = 0;

    plot.canvas.addEventListener("pointerdown", (e) => {
        if (!controller.state.mode || controller.options.interaction === "false") return;
        plot.focus();

        const rect = plot.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        const hit = hitTestPoint(plot, sx, sy, controller.options.defaultSize);
        if (hit) {
            controller.state.selectedId = hit.id;
            controller.state.draggingId = hit.id;
            const hitScreen = worldToScreen(hit.x, hit.y, plot);
            controller.state.dragOffset = { x: hitScreen.sx - sx, y: hitScreen.sy - sy };
            try { plot.canvas.setPointerCapture(e.pointerId); } catch (_) {}
            plot.render();
        } else if (controller.options.interaction === "true") {
            const world = screenToWorld(sx, sy, plot);
            const newPoint = addPoint(plot, {
                x: world.x,
                y: world.y,
                size: controller.options.defaultSize,
                color: controller.options.defaultColor
            });
            controller.state.selectedId = newPoint.id;
            controller.state.draggingId = newPoint.id;
            controller.state.dragOffset = { x: 0, y: 0 };
            try { plot.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        } else if (controller.options.interaction === "move" && controller.state.selectedId !== null) {
            controller.state.selectedId = null;
            plot.render();
        }
    });

    plot.canvas.addEventListener("pointermove", (e) => {
        if (!controller.state.mode || controller.options.interaction === "false") return;

        const rect = plot.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (controller.state.draggingId !== null) {
            const world = screenToWorld(sx + controller.state.dragOffset.x, sy + controller.state.dragOffset.y, plot);
            const pt = plot.data.points.find(p => p && p.id === controller.state.draggingId);
            if (pt) {
                pt.x = world.x;
                pt.y = world.y;
            }
        } else {
            const hit = hitTestPoint(plot, sx, sy, controller.options.defaultSize);
            const newHover = hit ? hit.id : null;
            if (newHover !== controller.state.hoverId) {
                controller.state.hoverId = newHover;
                const isMoveOnly = (controller.options.interaction === "move");
                plot.canvas.style.cursor = hit ? "pointer" : (isMoveOnly ? "default" : "crosshair");
            }
        }
    });

    const stopDragging = (e) => {
        if (!controller.state.mode) return;
        if (controller.state.draggingId !== null) {
            try { plot.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
            controller.state.draggingId = null;
            plot.render();
        }
    };

    plot.canvas.addEventListener("pointerup", stopDragging);
    plot.canvas.addEventListener("pointercancel", stopDragging);
    plot.canvas.addEventListener("pointerleave", () => {
        if (controller.state.mode && controller.state.draggingId === null) {
            controller.state.hoverId = null;
        }
    });

    plot.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && controller.state.selectedId !== null) {
            e.preventDefault();
            controller.state.selectedId = null;
            plot.render();
        } else if ((e.key === "Delete" || e.key === "Backspace") && controller.options.interaction === "true" && controller.state.mode) {
            e.preventDefault();
            deleteSelectedPoint(controller, plot);
        }
    });

    document.addEventListener("pointerdown", (e) => {
        if (!plot.contains(e.target) && controller.state.selectedId !== null) {
            controller.state.selectedId = null;
            plot.render();
        }
    });
}
