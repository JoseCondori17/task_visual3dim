// Estado compartido entre las tres vistas enlazadas + utilidades comunes.
const VizState = (() => {
  const events = d3.dispatch("focus", "selection", "hover");
  // focus: 3 slots fijos (A, B, C); el color pertenece al slot, no al ranking. null = vacío.
  const state = { focus: [null, null, null], selected: null, hovered: null };

  const slot = d => state.focus.indexOf(d.genre);

  return {
    events,
    get focus() { return state.focus; },
    get selected() { return state.selected; },
    get hovered() { return state.hovered; },
    setFocus(focus) { state.focus = focus; events.call("focus"); },
    setSelected(ids) { state.selected = ids; events.call("selection"); },
    setHovered(d) {
      if (state.hovered === d) return;
      state.hovered = d;
      events.call("hover");
    },
    slot,
    isDimmed: d => state.selected !== null && !state.selected.has(d.id),
    colorClass: d => (slot(d) < 0 ? "ctx" : `s${slot(d)}`),
    // Géneros en foco se dibujan encima del contexto gris
    drawRank: d => (slot(d) < 0 ? 0 : 1),
  };
})();

const Tooltip = (() => {
  const el = d3.select("body").append("div").attr("class", "tooltip").property("hidden", true);
  const fmt = d3.format(".2f");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const shown = ["energy", "valence", "danceability", "acousticness"];

  return {
    show(event, d) {
      el.property("hidden", false).html(
        `<strong>${esc(d.name)}</strong>` +
        `<span class="tt-sub">${esc(d.artist)} · ${d.year} · ${esc(d.genre)}</span>` +
        `<table>${shown.map(f => `<tr><td>${f}</td><td>${fmt(d[f])}</td></tr>`).join("")}</table>`
      );
      this.move(event);
    },
    move(event) {
      const node = el.node();
      const x = event.clientX + 14 + node.offsetWidth > window.innerWidth
        ? event.clientX - 14 - node.offsetWidth : event.clientX + 14;
      el.style("left", `${x}px`).style("top", `${event.clientY + 14}px`);
    },
    hide() { el.property("hidden", true); },
  };
})();

function bindHover(selection) {
  selection
    .on("mouseenter", (event, d) => { VizState.setHovered(d); Tooltip.show(event, d); })
    .on("mousemove", event => Tooltip.move(event))
    .on("mouseleave", () => { VizState.setHovered(null); Tooltip.hide(); });
}

// Aplica color/atenuado a las marcas de una vista; reordena solo si cambió el foco.
function paintMarks(marks, baseClass, reorder) {
  marks
    .attr("class", d => `${baseClass} ${VizState.colorClass(d)}`)
    .classed("dim", VizState.isDimmed);
  if (reorder) marks.sort((a, b) => VizState.drawRank(a) - VizState.drawRank(b));
}

function highlightHovered(marks) {
  marks.filter(".hover").classed("hover", false);
  const h = VizState.hovered;
  if (h) marks.filter(d => d === h).classed("hover", true).raise();
}

// Centroide 2D de cada género en foco (solo tracks no atenuados por el brushing).
function focusCentroids(records, pos) {
  return VizState.focus.flatMap((genre, slot) => {
    if (!genre) return [];
    const pts = records.filter(d => d.genre === genre && !VizState.isDimmed(d)).map(pos);
    if (!pts.length) return [];
    return [{ genre, slot, pts, x: d3.mean(pts, p => p[0]), y: d3.mean(pts, p => p[1]) }];
  });
}

// Distancia media entre centroides / dispersión media dentro de cada género.
// Invariante a la escala, así que es comparable entre configuraciones de anclas o pesos.
function separationIndex(centroids) {
  const groups = centroids.filter(c => c.pts.length > 1);
  if (groups.length < 2) return null;
  const spread = d3.mean(groups, c =>
    Math.sqrt(d3.mean(c.pts, p => (p[0] - c.x) ** 2 + (p[1] - c.y) ** 2)));
  const dists = d3.pairs(groups, (a, b) => Math.hypot(a.x - b.x, a.y - b.y));
  return spread > 0 ? d3.mean(dists) / spread : null;
}

function drawCentroids(g, centroids) {
  g.selectAll("g.centroid")
    .data(centroids, c => c.genre)
    .join(enter => {
      const c = enter.append("g");
      c.append("circle").attr("r", 7);
      c.append("text").attr("dy", -13).attr("text-anchor", "middle");
      return c;
    })
    .attr("class", c => `centroid s${c.slot}`)
    .attr("transform", c => `translate(${c.x},${c.y})`)
    .select("text").text(c => c.genre);
}

function separationText(centroids) {
  const idx = separationIndex(centroids);
  return idx === null
    ? "Elige al menos 2 géneros en foco para medir su separación."
    : `Índice de separación: ${d3.format(".2f")(idx)} (distancia entre centroides ÷ dispersión interna; mayor = más separados)`;
}

const byAngleFromTop = a => (((a.angle + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

function evenlySpaced(list, extra = {}) {
  return list.map((feature, i) => ({ feature, angle: -Math.PI / 2 + (2 * Math.PI * i) / list.length, ...extra }));
}
