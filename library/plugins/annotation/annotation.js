const annotation = {}

annotation.init = function() {
    const slides = document.querySelectorAll("slide")
    slides.forEach(slide => {
        const canvas = document.createElement("canvas");
	    slide.appendChild(canvas);
    });

    Delta.updateState({drawing : false, annotateMode : false})
    annotation.canvasListeners()
}


window.addEventListener("resize", () => {
	const canvasList = document.querySelectorAll("canvas");
	canvasList.forEach((canvas) => {
		annotation.resizeCanvas(canvas);
	});
});

document.addEventListener("keydown", (e) => {
	if (e.key === "a") {
		const annotateMode = Delta.state.annotateMode ? false : true;
		Delta.updateState({ annotateMode });
	}
});


document.addEventListener("stateChange:annotateMode", () => {
	annotation.toggleAnnotateMode();
});

annotation.toggleAnnotateMode = function() {
	const canvasList = document.querySelectorAll("canvas");
	canvasList.forEach((canvas) => {
		canvas.style.pointerEvents = Delta.state.annotateMode ? "visible" : "none";
		canvas.style.cursor = Delta.state.annotateMode ? "crosshair" : "default";
	});
}
annotation.canvasListeners = function() {
	const canvasList = document.querySelectorAll("canvas");
	canvasList.forEach((canvas) => {
		annotation.canvasBuilder(canvas);
		canvas.addEventListener("mousedown", (e) => {
			const ctx = e.target.getContext("2d");
			if (Delta.state.annotateMode) {
				Delta.updateState({ drawing: true });
				ctx.beginPath();
			}
		});

		canvas.addEventListener("mousemove", (e) => {
			const ctx = e.target.getContext("2d");
			if (Delta.state.drawing && Delta.state.annotateMode) {
				ctx.lineTo(e.clientX, e.clientY);
				ctx.stroke();
			}
		});

		canvas.addEventListener("mouseup", () => {
			Delta.updateState({ drawing: false });
		});
	});
}

annotation.canvasBuilder = function(canvas) {
	const ctx = canvas.getContext("2d");
	const ratio = window.devicePixelRatio;
	canvas.width = window.innerWidth * ratio;
	canvas.height = window.innerHeight * ratio;
	ctx.scale(ratio, ratio);
	ctx.lineWidth = 5;
	ctx.strokeStyle = "#ed6a5a";
	ctx.shadowBlur = 2;
	ctx.shadowColor = "#ed6a5a";
}

annotation.resizeCanvas = function(canvas) {
	const ratio = window.devicePixelRatio;
	const ctx = canvas.getContext("2d");
	const { lineWidth, strokeStyle, shadowColor, shadowBlur } = ctx;
	const newWidth = window.innerWidth * ratio;
	const newHeight = window.innerHeight * ratio;

	// Save the current canvas content
	let tempCanvas = document.createElement("canvas");
	const tempContext = tempCanvas.getContext("2d");
	tempCanvas.width = canvas.width;
	tempCanvas.height = canvas.height;
	tempContext.drawImage(canvas, 0, 0);

	// Resize the canvas
	canvas.width = newWidth;
	canvas.height = newHeight;

	// Calculate the scaling factors
	const scaleX = newWidth / tempCanvas.width;
	const scaleY = newHeight / tempCanvas.height;

	// Redraw the saved content with scaling
	ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
	ctx.drawImage(tempCanvas, 0, 0);

	// Reset the transformation matrix to default
	ctx.setTransform(1, 0, 0, 1, 0, 0);

	ctx.lineWidth = lineWidth;
	ctx.strokeStyle = strokeStyle;
	ctx.shadowBlur = shadowBlur;
	ctx.shadowColor = shadowColor;

	// Explicitly set tempCanvas to null to help with garbage collection
	tempCanvas.width = tempCanvas.height = 0;
	tempCanvas = null;
}

annotation.init()