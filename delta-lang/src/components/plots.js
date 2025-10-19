console.log("Plot content loaded!!!")

// ----- Funções axuliares -----

// Converte "13,357,310.3,694.4" -> [13,357,310.3,694.4] obrigando k partes (0 = any k)
function parse_tuple(tuple,k = 0){
	const parts = tuple.split(',');
	if (k > 0 && parts.length !== k) {
		return null
	}

	const nums = parts.map(el => parseFloat(el.trim()));
	if (nums.some(num => isNaN(num))) {
        return null;
    }
	return nums;
}

// Força x em [a,b]. Null = não restringe
function clip(x, a = null, b = null){
	return Math.max(Math.min(x,(b ?? Infinity)),(a ?? -Infinity));
}

// Converte pra outras notações
// Opções: notação científica (sci)
function format_number(x, precision = 2, maxdig = 4, type = "sci"){
	const num = parseFloat(x);
	const numStr = String(Math.abs(num));
	const digitCount = numStr.replace('.', '').length;
	if (digitCount > maxdig) {
		if(type === "sci"){
			return num.toExponential(precision);
		}
	} else {
		return String(num);
	}
}

// Dado x = [a,b], pega lista de pontos que ficaria agradável
// TODO: Implementar outras escalas (log e sei lá mais oq tiver, levantar isso na reunião)
function tick_locator(x, targetTicks = 5, plotScale = 'Linear', borderControl = 0.75){
    let [min, max] = x;
    if(min > max){
        [min, max] = [max, min];
    }

	// Evita marcações coladas nas bordas
	let unplug = (max-min)*(0.004)/borderControl
	min += unplug
	max -= unplug

    const span = max - min;
    const step = span / (targetTicks+1);
    const scale = Math.pow(10, Math.floor(Math.log10(step)));
    const alpha = step / scale;

    let niceAlpha;
    if (alpha > 8) {
        niceAlpha = 10;
    } else if (alpha > 4) {
        niceAlpha = 5;
    } else if (alpha > 2.5) {
        niceAlpha = 2.5;
    } else if (alpha > 1.5){
		niceAlpha = 2
	} else {
        niceAlpha = 1;
    }

    const perfectStep = niceAlpha * scale; 	console.log(min,",",max," dif = ",(max-min)," ~> ",step," => ",perfectStep);
    const firstTick = Math.ceil(min / perfectStep) * perfectStep;
    const ticks = [];
    let currentTick = firstTick;
    while (currentTick <= max) {
        ticks.push(parseFloat(currentTick.toFixed(12)));
        currentTick += perfectStep;
    }
    return ticks;
}

// ----- Delta Plot -----

class DeltaPlot extends HTMLElement {
	constructor(){
		super()
	}

