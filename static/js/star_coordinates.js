// P2 · Star Coordinates: proyección lineal ponderada. Cada eje es un vector (largo = peso, ángulo = dirección);
// arrastrar ejes o mover pesos cambia la combinación lineal y el índice de separación se recalcula en vivo.
function createStarCoordinates(container, records, features) {
  const size = 500, R = 190, L = 115; // L = largo en px de un eje con peso 1 (máx. 2·L cabe en el lienzo)
  const MAX_WEIGHT = 2;
  const root = d3.select(container);
  // Centrar en la media: un punto hacia un eje = "más que el promedio" en ese atributo
  const means = Object.fromEntries(features.map(f => [f, d3.mean(records, d => d.norm[f])]));
  let axes = evenlySpaced(features, { weight: 1 });
  let gain = 1;

  const controls = root.append("div").attr("class", "controls");
  controls.append("button").text("Restablecer ejes").on("click", () => {
    axes = evenlySpaced(features, { weight: 1 });
    layout(); fit();
  });

  const body = root.append("div").attr("class", "star-body");
  const svg = body.append("svg").attr("class", "chart").attr("viewBox", [-size / 2, -size / 2, size, size]);
  const gAxes = svg.append("g");
  const gPoints = svg.append("g");
  const gCentroids = svg.append("g");
  const gHandles = svg.append("g");

  const weights = body.append("div").attr("class", "weights");
  const rows = weights.selectAll("label").data(features).join("label");
  rows.append("span").attr("class", "w-name").text(f => f);
  rows.append("input").attr("type", "range").attr("min", 0).attr("max", MAX_WEIGHT).attr("step", 0.05)
    .on("input", function (event, f) {
      axes.find(a => a.feature === f).weight = +this.value;
      layout();
    })
    .on("change", () => fit());
  rows.append("output");
  const readout = root.append("p").attr("class", "readout");

  const points = gPoints.selectAll("circle").data(records, d => d.id).join("circle").attr("r", 3).call(bindHover);
  const pos = d => d.star;

  function rawProject(d) {
    let x = 0, y = 0;
    for (const a of axes) {
      const v = (d.norm[a.feature] - means[a.feature]) * a.weight;
      x += v * Math.cos(a.angle);
      y += v * Math.sin(a.angle);
    }
    return [x, y];
  }

  const drag = d3.drag()
    .subject(event => ({ x: event.x, y: event.y }))
    .on("drag", (event, a) => {
      a.angle = Math.atan2(event.y, event.x);
      a.weight = Math.min(MAX_WEIGHT, Math.hypot(event.x, event.y) / L);
      layout();
    })
    .on("end", () => fit());

  function drawAxes() {
    const ex = a => L * a.weight * Math.cos(a.angle), ey = a => L * a.weight * Math.sin(a.angle);
    gAxes.selectAll("line").data(axes, a => a.feature).join("line").attr("class", "star-axis")
      .attr("x2", ex).attr("y2", ey);

    const g = gHandles.selectAll("g.anchor").data(axes, a => a.feature).join(enter => {
      const h = enter.append("g").attr("class", "anchor").call(drag);
      h.append("circle").attr("r", 7);
      h.append("text").attr("dominant-baseline", "middle");
      return h;
    });
    g.select("circle").attr("cx", ex).attr("cy", ey);
    g.select("text")
      .attr("x", a => (L * a.weight + 14) * Math.cos(a.angle))
      .attr("y", a => (L * a.weight + 14) * Math.sin(a.angle))
      .attr("text-anchor", a => (Math.cos(a.angle) > 0.3 ? "start" : Math.cos(a.angle) < -0.3 ? "end" : "middle"))
      .text(a => a.feature);

    rows.select("input").property("value", f => axes.find(a => a.feature === f).weight);
    rows.select("output").text(f => axes.find(a => a.feature === f).weight.toFixed(2));
  }

  function updateCentroids() {
    const cs = focusCentroids(records, pos);
    drawCentroids(gCentroids, cs);
    readout.text(separationText(cs));
  }

  function place(sel) {
    sel.attr("cx", d => d.star[0]).attr("cy", d => d.star[1]);
  }

  function layout() {
    for (const d of records) {
      const [x, y] = rawProject(d);
      d.star = [x * gain, y * gain];
    }
    place(points);
    drawAxes();
    updateCentroids();
  }

  // Zoom automático al soltar: el percentil 99 de la nube ocupa el radio útil
  function fit() {
    const radii = records.map(d => Math.hypot(...rawProject(d))).sort(d3.ascending);
    const r99 = d3.quantileSorted(radii, 0.99);
    gain = r99 > 0 ? R / r99 : 1;
    for (const d of records) {
      const [x, y] = rawProject(d);
      d.star = [x * gain, y * gain];
    }
    place(points.transition().duration(300));
    updateCentroids();
  }

  VizState.events
    .on("focus.star", () => { paintMarks(points, "mark", true); updateCentroids(); })
    .on("selection.star", () => { paintMarks(points, "mark", false); updateCentroids(); })
    .on("hover.star", () => highlightHovered(points));

  fit();
  layout();
  paintMarks(points, "mark", true);
}
