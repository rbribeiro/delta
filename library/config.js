const deltaConfig = {
  state: {},
  type: "presentation",
  environmentEnumeration: "default",
  environments: [
    "theorem",
    "proof",
    "proposition",
    "lemma",
    "example",
    "remark",
    "corollary",
    "definition",
  ],
  plugins: [
    {
      id: "annotation",
      src: "./library/plugins/annotation/annotation.js",
    },
    {
      id: "Auto Generation Section Slides",
      src: "./library/plugins/autogenerateSectionSlides/autogenerateSectionSlides.js",
    },
    {
      id: "ChartJS",
      src: "https://cdn.jsdelivr.net/npm/chart.js",
    },
    {
      id: "functionPlot",
      src: "./library/plugins/functionPlot/functionPlot.js",
    },
  ],
};
