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

edgeStep.justAGraph = function () {
	const graph = cytoscape({
		container: document.getElementById("graphExample"), // container to render in

		elements: [
			// list of graph elements to start with
			{ data: { id: "a" } },
			{ data: { id: "b" } },
			{ data: { id: "c" } },
			{ data: { id: "d" } },
			{ data: { id: "e" } },
			{ data: { id: "f" } },
			{ data: { id: "g" } },
			{ data: { id: "h" } },
			{ data: { id: "i" } },
			{ data: { id: "j" } },

			{ data: { id: "ab", source: "a", target: "b" } },
			{ data: { id: "ac", source: "a", target: "c" } },
			{ data: { id: "bd", source: "b", target: "d" } },
			{ data: { id: "ce", source: "c", target: "e" } },
			{ data: { id: "df", source: "d", target: "f" } },
			{ data: { id: "eg", source: "e", target: "g" } },
			{ data: { id: "fh", source: "f", target: "h" } },
			{ data: { id: "gi", source: "g", target: "i" } },
			{ data: { id: "hj", source: "h", target: "j" } },
			{ data: { id: "ia", source: "i", target: "a" } },
			{ data: { id: "jb", source: "j", target: "b" } },
			{ data: { id: "fc", source: "f", target: "c" } },
		],

		style: [
			// the stylesheet for the graph
			{
				selector: "node",
				style: {
					"background-color": "#ed6a5a",
					label: "data(id)",
				},
			},

			{
				selector: "edge",
				style: {
					width: 2,
					"line-color": "green",
					"target-arrow-color": "green",
					"target-arrow-shape": "none", // No arrows
				},
			},
		],

		layout: {
			name: "grid",
			rows: 3,
		},
	});
};

edgeStep.ERModel = function (n, p) {
	console.log("test");

	let elements = [];

	// Create n nodes
	for (let i = 0; i < n; i++) {
		elements.push({ data: { id: "node" + i } });
	}

	// Randomly add edges with probability p
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			if (Math.random() < p) {
				elements.push({
					data: {
						id: "edge" + i + "-" + j,
						source: "node" + i,
						target: "node" + j,
					},
				});
			}
		}
	}

	const graph = cytoscape({
		container: document.getElementById("ERModel"),

		elements: elements, // Example with 10 nodes and p = 0.2

		style: [
			{
				selector: "node",
				style: {
					"background-color": "#ed6a5a",
					width: 20,
					height: 20,
				},
			},
			{
				selector: "edge",
				style: {
					width: 2,
					"line-color": "green",
					"target-arrow-color": "green",
					"target-arrow-shape": "none",
				},
			},
		],

		layout: {
			name: "cose",
			padding: 10,
		},
	});
};

edgeStep.UAModel = function (n) {
	let cy = cytoscape({
		container: document.getElementById("UAModel"),
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
					width: 4,
					"line-color": "green",
					"target-arrow-color": "green",
					"target-arrow-shape": "none",
				},
			},
		],
		layout: {
			name: "preset", // Using cose layout for better adjustment of new nodes
		},
	});

	let nodeIds = [];
	let initialPosX = 400;
	let initialPosY = 300;
	let radius = 150;

	// Add the first node at the center
	nodeIds.push("node0");
	cy.add({
		data: { id: "node0" },
		position: { x: initialPosX, y: initialPosY },
	});

	let i = 1;
	let interval = setInterval(() => {
		if (i >= n) {
			clearInterval(interval); // Stop when all nodes are added
			return;
		}

		let angle = (2 * Math.PI * i) / n; // Spread nodes in a circle
		let posX = initialPosX + radius * Math.cos(angle);
		let posY = initialPosY + radius * Math.sin(angle);

		let nodeId = "node" + i;
		nodeIds.push(nodeId);
		cy.add({ data: { id: nodeId }, position: { x: posX, y: posY } });

		// Choose 1 node uniformly at random to connect to
		let randIndex = Math.floor(Math.random() * i); // random node from existing ones
		let targetNode = nodeIds[randIndex];

		cy.add({
			data: {
				id: "edge" + i + "-" + randIndex,
				source: nodeId,
				target: targetNode,
			},
		});

		i++;
	}, 1000); // Add a node every 1000ms (1 second)
};

edgeStep.init = function () {
	edgeStep.kbGraph();
	edgeStep.ERModel(10, 0.4);
	edgeStep.UAModel(10);
};

Delta.getInstance().eventDispatcher.on("deltaIsReady", edgeStep.init());
