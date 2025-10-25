//console.log("Plot content loaded!!!")

// ----- Funções Matemáticas -----

// MDC

const _aux_gcd = (x,y) => {
	return x == 0 ? y : _aux_gcd(y%x,x);
}

const Math_gcd = (...x) => {
	x = x.map(x => parseInt(x))
	let res = x[0];
	for(let _i = 1; _i < x.length; _i++){
		res = _aux_gcd(res,x[_i])
	}
	return res;
}

// MMC

const _aux_lcm = (x,y) => {
	return x*y == 0 ? 0 : x*y/_aux_gcd(x,y);
}

const Math_lcm = (...x) => {
	x = x.map(x => parseInt(x))
	let res = x[0];
	for(let _i = 1; _i < x.length; _i++){
		res = _aux_lcm(res,x[_i])
	}
	return res;
}

// ----- Funções axuliares -----

// Converte "13,357,310.3,694.4" -> [13,357,310.3,694.4] obrigando k partes (0 = any k)
function parse_tuple(tuple,k = 0){
	if(tuple == null) return null
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

    const perfectStep = niceAlpha * scale;
    const firstTick = Math.ceil(min / perfectStep) * perfectStep;
    const ticks = [];
    let currentTick = firstTick;
    while (currentTick <= max) {
        ticks.push(parseFloat(currentTick.toFixed(12)));
        currentTick += perfectStep;
    }
    return ticks;
}

// Deixa uma linha segura pra tentar não injetar nada (NECESSÁRIO MAIS REVISÕES --- IMPORTANTE)
// Também precisa de algo assim pra tudo que tá pegando só o título e jogando direto, no caso dos data-titles (NECESSÁRIO IMPLEMENTAR --- IMPORTANTE)
function function_string_sanitizer(line){
	try {
		let creation_attempt = new Function('x', `return ${line};`);
		return line
	} catch (error) {
        console.log("Erro de sintaxe na expressão:",line);
        return null;
    }
}

// ----- Delta Plot -----

class DeltaPlot extends HTMLElement {
	constructor(){
		super()
	}

