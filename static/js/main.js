// Carga los datos, arma la barra de géneros en foco y crea las tres vistas enlazadas.
d3.json("/api/tracks").then(({ features, genres, defaults, records }) => {
  d3.select("#loading").remove();
  buildFocusControls(genres, defaults.focus);

  createRadviz("#radviz", records, features, defaults.radviz_anchors);
  createStarCoordinates("#star-coordinates", records, features);
  const pc = createParallelCoords("#parallel-coords", records, features);

  const readout = d3.select("#selection-count");
  const clear = d3.select("#clear-selection").on("click", () => pc.clearBrushes());
  const fmt = d3.format(",");
  const updateSelection = () => {
    const sel = VizState.selected;
    readout.text(sel === null
      ? `${fmt(records.length)} tracks (${fmt(records.length / genres.length)} por género) · sin selección`
      : `${fmt(sel.size)} de ${fmt(records.length)} tracks seleccionados`);
    clear.property("disabled", sel === null);
  };
  VizState.events.on("selection.main", updateSelection);
  updateSelection();
}).catch(err => d3.select("#loading").text(`Error cargando datos: ${err.message}`));

// Tres slots de color fijos (A, B, C). Máximo 3 porque es el límite validado de colores
// distinguibles (incluido daltonismo) en gráficos de dispersión; el resto va gris como contexto.
function buildFocusControls(genres, initial) {
  const focus = [0, 1, 2].map(i => initial[i] ?? null);
  const slots = d3.select("#focus-slots").selectAll("label").data([0, 1, 2]).join("label").attr("class", "slot");
  slots.append("span").attr("class", i => `swatch s${i}`);
  const selects = slots.append("select").on("change", function (event, i) {
    const value = this.value || null;
    // Un género ocupa un solo slot: si ya estaba en otro, ese queda vacío
    const next = focus.map((g, j) => (j !== i && g === value ? null : g));
    next[i] = value;
    focus.splice(0, 3, ...next);
    selects.property("value", j => focus[j] ?? "");
    VizState.setFocus(focus.slice());
  });
  selects.selectAll("option").data(["", ...genres]).join("option")
    .attr("value", g => g).text(g => g || "(ninguno)");
  selects.property("value", i => focus[i] ?? "");
  VizState.setFocus(focus.slice());
}