	connectedCallback(){
		const title = this.getAttribute("data-title") || null;
    	const xStr = this.getAttribute("x") || "0,1"
		const yStr = this.getAttribute("y") || "0,1"
		const xLabel = this.getAttribute("x_label") || "X"
		const yLabel = this.getAttribute("y_label") || "Y"
		const size = this.getAttribute("size") || "0.75,0.4"
		const grid = this.getAttribute("grid") || "true"
		const axis = this.getAttribute("axis") || "true"

		this.removeAttribute('data-title')
		this.removeAttribute('x')
		this.removeAttribute('y')
		this.removeAttribute('x_label')
		this.removeAttribute('y_label')
		this.removeAttribute('size')
		this.removeAttribute('grid')
		this.removeAttribute('show_axis')

		let plotContent = document.createElement('delta-plot-content')
		let plotData = this.innerHTML

		// Título
		if(title){
			let titleElement = document.createElement('p')
			titleElement.innerText = `Plot: ${title}`
			this.before(titleElement)
		}

		// Tamanho
		let plotSize = parse_tuple(size,2) || [0.75, 0.4]
		plotSize = [clip(plotSize[0],0.25,1),clip(plotSize[1],0.25,1)]
		if(plotSize){
			this.style.margin = `0 ${(1-plotSize[0])*50}%`
			this.style.paddingBottom = `${(plotSize[1])*100}%`
		}

		// Criação do SVG - Base do Plot
		const svgNS = 'http://www.w3.org/2000/svg'
		const svg = document.createElementNS(svgNS, 'svg');
		let svgWidth = parseInt(400 * (plotSize[0]/plotSize[1]))
		svg.setAttribute('preserveAspectRatio', 'none');
		svg.setAttribute('viewBox', `0 0 ${svgWidth} 400`);
		svg.classList.add('delta-plot-svg');

		const rect = document.createElementNS(svgNS, 'rect');
		rect.setAttribute('x', '59');
		rect.setAttribute('y', '21');
		rect.setAttribute('height', '320');
		rect.setAttribute('width', `${svgWidth-80}`);
		rect.setAttribute('fill', 'none');
		rect.setAttribute('stroke', 'black');
		rect.setAttribute('stroke-width', '1');
		svg.appendChild(rect)

		// Eixos
		let x = parse_tuple(xStr, 2) || [0,1]
		let y = parse_tuple(yStr, 2) || [0,1]
		if(x[0] == x[1]) x[1]++;
		if(y[0] == y[1]) y[1]++;
		let xTicks = tick_locator(x,parseInt(3.5 * plotSize[0]/plotSize[1]),'Linear',plotSize[0])
		let yTicks = tick_locator(y,3.5,'Linear',plotSize[1])
		let xCoords = xTicks.map(t => 60 + ((t-x[0])/(x[1]-x[0]))*(svgWidth-80));
		let yCoords = yTicks.map(t => 20 + (1 - (t-y[0])/(y[1]-y[0]))*320);
		let showGrid = (grid.toLowerCase() === "true")
		let showAxis = (axis.toLowerCase() === "true")

		if(showAxis){
			for(let xc in xCoords){
				let line = document.createElementNS(svgNS, 'line');
				line.setAttribute('x1', `${xCoords[xc]}`);
				line.setAttribute('y1', `335`);
				line.setAttribute('x2', `${xCoords[xc]}`);
				line.setAttribute('y2', `345`);
				line.setAttribute('stroke', 'black');
				line.setAttribute('stroke-width', '2');
				svg.appendChild(line)

				let num = document.createElementNS(svgNS, 'text');
				num.setAttribute('x', `${xCoords[xc]}`);
				num.setAttribute('y', `362`);
				num.setAttribute('font-size', '20');
				num.setAttribute('text-anchor', 'middle');
				num.setAttribute('font-family', 'sans-serif');
				num.setAttribute('fill', 'black');
				num.textContent = `${format_number(xTicks[xc],1 - (xTicks.length >= 8*plotSize[0]))}`
				svg.appendChild(num)
			}
			for(let yc in yCoords){
				let line = document.createElementNS(svgNS, 'line');
				line.setAttribute('y1', `${yCoords[yc]}`);
				line.setAttribute('x1', `55`);
				line.setAttribute('y2', `${yCoords[yc]}`);
				line.setAttribute('x2', `65`);
				line.setAttribute('stroke', 'black');
				line.setAttribute('stroke-width', '2');
				svg.appendChild(line)

				let num = document.createElementNS(svgNS, 'text');
				num.setAttribute('y', `${yCoords[yc]}`);
				num.setAttribute('x', `48`);
				num.setAttribute('font-size', '20');
				num.setAttribute('text-anchor', 'middle');
				num.setAttribute('font-family', 'sans-serif');
				num.setAttribute('fill', 'black');
				num.textContent = `${format_number(yTicks[yc],1 - (yTicks.length >= 8*plotSize[1]))}`;
				num.setAttribute('transform', `rotate(-${num.textContent.includes('-') && num.textContent.includes('e') ? 70 : 90} ${num.getAttribute('x')} ${yCoords[yc]})`);
				svg.appendChild(num)
			}
		}

		// Labels
		const textX = document.createElementNS(svgNS, 'text');
		textX.setAttribute('x', `${svgWidth/2 + 30}`);
		textX.setAttribute('y', '396');
		textX.setAttribute('text-anchor', 'middle');
		textX.setAttribute('font-family', 'sans-serif');
		textX.setAttribute('font-size', '22');
		textX.setAttribute('fill', 'black');
		textX.textContent = xLabel;
		svg.appendChild(textX);

		const textY = document.createElementNS(svgNS, 'text');
		textY.setAttribute('x', '16');
		textY.setAttribute('y', '170');
		textY.setAttribute('text-anchor', 'middle');
		textY.setAttribute('font-family', 'sans-serif');
		textY.setAttribute('font-size', '22');
		textY.setAttribute('fill', 'black');
		textY.setAttribute('transform', 'rotate(-90 17 170)');
		textY.textContent = yLabel;
		svg.appendChild(textY);

		plotContent.appendChild(svg);

		// Grade
		if(showGrid){
			for(let xc in xCoords){
				let line = document.createElementNS(svgNS, 'line');
				line.setAttribute('x1', `${xCoords[xc]}`);
				line.setAttribute('y1', `20`);
				line.setAttribute('x2', `${xCoords[xc]}`);
				line.setAttribute('y2', `340`);
				line.setAttribute('stroke', 'gray');
				line.setAttribute('stroke-width', '1');
				svg.appendChild(line)
			}
			for(let yc in yCoords){
				let line = document.createElementNS(svgNS, 'line');
				line.setAttribute('y1', `${yCoords[yc]}`);
				line.setAttribute('x1', `60`);
				line.setAttribute('y2', `${yCoords[yc]}`);
				line.setAttribute('x2', `${svgWidth-20}`);
				line.setAttribute('stroke', 'gray');
				line.setAttribute('stroke-width', '1');
				svg.appendChild(line)
			}
		}

		this.innerHTML = ''
		this.appendChild(plotContent)
	}
}

customElements.define("delta-plot", DeltaPlot)