	connectedCallback(){
		const title = this.getAttribute("data-title") || null;
    	const xStr = this.getAttribute("data-x") || null
		const yStr = this.getAttribute("data-y") || null
		const xLabel = this.getAttribute("data-x-label") || "X"
		const yLabel = this.getAttribute("data-y-label") || "Y"
		const size = this.getAttribute("data-size") || null
		const grid = this.getAttribute("data-grid") || "true"
		const axis = this.getAttribute("data-axis") || "true"

		let x = parse_tuple(xStr, 2) || [0,1]
		let y = parse_tuple(yStr, 2) || [0,1]
		let showGrid = (grid.toLowerCase() === "true")
		let showAxis = (axis.toLowerCase() === "true")

		let plotSize = parse_tuple(size,2) || [0.75, 0.4]

		this.removeAttribute('data-title')
		this.removeAttribute('data-x')
		this.removeAttribute('data-y')
		this.removeAttribute('data-x-label')
		this.removeAttribute('data-y-label')
		this.removeAttribute('data-size')
		this.removeAttribute('data-grid')
		this.removeAttribute('data-axis')

		let plotContent = document.createElement('delta-plot-content')
		let plotChildren = this.children

		// Tamanho
		plotSize = [clip(plotSize[0],0.25,1),clip(plotSize[1],0.25,1)]
		if(plotSize){
			this.style.margin = `2% ${(1-plotSize[0])*50}%`
			this.style.paddingBottom = `${(plotSize[1])*100}%`
		}

		const marginLeft = 60
		const marginRight = 20
		const marginTop = 25
		const marginBottom = 55
		let marginX = marginLeft + marginRight
		let marginY = marginTop + marginBottom
		let svgWidth = parseInt(400 * (plotSize[0]/plotSize[1]))
		let svgHeight = 400

		// Criação do SVG - Base do Plot
		const svgNS = 'http://www.w3.org/2000/svg'
		const svg = document.createElementNS(svgNS, 'svg');
		svg.setAttribute('preserveAspectRatio', 'none');
		svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
		svg.classList.add('delta-plot-svg');

		const rect = document.createElementNS(svgNS, 'rect');
		rect.setAttribute('x', `${marginLeft-1}`);
		rect.setAttribute('y', `${marginTop+1}`);
		rect.setAttribute('height',`${svgHeight-marginY}`);
		rect.setAttribute('width', `${svgWidth-marginX}`);
		rect.setAttribute('fill', 'none');
		rect.setAttribute('stroke', 'black');
		rect.setAttribute('stroke-width', '1');
		svg.appendChild(rect)

		// Eixos
		if(x[0] == x[1]) x[1]++;
		if(y[0] == y[1]) y[1]++;
		let xTicks = tick_locator(x,parseInt(3.5 * plotSize[0]/plotSize[1]),'Linear',plotSize[0])
		let yTicks = tick_locator(y,3.5,'Linear',plotSize[1])
		let xCoords = xTicks.map(t => marginLeft + ((t-x[0])/(x[1]-x[0]))*(svgWidth-marginX));
		let yCoords = yTicks.map(t => marginTop + (1 - (t-y[0])/(y[1]-y[0]))*(svgHeight-marginY));

		if(showAxis){
			for(let xc in xCoords){
				let line = document.createElementNS(svgNS, 'line');
				line.setAttribute('x1', `${xCoords[xc]}`);
				line.setAttribute('y1', `${svgHeight - marginBottom - 5}`);
				line.setAttribute('x2', `${xCoords[xc]}`);
				line.setAttribute('y2', `${svgHeight - marginBottom + 5}`);
				line.setAttribute('stroke', 'black');
				line.setAttribute('stroke-width', '2');
				svg.appendChild(line)

				let num = document.createElementNS(svgNS, 'text');
				num.setAttribute('x', `${xCoords[xc]}`);
				num.setAttribute('y', `${svgHeight - marginBottom + 22}`);
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
				line.setAttribute('x1', `${marginLeft - 5}`);
				line.setAttribute('y2', `${yCoords[yc]}`);
				line.setAttribute('x2', `${marginLeft + 5}`);
				line.setAttribute('stroke', 'black');
				line.setAttribute('stroke-width', '2');
				svg.appendChild(line)

				let num = document.createElementNS(svgNS, 'text');
				num.setAttribute('y', `${yCoords[yc]}`);
				num.setAttribute('x', `${marginLeft - 12}`);
				num.setAttribute('font-size', '20');
				num.setAttribute('text-anchor', 'middle');
				num.setAttribute('font-family', 'sans-serif');
				num.setAttribute('fill', 'black');
				num.textContent = `${format_number(yTicks[yc],1 - (yTicks.length >= 8*plotSize[1]))}`;
				num.setAttribute('transform', `rotate(-${num.textContent.includes('-') && num.textContent.includes('e') ? 70 : 90} ${marginLeft - 12} ${yCoords[yc]})`);
				svg.appendChild(num)
			}
		}

		// Labels
		const textX = document.createElementNS(svgNS, 'text');
		textX.setAttribute('x', `${svgWidth/2 + 20}`);
		textX.setAttribute('y', `${svgHeight - 8}`);
		textX.setAttribute('text-anchor', 'middle');
		textX.setAttribute('font-family', 'sans-serif');
		textX.setAttribute('font-size', '22');
		textX.setAttribute('fill', 'black');
		textX.textContent = xLabel;
		svg.appendChild(textX);

		const textY = document.createElementNS(svgNS, 'text');
		let tyX = 22; let tyY = svgHeight/2 - 20
		textY.setAttribute('x', `${tyX}`);
		textY.setAttribute('y', `${tyY}`);
		textY.setAttribute('text-anchor', 'middle');
		textY.setAttribute('font-family', 'sans-serif');
		textY.setAttribute('font-size', '22');
		textY.setAttribute('fill', 'black');
		textY.setAttribute('transform', `rotate(-90 ${tyX} ${tyY})`);
		textY.textContent = yLabel;
		svg.appendChild(textY);

		const titleLabel = document.createElementNS(svgNS, 'text');
		let txX = svgWidth/2 + 20; let txY = 16
		titleLabel.setAttribute('x', `${txX}`);
		titleLabel.setAttribute('y', `${txY}`);
		titleLabel.setAttribute('text-anchor', 'middle');
		titleLabel.setAttribute('font-family', 'sans-serif');
		titleLabel.setAttribute('font-size', '22');
		titleLabel.setAttribute('fill', 'black');
		titleLabel.textContent = title;
		svg.appendChild(titleLabel);

		plotContent.appendChild(svg);

		// Grade
		if(showGrid){
			for(let xc in xCoords){
				let line = document.createElementNS(svgNS, 'line');
				line.setAttribute('x1', `${xCoords[xc]}`);
				line.setAttribute('y1', `${marginTop}`);
				line.setAttribute('x2', `${xCoords[xc]}`);
				line.setAttribute('y2', `${svgHeight - marginBottom}`);
				line.setAttribute('stroke', 'gray');
				line.setAttribute('stroke-width', '1');
				svg.appendChild(line)
			}
			for(let yc in yCoords){
				let line = document.createElementNS(svgNS, 'line');
				line.setAttribute('y1', `${yCoords[yc]}`);
				line.setAttribute('x1', `${marginLeft}`);
				line.setAttribute('y2', `${yCoords[yc]}`);
				line.setAttribute('x2', `${svgWidth - marginRight}`);
				line.setAttribute('stroke', 'gray');
				line.setAttribute('stroke-width', '1');
				svg.appendChild(line)
			}
		}

		// Processar Objetos
		// 'function' | função javascript | pontos | contradominio (a,b) | cor
		let plottableObjects = []
		Array.from(plotChildren).forEach((child, ic) => {
			// Processa apenas funções (futuramente pode ter outros objetos, como distribution, já que digitar a formulinha é mt chato)
			if(child.tagName == "DELTA-FUNCTION"){
				const dom = child.getAttribute("data-from") || null;
				const codom = child.getAttribute("data-to") || null;
				const qtPts = child.getAttribute("data-points") || null;
				const colr = child.getAttribute("data-color") || null;

				const domain = parse_tuple(dom,2) || x
				const codomain = parse_tuple(codom,2) || y
				const pts = parseInt(qtPts) ? Math.min(Math.max(parseInt(qtPts),1),50000) : 500;
				
				const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
				let funcColor;
				if (hexRegex.test(colr)) {
					funcColor = colr;
				} else {
					// Lógica pra cores de funções + rainbow pq é dahora
					const availableFuncColors = {
						'red': '#E41A1C', 'blue': '#377EB8', 'green': '#4DAF4A',
						'purple': '#984EA3', 'orange': '#FF7F00', 'yellow': '#FFFF33',
						'magenta': '#FF00FF', 'cyan': '#00FFFF', 'brown': '#A65628',
						'pink': '#F781BF', 'gray': '#999999', 'flame': '#E25822',
						'black': '#000000', 'lime': '#00FF00', 'navy': '#000080',
						'maroon': '#800000', 'teal': '#008080', 'olive': '#808000'
					};
					const defaultColors = Object.values(availableFuncColors);

					if (colr && (colr.toLowerCase() in availableFuncColors)) {
						funcColor = availableFuncColors[colr.toLowerCase()];
					} else {
						funcColor = defaultColors[ic % defaultColors.length];
					}
				}
				// O esperado é um texto simples, que vai gerar um parágrafo.
				let lines = child.innerHTML.replace(/<p>/g,'').replace(/<\/p>/g,'\n').split('\n').filter(k => k !== '');
				let compositionLines = []
				for(let l in lines){
					let line = lines[l]
					line = line.replace(/([\d\.]+)(x|y)/g,'$1*$2') //Corrige 3x -> 3*x. Funciona com y tbm
					line = line.replace(/\b(pi)\b/g,Math.PI) //Converte pi p/ número
					line = line.replace(/\b(e)\b/g,Math.E) //Converte e p/ número
					line = line.replace(/(?<!\^)\^(?!\^)/g, '**'); //Converte ^ para **
					line = line.replace(/\^\^/g, '^'); //Converte ^^ para ^
					line = line.replace('&lt;', '<'); //Converte < para forma certa
					line = line.replace('&gt;', '>'); //Converte > para forma certa

					// Coloca Math. antes de tudo que precisar e for alguma função, tipo abs()
					let mathFunctions = 'abs sqrt cbrt sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh sign round floor ceil max min log2 log10 log'.split(' ')
					let mathOrString = mathFunctions.join('|')
					const mathFunctionsRegex = new RegExp(`(${mathOrString})\\(`, 'g');
					line = line.replace(mathFunctionsRegex,'Math.$1(');

					// Coloca Math_ antes de tudo que precisar e for função artificial, tipo gcd()
					let newFunctions = 'gcd lcm'.split(' ')
					let newOrString = newFunctions.join('|')
					const newFunctionsRegex = new RegExp(`(${newOrString})\\(`, 'g');
					line = line.replace(newFunctionsRegex,'Math_$1(');

					// Função correspondente (ou função nula em caso de falha)
					let safeLine = function_string_sanitizer(line)
					console.log(safeLine,"_2")
					if(safeLine) compositionLines.push(safeLine)
				}
				
				// Troca y pela linha correspondente. Troca por 0 se na primeira.
				if(compositionLines.length){
					compositionLines[0] = compositionLines[0].replace(/\by(\d*)\b/g,'0')
				
					for(let i = 1; i < compositionLines.length; i++){
						let ys = compositionLines[i].match(/\by(\d*)\b/g);
						for(let j in ys){
							let indx = parseInt(ys[j].length == 1 ? '1' : ys[j].substring(1)) 
							if(indx == 0 || indx > i){
								compositionLines[i] = compositionLines[i].replace(`${ys[j]}`,`0`);
							} else {
								compositionLines[i] = compositionLines[i].replace(`${ys[j]}`,`(${compositionLines[indx-1]})`);
							}
						}
					}

					const composedFunction = Function('x',`return ${compositionLines[compositionLines.length-1]};`);

					let startPoint = Math.max(domain[0],x[0])
					let endPoint = Math.min(domain[1],x[1])
					const maxPoints = pts;

					if(startPoint <= endPoint){
						let nPoints = Math.max(parseInt(maxPoints*plotSize[0]*(endPoint - startPoint)/(x[1] - x[0])),1);
						let points;
						if(nPoints == 1){
							points = [(endPoint+startPoint)/2]
						} else {
							let step = (endPoint - startPoint)/(nPoints-1);
							points = Array.from({ length: nPoints }, (_, i) => startPoint + (step * i));
						}
						plottableObjects.push(['function',composedFunction,points,codomain,funcColor])
					}
				}
			}
		});

		// Mapeamento de valor x para coordenada do plot
		const mapX = (dataX) => {
			return marginLeft + ((dataX - x[0]) / (x[1] - x[0])) * (svgWidth - marginX);
		};
		const mapY = (dataY) => {
			return marginTop + (1 - (dataY - y[0]) / (y[1] - y[0])) * (svgHeight - marginY);
		};

		// Área de plotagem pra não pular fora
		const defs = document.createElementNS(svgNS, 'defs');
		const clipPath = document.createElementNS(svgNS, 'clipPath');
		clipPath.setAttribute('id', 'plot-area-clip');

		const clipRect = document.createElementNS(svgNS, 'rect');
		clipRect.setAttribute('x', `${marginLeft}`);
		clipRect.setAttribute('y', `${marginTop}`);
		clipRect.setAttribute('width', svgWidth - marginX);
		clipRect.setAttribute('height', svgHeight - marginY);

		clipPath.appendChild(clipRect);
		defs.appendChild(clipPath);
		svg.prepend(defs);

		// Agora de fato desenha os objetos
		for (const plotObject of plottableObjects) {
			const type = plotObject[0];

			switch (type) {
				case 'function':
					const [_, func, xPoints, thisCdm, thisColor] = plotObject;
					const path = document.createElementNS(svgNS, 'path');
					let d = '';

					let penState = false;
					xPoints.forEach((px) => {
						let py;
						try {
							py = func(px) ?? null;
						} catch(error){
							py = null;
						}
						if(py != null && isFinite(py) && (thisCdm[0] <= py && py <= thisCdm[1])){
							const svgX = mapX(px);
							const svgY = mapY(py);

							if (!penState) {
								d += `M ${svgX} ${svgY}`;
								penState = true;
							} else {
								d += ` L ${svgX} ${svgY}`;
							}
						} else {
							penState = false;
						}
					});

					path.setAttribute('d', d);
					path.setAttribute('stroke', thisColor);
					path.setAttribute('stroke-width', '2');
					path.setAttribute('fill', 'none');
					path.setAttribute('clip-path', 'url(#plot-area-clip)');

					svg.appendChild(path);
					break;
			}
		}

		this.innerHTML = ''
		this.appendChild(plotContent)
	}
}

customElements.define("delta-plot", DeltaPlot)