class SizeLegend {
  constructor({ el }) {
    this.el = el;
    this.init();
  }

  init() {
    this.container = d3
      .select(this.el)
      .append("div")
      .attr("class", "size-legend");

    this.titleContainer = this.container
      .append("div")
      .attr("class", "legend-title");
    this.svg = this.container.append("div").append("svg");
  }

  render() {
    this.renderTitle();
    this.renderLegendItems();
    this.autoViewBox();
  }

  renderTitle() {
    this.titleContainer.text(this.title);
  }

  renderLegendItems() {
    const ticks = this.scale
      .ticks(5)
      .slice(1)
      .map((d) => ({
        value: d,
        circleR: this.scale(d),
        circleY: -this.scale(d),
        labelY: -this.scale(d) * 2,
      }));

    d3.pairs(ticks, (a, b) => {
      if (a.labelY - b.labelY < 12) b.labelY = a.labelY - 12;
    });

    const maxR = ticks[ticks.length - 1].circleR;

    this.svg
      .selectAll(".item")
      .data(ticks)
      .join((enter) =>
        enter
          .append("g")
          .attr("class", "item")
          .call((g) => g.append("polyline").attr("stroke", "currentColor"))
          .call((g) =>
            g
              .append("circle")
              .attr("fill", "none")
              .attr("stroke", "currentColor")
          )
          .call((g) => g.append("text"))
      )
      .call((g) =>
        g
          .select("circle")
          .attr("cy", (d) => d.circleY)
          .attr("r", (d) => d.circleR)
      )
      .call((g) =>
        g
          .select("text")
          .attr("x", maxR + 36)
          .attr("y", (d) => d.labelY)
          .attr("dy", "0.32em")
          .text((d) => this.format(d.value))
          .each(function () {})
      )
      .call((g) =>
        g
          .select("polyline")
          .attr(
            "points",
            (d) =>
              `0,${d.circleY * 2} ${maxR + 16},${d.labelY} ${maxR + 32},${
                d.labelY
              }`
          )
      );
  }

  autoViewBox() {
    let { x, y, width, height } = this.svg.node().getBBox();
    x = Math.floor(x) - 1;
    y = Math.floor(y) - 1;
    width = Math.ceil(width) + 2;
    height = Math.ceil(height) + 2;
    this.svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [x, y, width, height]);
  }

  update({ title, scale, format }) {
    this.title = title;
    this.scale = scale;
    this.format = format;
    this.render();
  }
}
