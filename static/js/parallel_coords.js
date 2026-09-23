// P3 · Coordenadas paralelas: todos los atributos con sus valores reales, eje `year` primero.
// Escalado lineal o por cuantil, ejes reordenables (arrastre) e invertibles (doble clic), brushing multi-eje.
function createParallelCoords(container, records, features) {
  const width = 1040, height = 440;
  const m = { top: 46, right: 50, bottom: 16, left: 50 };
  const LABELS = { loudness: "loudness (dB)", tempo: "tempo (BPM)" };
  const dims = ["year", ...features];
  const root = d3.select(container);

  let order = dims.slice();
  let mode = "linear";
  const inverted = new Set();
  const brushes = new Map(); // dim -> [y0, y1] en píxeles
  const dragging = {};
  const sorted = Object.fromEntries(dims.map(k => [k, records.map(d => d[k]).sort(d3.ascending)]));
  const scales = {};

  const controls = root.append("div").attr("class", "controls");
  const modes = [
    ["linear", "Lineal (min–máx)"],
    ["quantile", "Cuantil (rango)"],
  ];
  const modeLabels = controls.selectAll("label").data(modes).join("label").attr("class", "chip");
  modeLabels.append("input").attr("type", "radio").attr("name", "pc-mode")
    .property("checked", ([k]) => k === mode)
    .on("change", (event, [k]) => { mode = k; clearBrushes(); buildScales(); render(); });
  modeLabels.append("span").text(([, label]) => label);

  const svg = root.append("div").attr("class", "scroll-x")
    .append("svg").attr("class", "chart pc").attr("viewBox", [0, 0, width, height]);
  const gLines = svg.append("g");
  const gAxes = svg.append("g");

  const x = d3.scalePoint(order, [m.left, width - m.right]);
  const xPos = k => dragging[k] ?? x(k);

  const format = k =>
    k === "year" ? d3.format("d") : k === "loudness" || k === "tempo" ? d3.format(".0f") : d3.format(".2~g");

  function buildScales() {
    for (const k of dims) {
      const range = inverted.has(k) ? [m.top, height - m.bottom] : [height - m.bottom, m.top];
      const vals = sorted[k];
      if (mode === "linear") {
        const s = d3.scaleLinear(d3.extent(vals), range);
        scales[k] = { y: s, axis: d3.axisLeft(s).ticks(5).tickFormat(format(k)) };
      } else {
        // Posición = rango percentil (ECDF con empates al punto medio); ticks en cuartiles con su valor real
        const t = d3.scaleLinear([0, 1], range);
        const n = vals.length;
        const y = v => t((d3.bisectLeft(vals, v) + d3.bisectRight(vals, v)) / 2 / n);
        const axis = d3.axisLeft(t).tickValues([0, 0.25, 0.5, 0.75, 1])
          .tickFormat(p => format(k)(d3.quantileSorted(vals, p)));
        scales[k] = { y, axis };
      }
    }
  }

  const paths = gLines.selectAll("path").data(records, d => d.id).join("path").call(bindHover);
  const pathD = d => "M" + order.map(k => `${xPos(k)},${scales[k].y(d[k])}`).join("L");

  const brushFor = Object.fromEntries(dims.map(k => [k,
    d3.brushY()
      .extent([[-11, m.top], [11, height - m.bottom]])
      .on("start brush end", event => {
        if (event.selection) brushes.set(k, event.selection);
        else brushes.delete(k);
        scheduleSelection();
      }),
  ]));

  const axisDrag = d3.drag()
    .container(svg.node())
    .subject((event, k) => ({ x: xPos(k) }))
    .on("drag", (event, k) => {
      dragging[k] = Math.max(m.left, Math.min(width - m.right, event.x));
      order.sort((a, b) => xPos(a) - xPos(b));
      x.domain(order);
      positionAxes();
      paths.attr("d", pathD);
    })
    .on("end", (event, k) => {
      delete dragging[k];
      positionAxes(true);
      paths.transition().duration(200).attr("d", pathD);
    });

  function positionAxes(animate = false) {
    const g = gAxes.selectAll("g.dim");
    (animate ? g.transition().duration(200) : g).attr("transform", k => `translate(${xPos(k)},0)`);
  }

  function render() {
    const g = gAxes.selectAll("g.dim").data(order, k => k).join(enter => {
      const a = enter.append("g").attr("class", "dim");
      a.append("g").attr("class", "axis");
      const title = a.append("text").attr("class", "dim-title").attr("y", m.top - 18).attr("text-anchor", "middle")
        .call(axisDrag)
        .on("dblclick", (event, k) => {
          inverted.has(k) ? inverted.delete(k) : inverted.add(k);
          d3.select(event.currentTarget.parentNode).select("g.brush").call(brushFor[k].move, null);
          buildScales();
          render();
        });
      title.append("tspan");
      title.append("title").text("Arrastra para reordenar · doble clic para invertir");
      a.append("text").attr("class", "dim-sub").attr("y", m.top - 6).attr("text-anchor", "middle");
      a.append("g").attr("class", "brush").each(function (k) { d3.select(this).call(brushFor[k]); });
      return a;
    });
    positionAxes();
    g.select("g.axis").each(function (k) { d3.select(this).call(scales[k].axis); });
    g.select("text.dim-title").select("tspan").text(k => LABELS[k] ?? k);
    g.select("text.dim-sub").text(k => (inverted.has(k) ? "invertido" : ""));
    paths.attr("d", pathD);
  }

  // El brushing emite muchos eventos: se agrupan en un frame para no repintar las 3 vistas en cada uno
  let pending = false;
  function scheduleSelection() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (brushes.size === 0) return VizState.setSelected(null);
      const ids = new Set();
      for (const d of records) {
        let inside = true;
        for (const [k, [y0, y1]] of brushes) {
          const py = scales[k].y(d[k]);
          if (py < y0 || py > y1) { inside = false; break; }
        }
        if (inside) ids.add(d.id);
      }
      VizState.setSelected(ids);
    });
  }

  function clearBrushes() {
    gAxes.selectAll("g.brush").each(function (k) { d3.select(this).call(brushFor[k].move, null); });
  }

  VizState.events
    .on("focus.pc", () => paintMarks(paths, "line", true))
    .on("selection.pc", () => paintMarks(paths, "line", false))
    .on("hover.pc", () => highlightHovered(paths));

  buildScales();
  render();
  paintMarks(paths, "line", true);

  return { clearBrushes };
}
