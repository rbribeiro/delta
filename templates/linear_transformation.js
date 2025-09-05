// Define the HTML and CSS for the widget in a template
const template = document.createElement('template');
template.innerHTML = `
    <style>
        /* All the CSS is now scoped to this component thanks to the Shadow DOM */
        :host {
            display: block; /* Custom elements are inline by default */
        }
        .widget-container {
            font-family: 'Inter', sans-serif;
            display: flex;
            flex-wrap: wrap;
            gap: 30px;
            padding: 25px;
            background-color: #ffffff;
            border-radius: 16px;
            align-items: center;
            width: 100%;
        }
        canvas {
            border: 1px solid #dee2e6;
            border-radius: 8px;
        }
        .controls {
            display: grid;
            grid-template-columns: auto auto 1fr; 
            gap: 15px 10px;
            align-items: center;
        }
        .controls label {
            font-weight: 700;
            text-align: right;
        }
        .controls .number-input {
            font-family: 'Inter', sans-serif;
            width: 60px;
            padding: 8px;
            border: 1px solid #ced4da;
            border-radius: 6px;
            font-size: 1rem;
            text-align: center;
        }
        .controls .slider-input {
            width: 100%;
            margin-left: 5px;
        }
        .determinant-display {
            grid-column: 1 / -1;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e9ecef;
            text-align: center;
        }
        strong { font-size: 1.2rem; }
        p { margin: 5px 0 0; font-size: 0.9rem; color: #495057; }
    </style>

    <div class="widget-container">
        <canvas id="transformationCanvas" width="400" height="400"></canvas>
        <div class="controls">
            <label for="num_a">a</label>
            <input type="number" id="num_a" class="number-input" value="1" step="0.1">
            <input type="range" id="slider_a" class="slider-input" min="-2" max="2" value="1" step="0.01">

            <label for="num_c">c</label>
            <input type="number" id="num_c" class="number-input" value="0" step="0.1">
            <input type="range" id="slider_c" class="slider-input" min="-2" max="2" value="0" step="0.01">

            <label for="num_b">b</label>
            <input type="number" id="num_b" class="number-input" value="0" step="0.1">
            <input type="range" id="slider_b" class="slider-input" min="-2" max="2" value="0" step="0.01">
            
            <label for="num_d">d</label>
            <input type="number" id="num_d" class="number-input" value="1" step="0.1">
            <input type="range" id="slider_d" class="slider-input" min="-2" max="2" value="1" step="0.01">

            <div class="determinant-display">
                <strong>Determinant: <span id="det-value">1.00</span></strong>
                <p id="det-info">Area is scaled by 1.00x. Orientation is preserved.</p>
            </div>
        </div>
    </div>
`;

class LinearTransformation extends HTMLElement {
    constructor() {
        super();
        // Create a Shadow DOM and attach the template's content
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    // This method is called when the element is added to the page
    connectedCallback() {
        // Get references to elements inside the Shadow DOM
        const canvas = this.shadowRoot.getElementById('transformationCanvas');
        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        const scale = 30;
        const origin = { x: size / 2, y: size / 2 };

        const components = ['a', 'b', 'c', 'd'];
        const inputs = {};
        components.forEach(key => {
            inputs[key] = {
                num: this.shadowRoot.getElementById(`num_${key}`),
                slider: this.shadowRoot.getElementById(`slider_${key}`)
            };
        });
        
        const detValueEl = this.shadowRoot.getElementById('det-value');
        const detInfoEl = this.shadowRoot.getElementById('det-info');

        const map = (x, y) => ({ x: origin.x + x * scale, y: origin.y - y * scale });

        const transformPoint = (x, y, M) => ({
            x: M.a * x + M.c * y,
            y: M.b * x + M.d * y,
        });

        const drawGrid = (M) => {
            ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 1;
            const range = Math.floor(size / (2 * scale));
            for (let i = -range; i <= range; i++) {
                let p1 = transformPoint(i, -range, M), p2 = transformPoint(i, range, M);
                let cp1 = map(p1.x, p1.y), cp2 = map(p2.x, p2.y);
                ctx.beginPath(); ctx.moveTo(cp1.x, cp1.y); ctx.lineTo(cp2.x, cp2.y); ctx.stroke();
                p1 = transformPoint(-range, i, M); p2 = transformPoint(range, i, M);
                cp1 = map(p1.x, p1.y); cp2 = map(p2.x, p2.y);
                ctx.beginPath(); ctx.moveTo(cp1.x, cp1.y); ctx.lineTo(cp2.x, cp2.y); ctx.stroke();
            }
        };

        const drawAxes = () => {
            ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(size, origin.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, size); ctx.stroke();
        };

        const drawVector = (x, y, color) => {
            const head = map(x, y);
            ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(head.x, head.y); ctx.stroke();
            ctx.save(); ctx.translate(head.x, head.y); ctx.rotate(-Math.atan2(y * scale, x * scale));
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5); ctx.closePath(); ctx.fill();
            ctx.restore();
        };
        
        const update = () => {
            const M = {
                a: parseFloat(inputs.a.num.value), b: parseFloat(inputs.b.num.value),
                c: parseFloat(inputs.c.num.value), d: parseFloat(inputs.d.num.value),
            };
            ctx.clearRect(0, 0, size, size);
            drawGrid(M);
            drawAxes();
            drawVector(M.a, M.b, '#e03131');
            drawVector(M.c, M.d, '#2f9e44');
            const det = M.a * M.d - M.b * M.c;
            detValueEl.textContent = det.toFixed(2);
            const orientation = det < 0 ? 'flipped' : 'preserved';
            detInfoEl.textContent = `Area is scaled by ${Math.abs(det).toFixed(2)}x. Orientation is ${orientation}.`;
        };

        components.forEach(key => {
            const { num, slider } = inputs[key];
            slider.addEventListener('input', () => {
                num.value = slider.value;
                update();
            });
            num.addEventListener('input', () => {
                slider.value = num.value;
                update();
            });
        });

        update(); // Initial draw
    }
}

// Register the new custom element with the browser
customElements.define('linear-transformation', LinearTransformation);
