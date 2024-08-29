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
};

edgeStep.justAGraph = function() {
  const graph = cytoscape({
    container: document.getElementById('graphExample'), // container to render in

    elements: [ // list of graph elements to start with
      { data: { id: 'a' } },
      { data: { id: 'b' } },
      { data: { id: 'c' } },
      { data: { id: 'd' } },
      { data: { id: 'e' } },
      { data: { id: 'f' } },
      { data: { id: 'g' } },
      { data: { id: 'h' } },
      { data: { id: 'i' } },
      { data: { id: 'j' } },
      
      { data: { id: 'ab', source: 'a', target: 'b' } },
      { data: { id: 'ac', source: 'a', target: 'c' } },
      { data: { id: 'bd', source: 'b', target: 'd' } },
      { data: { id: 'ce', source: 'c', target: 'e' } },
      { data: { id: 'df', source: 'd', target: 'f' } },
      { data: { id: 'eg', source: 'e', target: 'g' } },
      { data: { id: 'fh', source: 'f', target: 'h' } },
      { data: { id: 'gi', source: 'g', target: 'i' } },
      { data: { id: 'hj', source: 'h', target: 'j' } },
      { data: { id: 'ia', source: 'i', target: 'a' } },
      { data: { id: 'jb', source: 'j', target: 'b' } },
      { data: { id: 'fc', source: 'f', target: 'c' } },
    ],

    style: [ // the stylesheet for the graph
      {
        selector: 'node',
        style: {
          'background-color': '#ed6a5a',
          'label': 'data(id)',
        }
      },

      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': 'green',
          'target-arrow-color': 'green',
          'target-arrow-shape': 'none', // No arrows
        }
      }
    ],

    layout: {
      name: 'grid',
      rows: 3
    }
  });
}

edgeStep.init = function() {
  edgeStep.kbGraph()
  edgeStep.justAGraph()
}

Delta.getInstance().eventDispatcher.on("deltaIsReady", edgeStep.init());
