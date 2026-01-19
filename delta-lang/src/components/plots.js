// ----- Constantes -----

const ANY = 0;

// ----- Funções Matemáticas -----

/*
	Dados n inteiros x1, ..., xn, retorna o máximo divisor comum de todos eles.
*/
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

/*
	Dados n inteiros x1, ..., xn, retorna o mínimo múltiplo comum de todos eles.
*/
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

/*
	Função de densidade de probabilidade - Distribuição Normal
*/
const Math_normal = (x, mu, sigma) => {
    if (sigma <= 0) return NaN;
    
    let z = (x - mu) / sigma;
    let cons = 1.0 / (sigma * Math.sqrt(2.0 * Math.PI));
    return cons * Math.exp(-0.5 * z * z);
}

/*
	Função de densidade de probabilidade - Distribuição Uniforme
*/
const Math_uniform = (x, a, b) => {
    if (a >= b) return NaN;
    if (x < a || x > b) return 0;
    return 1 / (b - a);
}

/*
	Função de densidade de probabilidade - Distribuição Exponencial
*/
const Math_exponential = (x, lambda) => {
    if (lambda <= 0 || x < 0) return 0;
    return lambda * Math.exp(-lambda * x);
}

// ----- Funções Auxiliares -----
 
/*
	Dada uma string representando uma tupla de valores, converte para uma lista com esses valores. Argumentos são k = tamanho da tupla,
	onde tamanhos diferentes desse são rejeitados e retornam null. 0 indica que qualquer tamanho vale. numbers força que os termos sejam números também.
	"13,357,310.3,694.4" -> [13,357,310.3,694.4]
*/
function parse_tuple(tuple, k = 0, numbers = true){
	if(tuple == null) return null
	const parts = tuple.split(',');
	if (k > 0 && parts.length !== k) {
		return null
	}

	if(numbers){
		const nums = parts.map(el => parseFloat(el.trim()));
		if (nums.some(num => isNaN(num))) {
			return null;
		}
		return nums;
	} else {
		return parts;
	}
}

/*
	Força x no intervalo [a,b]. Se passar de uma borda, retorna aquela borda.
	null indica que não tem aquele limite lateral, identificado por ?? para validar o null.
*/
function clip(x, a = null, b = null){
	return Math.max(Math.min(x,(b ?? Infinity)),(a ?? -Infinity));
}

/*
	Formata um número x para outra notação. por enquanto só científica.
*/
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

