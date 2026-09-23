// P1 · RadViz con anclaje dimensional: cada track se ubica según qué atributos dominan su perfil.
// Las anclas se arrastran por el círculo y se activan/desactivan, porque el resultado depende de su orden.
function createRadviz(container, records, features, initialAnchors) {
  const size = 500, R = 190;
  const root = d3.select(container);
  let anchors = evenlySpaced(initialAnchors);

  const controls = root.append("div").attr("class", "controls");
  const toggles = controls.selectAll("label").data(features).join("label").attr("class", "chip");
  toggles.append("input").attr("type", "checkbox").on("change", function (event, f) {
    const current = anchors.slice().sort((a, b) => byAngleFromTop(a) - byAngleFromTop(b)).map(a => a.feature);
    const next = this.checked ? [...current, f] : current.filter(x => x !== f);
    if (next.length < 2) { this.checked = true; return; }
    anchors = evenlySpaced(next);
    layout();
  });
  toggles.append("span").text(f => f);
  controls.append("button").text("Reespaciar anclas").on("click", () => {
    anchors = evenlySpaced(anchors.slice().sort((a, b) => byAngleFromTop(a) - byAngleFromTop(b)).map(a => a.feature));
    layout();
  });

  const svg = root.append("svg").attr("class", "chart").attr("viewBox", [-size / 2, -size / 2, size, size]);
  svg.append("circle").attr("class", "ring").attr("r", R);
  const gSpokes = svg.append("g");
  const gPoints = svg.append("g");
  const gCentroids = svg.append("g");
  const gAnchors = svg.append("g");
  const readout = root.append("p").attr("class", "readout");

  const points = gPoints.selectAll("circle").data(records, d => d.id).join("circle").attr("r", 3).call(bindHover);
  const pos = d => d.radviz;

  // Promedio de las posiciones de las anclas ponderado por el valor normalizado de cada atributo
  function project(d) {
    let x = 0, y = 0, sum = 0;
    for (const a of anchors) {
      const v = d.norm[a.feature];
      x += v * Math.cos(a.angle);
      y += v * Math.sin(a.angle);
      sum += v;
    }
    return sum > 0 ? [(R * x) / sum, (R * y) / sum] : [0, 0];
  }

  const drag = d3.drag()
    .subject(event => ({ x: event.x, y: event.y }))
    .on("drag", (event, a) => { a.angle = Math.atan2(event.y, event.x); layout(); });

  function drawAnchors() {
    const ax = a => R * Math.cos(a.angle), ay = a => R * Math.sin(a.angle);
    gSpokes.selectAll("line").data(anchors, a => a.feature).join("line")
      .attr("class", "spoke").attr("x2", ax).attr("y2", ay);

    const g = gAnchors.selectAll("g.anchor").data(anchors, a => a.feature).join(enter => {
      const a = enter.append("g").attr("class", "anchor").call(drag);
      a.append("circle").attr("r", 7);
      a.append("text").attr("dominant-baseline", "middle");
      return a;
    });
    g.select("circle").attr("cx", ax).attr("cy", ay);
    g.select("text")
      .attr("x", a => (R + 14) * Math.cos(a.angle))
      .attr("y", a => (R + 14) * Math.sin(a.angle))
      .attr("text-anchor", a => (Math.cos(a.angle) > 0.3 ? "start" : Math.cos(a.angle) < -0.3 ? "end" : "middle"))
      .text(a => a.feature);
  }

  function updateCentroids() {
    const cs = focusCentroids(records, pos);
    drawCentroids(gCentroids, cs);
    readout.text(separationText(cs));
  }

  function layout() {
    for (const d of records) d.radviz = project(d);
    points.attr("cx", d => d.radviz[0]).attr("cy", d => d.radviz[1]);
    toggles.select("input").property("checked", f => anchors.some(a => a.feature === f));
    drawAnchors();
    updateCentroids();
  }

  VizState.events
    .on("focus.radviz", () => { paintMarks(points, "mark", true); updateCentroids(); })
    .on("selection.radviz", () => { paintMarks(points, "mark", false); updateCentroids(); })
    .on("hover.radviz", () => highlightHovered(points));

  layout();
  paintMarks(points, "mark", true);
}
