edgeStep = {};

edgeStep.kbGraph = function () {
  const cy = cytoscape({
    container: document.getElementById("kbGraph"), // container to render in
    elements: [
      { data: { id: "1" } },
      { data: { id: "2" } },
      { data: { id: "3" } },
      { data: { id: "4" } },
      { data: { source: "1", target: "2" } },
      { data: { source: "1", target: "2" } },
      { data: { source: "1", target: "3" } },
      { data: { source: "2", target: "3" } },
      { data: { source: "3", target: "4" } },
      { data: { source: "4", target: "1" } },
      { data: { source: "1", target: "4" } },
    ],
    style: [
      {
        selector: "node",
        style: {
          "background-color": "#ed6a5a",
          width: 35,
          height: 35,
        },
      },
      {
        selector: "edge",
        style: {
          width: 6,
          "line-color": "green",
          "target-arrow-color": "#ed6a5a",
          "target-arrow-shape": "none",
          "curve-style": "bezier",
        },
      },
    ],
    layout: {
      name: "circle",
      padding: 10,
    },
  });
  console.log("oi");
};

Delta.getInstance().eventDispatcher.on("deltaIsReady", edgeStep.kbGraph());
