Promise.all([
  d3.json(
    "https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@0.0.6/world/110m.json"
  ),
  d3.tsv(
    "https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@0.0.6/world/110m.tsv"
  ),
]).then(([geoData, data]) => {
  const accessor = {
    id: (d) => d.id,
    name: (d) => d.name,
  };

  const metric = {
    key: "population",
    name: "Population",
    value: (d) => +d.pop_est,
    format: d3.format(","),
  };

  const bubbleMapEl = document.getElementById("map");
  const legendEl = document.getElementById("legend");

  bubbleMapEl.addEventListener("rchange", (event) => {
    sizeLegend.update(event.detail);
  });

  const sizeLegend = new SizeLegend({
    el: legendEl,
  });

  const bubbleMap = new BubbleMap({
    el: bubbleMapEl,
    geoData,
    data,
    accessor,
  });

  bubbleMap.updateMetric(metric);
});
