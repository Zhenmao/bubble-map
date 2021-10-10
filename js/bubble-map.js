class BubbleMap {
  constructor({ el, geoData, data, accessor }) {
    this.el = el;
    this.geoData = geoData;
    this.data = data;
    this.accessor = accessor;
    this.resize = this.resize.bind(this);
    this.zoomed = this.zoomed.bind(this);
    this.entered = this.entered.bind(this);
    this.moved = this.moved.bind(this);
    this.left = this.left.bind(this);
    this.init();
  }

  init() {
    this.margin = {
      top: 32,
      right: 16,
      bottom: 32,
      left: 16,
    };

    this.projection = d3.geoNaturalEarth1().rotate([-10, 0]);
    this.path = d3.geoPath(this.projection);

    this.r = d3.scaleSqrt();

    this.zoom = d3.zoom().on("zoom", this.zoomed).scaleExtent([1, 32]);

    this.container = d3.select(this.el).classed("bubble-map", true);
    this.svg = this.container.append("svg");
    this.g = this.svg.append("g");
    this.country = this.g.append("g").selectAll("path");
    this.bubble = this.g.append("g").selectAll("circle");

    this.tooltip = new Tooltip({
      el: this.el,
    });

    this.wrangleGeo();
    window.addEventListener("resize", this.resize);
    this.resize();
  }

  wrangleGeo() {
    // Remove Antarctica
    this.geoData.objects.countries.geometries =
      this.geoData.objects.countries.geometries.filter((d) => d.id !== "010");

    this.featureCollection = topojson.feature(
      this.geoData,
      this.geoData.objects.countries
    );

    // Get the center of the largest polygon within a country's multi-polygons
    this.featureCollection.features.forEach((feature) => {
      if (feature.id === "643") {
        // Russia
        feature.properties.center = turf.centroid(feature.geometry);
      } else if (feature.geometry.type === "MultiPolygon") {
        let maxAreaPolygon,
          maxArea = 0;
        for (const poly in feature.geometry.coordinates) {
          const polygon = turf.polygon(feature.geometry.coordinates[poly]);
          const area = turf.area(polygon);
          if (area > maxArea) {
            maxArea = area;
            maxAreaPolygon = polygon;
          }
        }
        feature.properties.center = turf.centerOfMass(maxAreaPolygon);
      } else {
        feature.properties.center = turf.centerOfMass(feature.geometry);
      }
    });

    this.featureById = d3.index(this.featureCollection.features, (d) => d.id);
  }

  wrangle() {
    this.r.domain([0, d3.max(this.data, this.metric.value)]);

    this.el.dispatchEvent(
      new CustomEvent("rchange", {
        detail: {
          title: this.metric.name,
          scale: this.r,
          format: this.metric.format,
        },
      })
    );

    this.dataById = d3.index(
      this.data.filter((d) => d.id !== "010"),
      this.accessor.id
    );

    this.render();
  }

  resize() {
    this.width = this.el.clientWidth;
    this.boundedWidth = this.width - this.margin.left - this.margin.right;

    const [[x0, y0], [x1, y1]] = d3
      .geoPath(
        this.projection.fitWidth(this.boundedWidth, this.featureCollection)
      )
      .bounds(this.featureCollection);
    this.boundedHeight = Math.ceil(y1 - y0);
    this.height = this.boundedHeight + this.margin.top + this.margin.bottom;

    this.projection.fitExtent(
      [
        [this.margin.left, this.margin.top],
        [this.width - this.margin.right, this.height - this.margin.bottom],
      ],
      this.featureCollection
    );

    this.r.range([0, Math.round(this.boundedWidth / 16)]);

    this.zoom.translateExtent([
      [0, 0],
      [this.width, this.height],
    ]);

    this.svg.call(this.zoom);

    this.svg.attr("viewBox", [0, 0, this.width, this.height]);

    if (this.dataById) {
      this.svg.call(this.zoom.transform, d3.zoomIdentity);
      this.render();
      this.el.dispatchEvent(
        new CustomEvent("rchange", {
          detail: {
            title: this.metric.name,
            scale: this.r,
            format: this.metric.format,
          },
        })
      );
    }
  }

  render() {
    const t = this.svg.transition();
    this.renderMap();
    this.renderBubbles(t);
  }

  renderMap() {
    this.country = this.country
      .data(this.featureCollection.features, (d) => d.id)
      .join((enter) =>
        enter
          .append("path")
          .attr("class", "country")
          .call((enter) =>
            enter
              .filter((d) => this.dataById.has(this.accessor.id(d)))
              .on("mouseenter", (event, d) => {
                this.entered(this.accessor.id(d));
              })
              .on("mousemove", this.moved)
              .on("mouseleave", this.left)
          )
      )
      .attr("d", this.path);
  }

  renderBubbles(t) {
    const { k } = d3.zoomTransform(this.svg.node());

    this.bubble = this.bubble
      .data(this.dataById, ([id]) => id)
      .join((enter) =>
        enter
          .append("circle")
          .attr("class", "bubble")
          .attr("r", 0)
          .on("mouseenter", (event, [id]) => {
            this.entered(id);
          })
          .on("mousemove", this.moved)
          .on("mouseleave", this.left)
      )
      .attr("transform", ([id, d]) => {
        const feature = this.featureById.get(id);
        return `translate(${this.path.centroid(feature.properties.center)})`;
      });

    if (t) {
      this.bubble
        .transition(t)
        .attr("r", ([, d]) => this.r(this.metric.value(d)) / k);
    } else {
      this.bubble.attr("r", ([, d]) => this.r(this.metric.value(d)) / k);
    }
  }

  zoomed({ transform }) {
    this.g.attr("transform", transform);
    this.renderBubbles();
  }

  entered(idActive) {
    this.country.classed("is-active", function ({ id }) {
      if (id === idActive) {
        d3.select(this).raise();
        return true;
      }
      return false;
    });
    this.bubble.classed("is-active", ([id]) => id === idActive);

    const d = this.dataById.get(idActive);

    this.tooltip.show(`
      <div>${this.accessor.name(d)}</div>
      <div>${this.metric.format(this.metric.value(d))}</div>
    `);
  }

  moved(event) {
    this.tooltip.move(event);
  }

  left() {
    this.country.classed("is-active", false);
    this.bubble.classed("is-active", false);

    this.tooltip.hide();
  }

  updateMetric(metric) {
    this.metric = metric;
    this.wrangle();
  }
}