/*
	Dado x = [a,b], pega lista de pontos que ficaria agradável de colocar marcadores no gráfico, ex: 10000, 20000, 25000, 50000
*/
function tick_locator(x, targetTicks = 5, plotScale = 'Linear', borderControl = 0.75){
    let [min, max] = x;
    if(min > max){
        [min, max] = [max, min];
    }

	let unplugFromBorders = (max-min)*(0.004)/borderControl
	min += unplugFromBorders
	max -= unplugFromBorders

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

/*
	Dada uma linha contendo uma descrição de uma função, retorna se ela é uma função válida ou não.
*/
// TODO (na verdade DOING): Rework do sistema de conversão de texto para função, pois isso tem muitos problemas de segurança
// Nomes úteis: Algoritmo de Shunting-Yard
function function_string_sanitizer(line){
	return true;
}

// ----- Conteúdos -----

// Funções chamadas com Math.X
const content_mathFunctions = [
	'abs', 'sqrt', 'cbrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
	'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'sign', 'round',
	'floor', 'ceil', 'max', 'min', 'log2', 'log10', 'log'
]

// Funções criadas para serem chamadas com Math_X
const content_artificialFunctions = [
	'gcd', 'lcm'
]

// Constantes
const content_constants = {
	'pi': Math.PI,
	'e': Math.E
}

// Operadores convertidos
const content_conversions = {
	'^^': '^', //xor
	'^': '**', //potência
}

// ----- Delta Plot -----

class DeltaPlot extends HTMLElement {
	#title; #x; #y; #showGrid; #showAxis;
	#plotContent; #plotChildren; #plotSize;

	#marginLeft; #marginRight; #marginTop; #marginBottom;
	#marginX; #marginY; #svgWidth; #svgHeight; #svg; #svgNS;

	#xTicks; #yTicks; #xCoords; #yCoords; #xLabel; #yLabel;

	constructor(){
		super()
	}

	#prepare_parameters(){
		this.#title = this.getAttribute("data-title") || null;

    	let xStr = this.getAttribute("data-x") || null
		let yStr = this.getAttribute("data-y") || null
		this.#x = parse_tuple(xStr, 2) || [0,1]
		this.#y = parse_tuple(yStr, 2) || [0,1]

		this.#xLabel = this.getAttribute("data-x-label") || "X"
		this.#yLabel = this.getAttribute("data-y-label") || "Y"

		let grid = this.getAttribute("data-grid") || "true"
		let axis = this.getAttribute("data-axis") || "true"
		this.#showGrid = (grid.toLowerCase() === "true")
		this.#showAxis = (axis.toLowerCase() === "true")

		let size = this.getAttribute("data-size") || null
		let sizeTuple = parse_tuple(size,2) || [0.9, 0.5]
		this.#plotSize = [clip(sizeTuple[0],0.25,1),clip(sizeTuple[1],0.25,1)]
		if(this.#plotSize){
			this.style.margin = `2% ${(1-this.#plotSize[0])*50}%`
			this.style.paddingBottom = `${(this.#plotSize[1])*100}%`
		}

		this.#plotContent = document.createElement('delta-plot-content')
		this.#plotChildren = this.children

		this.#marginLeft = 60
		this.#marginRight = 20
		this.#marginTop = 25
		this.#marginBottom = 55
		this.#marginX = (this.#marginLeft + this.#marginRight)
		this.#marginY = (this.#marginTop + this.#marginBottom);
		this.#svgHeight = 400
		this.#svgWidth = parseInt(400 * (this.#plotSize[0]/this.#plotSize[1]));
	}

	#prepare_function_string(line){
		line = line.replace(/&lt;/g, '<');
		line = line.replace(/&gt;/g, '>');

        for (const [key, val] of Object.entries(content_constants)) {
            line = line.replace(new RegExp(`\\b${key}\\b`, 'g'), val);
        }

        const tokenMap = {}; let tokenIndex = 0;
        for (const [op, replacement] of Object.entries(content_conversions)) {
            const token = `CONFIGTOKEN${tokenIndex++}`;
            tokenMap[token] = replacement;
            
            const escapedOp = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            line = line.replace(new RegExp(escapedOp, 'g'), token);
        }
        for (const [token, value] of Object.entries(tokenMap)) {
            line = line.replaceAll(token, value);
        }

        const applyFunctionPrefix = (list, prefix) => {
            const uniqueFuncs = [...new Set(list)].sort((a, b) => b.length - a.length);
            if (uniqueFuncs.length > 0) {
                const pattern = uniqueFuncs.join('|');
                const regex = new RegExp(`\\b(${pattern})\\(`, 'g');
                line = line.replace(regex, `${prefix}$1(`);
            }
        };

        applyFunctionPrefix(content_mathFunctions, 'Math.');
        applyFunctionPrefix(content_artificialFunctions, 'Math_');
		//todo: deixar o 3x -> 3*x automatico dnv qnd eu implementar mais modular a composição de funções

        return line;
	}

	#prepare_plotting_area(){
		const defs = document.createElementNS(this.#svgNS, 'defs');
		const clipPath = document.createElementNS(this.#svgNS, 'clipPath');
		clipPath.setAttribute('id', 'plot-area-clip');

		const clipRect = document.createElementNS(this.#svgNS, 'rect');
		clipRect.setAttribute('x', `${this.#marginLeft}`);
		clipRect.setAttribute('y', `${this.#marginTop}`);
		clipRect.setAttribute('width', this.#svgWidth - this.#marginX);
		clipRect.setAttribute('height', this.#svgHeight - this.#marginY);

		clipPath.appendChild(clipRect);
		defs.appendChild(clipPath);
		this.#svg.prepend(defs);
	}

	#create_plot_base(){
		// Plot Body
		this.#svgNS = 'http://www.w3.org/2000/svg'
		this.#svg = document.createElementNS(this.#svgNS, 'svg');
		this.#svg.setAttribute('preserveAspectRatio', 'none');
		this.#svg.setAttribute('viewBox', `0 0 ${this.#svgWidth} ${this.#svgHeight}`);
		this.#svg.classList.add('delta-plot-svg');

		const rect = document.createElementNS(this.#svgNS, 'rect');
		rect.setAttribute('x', `${this.#marginLeft-1}`);
		rect.setAttribute('y', `${this.#marginTop+1}`);
		rect.setAttribute('height',`${this.#svgHeight-this.#marginY}`);
		rect.setAttribute('width', `${this.#svgWidth-this.#marginX}`);
		rect.setAttribute('fill', 'none');
		rect.setAttribute('stroke', 'black');
		rect.setAttribute('stroke-width', '1');
		this.#svg.appendChild(rect)

		// Axis
		if(this.#x[0] == this.#x[1]) this.#x[1]++;
		if(this.#y[0] == this.#y[1]) this.#y[1]++;
		this.#xTicks = tick_locator(this.#x,parseInt(3.5 * this.#plotSize[0]/this.#plotSize[1]),'Linear',this.#plotSize[0])
		this.#yTicks = tick_locator(this.#y,3.5,'Linear',this.#plotSize[1])
		this.#xCoords = this.#xTicks.map(t => this.#marginLeft + ((t-this.#x[0])/(this.#x[1]-this.#x[0]))*(this.#svgWidth-this.#marginX));
		this.#yCoords = this.#yTicks.map(t => this.#marginTop + (1 - (t-this.#y[0])/(this.#y[1]-this.#y[0]))*(this.#svgHeight-this.#marginY));

		const barSpace = 5; const textSpace = 17;
		if(this.#showAxis){
			for(let xc in this.#xCoords){
				let line = document.createElementNS(this.#svgNS, 'line');
				line.setAttribute('x1', `${this.#xCoords[xc]}`);
				line.setAttribute('y1', `${this.#svgHeight - this.#marginBottom - barSpace}`);
				line.setAttribute('x2', `${this.#xCoords[xc]}`);
				line.setAttribute('y2', `${this.#svgHeight - this.#marginBottom + barSpace}`);
				line.setAttribute('stroke', 'black');
				line.setAttribute('stroke-width', '2');
				this.#svg.appendChild(line)

				let num = document.createElementNS(this.#svgNS, 'text');
				num.setAttribute('x', `${this.#xCoords[xc]}`);
				num.setAttribute('y', `${this.#svgHeight - this.#marginBottom + (textSpace + barSpace)}`);
				num.setAttribute('font-size', '20');
				num.setAttribute('text-anchor', 'middle');
				num.setAttribute('font-family', 'sans-serif');
				num.setAttribute('fill', 'black');
				num.textContent = `${format_number(this.#xTicks[xc],1 - (this.#xTicks.length >= 8*this.#plotSize[0]))}`
				this.#svg.appendChild(num)
			}
			for(let yc in this.#yCoords){
				let line = document.createElementNS(this.#svgNS, 'line');
				line.setAttribute('y1', `${this.#yCoords[yc]}`);
				line.setAttribute('x1', `${this.#marginLeft - barSpace}`);
				line.setAttribute('y2', `${this.#yCoords[yc]}`);
				line.setAttribute('x2', `${this.#marginLeft + barSpace}`);
				line.setAttribute('stroke', 'black');
				line.setAttribute('stroke-width', '2');
				this.#svg.appendChild(line)

				let num = document.createElementNS(this.#svgNS, 'text');
				num.setAttribute('y', `${this.#yCoords[yc]}`);
				num.setAttribute('x', `${this.#marginLeft - (textSpace - barSpace)}`);
				num.setAttribute('font-size', '20');
				num.setAttribute('text-anchor', 'middle');
				num.setAttribute('font-family', 'sans-serif');
				num.setAttribute('fill', 'black');
				num.textContent = `${format_number(this.#yTicks[yc],1 - (this.#yTicks.length >= 8*this.#plotSize[1]))}`;
				let rotationAng = num.textContent.includes('-') && num.textContent.includes('e') ? 70 : 90
				num.setAttribute('transform', `rotate(-${rotationAng} ${this.#marginLeft - (textSpace - barSpace)} ${this.#yCoords[yc]})`);
				this.#svg.appendChild(num)
			}
		}

		// Grid
		if(this.#showGrid){
			for(let xc in this.#xCoords){
				let line = document.createElementNS(this.#svgNS, 'line');
				line.setAttribute('x1', `${this.#xCoords[xc]}`);
				line.setAttribute('y1', `${this.#marginTop}`);
				line.setAttribute('x2', `${this.#xCoords[xc]}`);
				line.setAttribute('y2', `${this.#svgHeight - this.#marginBottom}`);
				line.setAttribute('stroke', 'gray');
				line.setAttribute('stroke-width', '1');
				this.#svg.appendChild(line)
			}
			for(let yc in this.#yCoords){
				let line = document.createElementNS(this.#svgNS, 'line');
				line.setAttribute('y1', `${this.#yCoords[yc]}`);
				line.setAttribute('x1', `${this.#marginLeft}`);
				line.setAttribute('y2', `${this.#yCoords[yc]}`);
				line.setAttribute('x2', `${this.#svgWidth - this.#marginRight}`);
				line.setAttribute('stroke', 'gray');
				line.setAttribute('stroke-width', '1');
				this.#svg.appendChild(line)
			}
		}

		// Labels
		let titleX = this.#svgWidth/2 + 20; let titleY = 18;
		let txX = this.#svgWidth/2 + 20; let txY = this.#svgHeight - 8;
		let tyX = 22; let tyY = this.#svgHeight/2 - 20;

		const textX = document.createElementNS(this.#svgNS, 'text');
		textX.setAttribute('x', `${txX}`);
		textX.setAttribute('y', `${txY}`);
		textX.setAttribute('text-anchor', 'middle');
		textX.setAttribute('font-family', 'sans-serif');
		textX.setAttribute('font-size', '22');
		textX.setAttribute('fill', 'black');
		textX.textContent = this.#xLabel;
		this.#svg.appendChild(textX);

		const textY = document.createElementNS(this.#svgNS, 'text');
		textY.setAttribute('x', `${tyX}`);
		textY.setAttribute('y', `${tyY}`);
		textY.setAttribute('text-anchor', 'middle');
		textY.setAttribute('font-family', 'sans-serif');
		textY.setAttribute('font-size', '22');
		textY.setAttribute('fill', 'black');
		textY.setAttribute('transform', `rotate(-90 ${tyX} ${tyY})`);
		textY.textContent = this.#yLabel;
		this.#svg.appendChild(textY);

		const titleLabel = document.createElementNS(this.#svgNS, 'text');
		titleLabel.setAttribute('x', `${titleX}`);
		titleLabel.setAttribute('y', `${titleY}`);
		titleLabel.setAttribute('text-anchor', 'middle');
		titleLabel.setAttribute('font-family', 'sans-serif');
		titleLabel.setAttribute('font-size', '22');
		titleLabel.setAttribute('fill', 'black');
		titleLabel.textContent = this.#title;
		this.#svg.appendChild(titleLabel);

		this.#plotContent.appendChild(this.#svg);
	}

	#process_function(funcObj, i){
		let label = funcObj.getAttribute("data-title") || null;

		const dom = funcObj.getAttribute("data-from") || null;
		const domain = parse_tuple(dom,2) || this.#x

		const overflow = 1.5 // Tolerancia para desenhar pontos acima e abaixo do gráfico
		const codom = funcObj.getAttribute("data-to") || null;
		const codomain = parse_tuple(codom,2) || [this.#y[0]*overflow,this.#y[1]*overflow]

		const qtPts = funcObj.getAttribute("data-points") || null;
		const pts = parseInt(qtPts) ? Math.min(Math.max(parseInt(qtPts),2),80000) : 500;
		let funcColor, parsedFunction = null;

		// Cor
		const chosenColor = funcObj.getAttribute("data-color") || null;
		const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
		if (hexRegex.test(chosenColor)) {
			funcColor = chosenColor;
		} else {
			const availableFuncColors = {
				'red': '#E41A1C', 'blue': '#377EB8', 'green': '#4DAF4A',
				'purple': '#984EA3', 'orange': '#FF7F00', 'yellow': '#FFFF33',
				'magenta': '#FF00FF', 'cyan': '#00FFFF', 'brown': '#A65628',
				'pink': '#F781BF', 'gray': '#999999', 'flame': '#E25822',
				'black': '#000000', 'lime': '#00FF00', 'navy': '#000080',
				'maroon': '#800000', 'teal': '#008080', 'olive': '#808000'
			};
			const defaultColors = Object.values(availableFuncColors);

			if (chosenColor && (chosenColor.toLowerCase() in availableFuncColors)) {
				funcColor = availableFuncColors[chosenColor.toLowerCase()];
			} else {
				funcColor = defaultColors[i % defaultColors.length];
			}
		}
		if(funcObj.tagName == "DELTA-FUNCTION"){
			if(label === null){
				label = `Function ${i + 1}`
			}
			let line = funcObj.innerHTML.replace(/<p>/g,'').replace(/<\/p>/g,'');
			let parsedLine = this.#prepare_function_string(line);
			parsedFunction = Function('x',`return ${parsedLine};`);
			if(label === null){
				label = `Function ${i + 1}`
			}
		} else if(funcObj.tagName == 'DELTA-DISTRIBUTION'){
			const pdfunc = funcObj.getAttribute("data-pdf") || ""; let params;
			switch (pdfunc.toLowerCase()) {
				case "normal":
					params = funcObj.getAttribute("data-parameters") || null;
					params = parse_tuple(params, 2) || [0,1];
					parsedFunction = (xxx) => Math_normal(xxx,params[0],params[1]);
					label = label || "Dist. Normal";
					break;
				case "exponential":
					params = funcObj.getAttribute("data-parameters") || null;
					params = parse_tuple(params, 1) || [1];
					parsedFunction = (xxx) => Math_exponential(xxx,params[0]);
					label = label || "Dist. Exponencial";
					break;
				case "uniform":
					params = funcObj.getAttribute("data-parameters") || null;
					params = parse_tuple(params, 2) || [0,1];
					parsedFunction = (xxx) => Math_uniform(xxx,params[0],params[1]);
					label = label || "Dist. Uniforme";
					break;
			}
		}

		if(parsedFunction){
			let startPoint = Math.max(domain[0],this.#x[0])
			let endPoint = Math.min(domain[1],this.#x[1])
			const maxPoints = pts;

			if(startPoint <= endPoint){
				let nPoints = Math.max(parseInt(maxPoints*this.#plotSize[0]*(endPoint - startPoint)/(this.#x[1] - this.#x[0])),1);
				let points;
				if(nPoints == 1){
					points = [(endPoint+startPoint)/2]
				} else {
					let step = (endPoint - startPoint)/(nPoints-1);
					points = Array.from({ length: nPoints }, (_, i) => startPoint + (step * i));
				}
				return ['function',parsedFunction,points,codomain,funcColor,label]
			}
		}
	}

	#process_legend(legendObj){
		const legendObjects = legendObj.getAttribute("data-objects") || null;
		const legendPos = legendObj.getAttribute("data-position") || null;
		const isFixed = legendObj.getAttribute("data-fixed") || null;
		const legendSize = legendObj.getAttribute("data-size") || null;
		const legendOpacity = legendObj.getAttribute("data-opacity") || null;

		let obj = parse_tuple(legendObjects,ANY) || ['all']
		let posTemp = parse_tuple(legendPos,ANY,false) || ['top right']
		
		let pos = [];
		const posOptions = ['top left', 'top right', 'bottom left', 'bottom right'];
		if(posTemp.length == 1){
			if (posOptions.includes(posTemp[0].trim())) {
				let ptemp = posTemp[0].trim().split(' ');
				pos = [ptemp[1], ptemp[0]];
			} else {
				pos = ['right','top'];
			}
		} else if(posTemp.length == 2){
			let ptemp = parse_tuple(legendPos,2) || [0,1]
			pos = [clip(ptemp[0],0,1),clip(ptemp[1],0,1)];
		} else {
			pos = ['right','top'];
		}
		
		let fixed = (isFixed ?? 'false').toLowerCase() === 'true';

		let sizeTemp = parse_tuple(legendSize, 2) || [0.3,0.4];
		let size = [clip(sizeTemp[0], 0.1, 0.8), clip(sizeTemp[1], 0.1, 0.8)];

		let opacityTemp = parseFloat(legendOpacity);
		let opacity = clip(isNaN(opacityTemp) ? 0.9 : opacityTemp, 0, 1);

		return ['legend',obj,pos,fixed,size,opacity];
	}

	#draw_function(plotObj){
		const mapX = (dataX) => {
			return this.#marginLeft + ((dataX - this.#x[0]) / (this.#x[1] - this.#x[0])) * (this.#svgWidth - this.#marginX);
		};
		const mapY = (dataY) => {
			return this.#marginTop + (1 - (dataY - this.#y[0]) / (this.#y[1] - this.#y[0])) * (this.#svgHeight - this.#marginY);
		};

		const [_, func, xPoints, thisCdm, thisColor, ___] = plotObj;
		const path = document.createElementNS(this.#svgNS, 'path');
		let d = ''; let penState = false;
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

		this.#svg.appendChild(path);
	}

	#draw_legend(plotObj, plotObjects){
		const [__, obj, pos, fixed, size, opacity] = plotObj;
		let legendHtmlContent = '';
		let itemsToDisplay = new Set();

		for (const objRule of obj) {
			if (objRule === 'all') {
				plotObjects.forEach((item) => {
					if (item[0] !== 'legend') itemsToDisplay.add(item);
				});
			} else if (parseInt(objRule) != NaN) {
				let objId = clip(objRule,1,plotObjects.length) 
				if (plotObjects[objId-1][0] !== 'legend') {
					itemsToDisplay.add(plotObjects[objId-1]);
				}
			}
		}

		// HTML da Legenda
		for (const item of itemsToDisplay) {
			// [_, func, pts, cdm, color, label]
			const itemColor = item[4];
			const itemLabel = item[5];
			legendHtmlContent += `<div style="margin: 3px 0; display: flex; align-items: center;">
				<span style="width: 20px; height: 2px; background-color: ${itemColor}; margin-right: 5px;"></span>
				<span style="white-space: nowrap;">${itemLabel}</span>
			</div>`;
		}
		if (legendHtmlContent === '') legendHtmlContent = '<div style="color: gray; font-style: italic;">Sem dados</div>';

		// Posicionamentos
		const legendPadding = 10;
		const plotAreaWidth = this.#svgWidth - this.#marginX;
		const plotAreaHeight = this.#svgHeight - this.#marginY;
		const legendWidth = size[0] * plotAreaWidth;
		const legendHeight = size[1] * plotAreaHeight;

		let legendX, legendY;
		if(pos[0] == 'left'){
			legendX = this.#marginLeft + legendPadding;
		} else if(pos[0] == 'right'){
			legendX = this.#svgWidth - this.#marginRight - legendWidth - legendPadding;
		} else {
			legendX = this.#marginLeft + pos[0] * (plotAreaWidth - legendWidth);
		}
		if(pos[1] == 'top'){
			legendY = this.#marginTop + legendPadding;
		} else if(pos[1] == 'bottom'){
			legendY = this.#svgHeight - this.#marginBottom - legendHeight - legendPadding;
		} else {
			legendY = this.#marginTop + pos[1] * (plotAreaHeight - legendHeight);
		}

		// foreignObject para scroll
		const legend = document.createElementNS(this.#svgNS, 'foreignObject');
		legend.setAttribute('x', legendX);
		legend.setAttribute('y', legendY);
		legend.setAttribute('width', legendWidth);
		legend.setAttribute('height', legendHeight);
		const xhtmlNS = 'http://www.w3.org/1999/xhtml';

		// Wrapper principal pra legenda
		const legendWrapper = document.createElementNS(xhtmlNS, 'div');
		legendWrapper.setAttribute('xmlns', xhtmlNS);
		legendWrapper.style.position = 'relative';
		legendWrapper.style.height = '100%';
		legendWrapper.style.width = '100%';

		// Div de conteúdo rolável
		const legendContentDiv = document.createElementNS(xhtmlNS, 'div');
		legendContentDiv.setAttribute('xmlns', xhtmlNS);
		legendContentDiv.style.height = '100%';
		legendContentDiv.style.overflowY = 'auto';
		legendContentDiv.style.background = `rgba(255, 255, 255, ${opacity})`;
		legendContentDiv.style.border = '1px solid #ccc';
		legendContentDiv.style.borderRadius = '4px';
		legendContentDiv.style.padding = '5px';
		legendContentDiv.style.boxSizing = 'border-box';
		legendContentDiv.style.fontFamily = 'sans-serif';
		legendContentDiv.style.fontSize = '14px';
		legendContentDiv.innerHTML = legendHtmlContent;

		// Botão de Toggle (foreign -> xmlns)
		const legendToggleBtn = document.createElementNS(xhtmlNS, 'button');
		legendToggleBtn.setAttribute('xmlns', xhtmlNS);
		legendToggleBtn.className = 'legend-toggle-btn';

		// Ícone SVG para o botão de toggle
		const iconSvg = document.createElementNS(this.#svgNS, 'svg');
		iconSvg.setAttribute('viewBox', '0 0 24 24');
		iconSvg.classList.add('legend-toggle-icon');

		const circlePath = document.createElementNS(this.#svgNS, 'circle');
		circlePath.setAttribute('cx', '12');
		circlePath.setAttribute('cy', '12');
		circlePath.setAttribute('r', '6');
		circlePath.classList.add('legend-toggle-circle', 'legend-toggle-circle--filled');

		iconSvg.appendChild(circlePath);
		legendToggleBtn.appendChild(iconSvg);

		// Botão de Drag (foreign -> xmlns)
		const legendDragHandle = document.createElementNS(xhtmlNS, 'button');
		legendDragHandle.setAttribute('xmlns', xhtmlNS);
		legendDragHandle.className = 'legend-drag-handle';

		// Ícone SVG para o botão de drag
		const dragIconSvg = document.createElementNS(this.#svgNS, 'svg');
		dragIconSvg.setAttribute('viewBox', '0 0 15 16');
		dragIconSvg.style.width = '14px';
		dragIconSvg.style.height = '14px';

		const dragIconPath = document.createElementNS(this.#svgNS, 'path');
		dragIconPath.setAttribute('fill', '#333');
		dragIconPath.setAttribute('d', 'M8 0L5 4h6L8 0z M8 16l3-4H5l3 4z M0 8l4-3v6L0 8z M16 8l-4 3V5l4 3z');
		
		dragIconSvg.appendChild(dragIconPath);
		legendDragHandle.appendChild(dragIconSvg);

		// Click pra ativar/desativar legenda
		legendToggleBtn.addEventListener('click', () => {
			const isHidden = legendContentDiv.style.display === 'none';
			if (isHidden) {
				legendContentDiv.style.display = 'block';
				if(!fixed) legendDragHandle.style.display = 'block';
				circlePath.classList.remove('legend-toggle-circle--outlined');
				circlePath.classList.add('legend-toggle-circle--filled');
			} else {
				legendContentDiv.style.display = 'none';
				if(!fixed) legendDragHandle.style.display = 'none';
				circlePath.classList.remove('legend-toggle-circle--filled');
				circlePath.classList.add('legend-toggle-circle--outlined');
			}
		});

		legendWrapper.appendChild(legendToggleBtn);
		legendWrapper.appendChild(legendDragHandle);
		legendWrapper.appendChild(legendContentDiv);
		legend.appendChild(legendWrapper);
		this.#svg.appendChild(legend);

		// Legenda pode sair mudando de lugar
		if (!fixed) {
			let isDragging = false;
			let offset = { x: 0, y: 0 };

			// Extrai coordenadas do SVG
			const getSVGCoordinates = (e) => {
				const CTM = this.#svg.getScreenCTM();
				const svgPoint = this.#svg.createSVGPoint();
				svgPoint.x = e.clientX;
				svgPoint.y = e.clientY;
				return svgPoint.matrixTransform(CTM.inverse());
			};

			legendToggleBtn.addEventListener('mousedown', (e) => {
				e.stopPropagation();
			});

			legendContentDiv.addEventListener('mousedown', (e) => {
				e.stopPropagation();
			});

			legendDragHandle.addEventListener('mousedown', (e) => {
				e.stopPropagation();
				isDragging = true;
				legendWrapper.style.cursor = 'move';
				
				const svgCoords = getSVGCoordinates(e);
				const currentX = parseFloat(legend.getAttribute('x'));
				const currentY = parseFloat(legend.getAttribute('y'));
				
				offset.x = svgCoords.x - currentX;
				offset.y = svgCoords.y - currentY;
			});

			this.#svg.addEventListener('mousemove', (e) => {
				if (!isDragging) return;
				
				e.preventDefault();
				
				const svgCoords = getSVGCoordinates(e);
				let newX = svgCoords.x - offset.x;
				let newY = svgCoords.y - offset.y;

				const minX = this.#marginLeft;
				const maxX = this.#svgWidth - this.#marginRight - legendWidth;
				const minY = this.#marginTop;
				const maxY = this.#svgHeight - this.#marginBottom - legendHeight;

				newX = Math.max(minX, Math.min(newX, maxX));
				newY = Math.max(minY, Math.min(newY, maxY));
				
				legend.setAttribute('x', newX);
				legend.setAttribute('y', newY);
			});

			const stopDragging = () => {
				isDragging = false;
				legendWrapper.style.cursor = 'default';
			};

			this.#svg.addEventListener('mouseup', stopDragging);
			this.#svg.addEventListener('mouseleave', stopDragging);
		} else {
			legendDragHandle.style.display = 'none';
		}
	}

	connectedCallback(){
		// Obtém parâmetros do plot definidos no texto delta e os prepara para o formato adequado
		this.#prepare_parameters()

		// Cria a base do plot: Fundo, grade, marcadores, ...
		this.#create_plot_base()

		// Processa os objetos dentro do plot e os guarda no formato abaixo
		// 'function' | função javascript - f | pontos - [[a,b],...] | contradominio - [a,b] | cor - str | label - str
		// 'legend' | tupla de objetos | posição | fixed | size | opacity
		let plotObjects = []
		Array.from(this.#plotChildren).forEach((child, ic) => {
			if(["DELTA-FUNCTION", "DELTA-DISTRIBUTION"].includes(child.tagName)){
				plotObjects.push(this.#process_function(child,ic))
			} else if(child.tagName == "DELTA-LEGEND"){
				plotObjects.push(this.#process_legend(child));
			}
		});

		// Desenha os objetos processados no SVG
		this.#prepare_plotting_area()
		for(let objc of plotObjects){
			if(objc[0] == 'function'){
				this.#draw_function(objc)
			} else if(objc[0] == 'legend'){
				this.#draw_legend(objc, plotObjects)
			}
		}

		// Anexa o plot no documento
		this.innerHTML = ''
		this.appendChild(this.#plotContent)
	}
}

customElements.define("delta-plot", DeltaPlot)