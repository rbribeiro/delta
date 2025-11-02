class DeltaGrid extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.renderGrid();
    }

    renderGrid() {
        const title = this.getAttribute('data-title') || '';
        const scale = this.getAttribute('data-scale') || '1x1';
        
        // Parse da escala
        const [rows, cols] = scale.split('x').map(Number);
        
        // Criar estrutura do grid mantendo os painéis originais
        const gridContent = document.createElement('div');
        gridContent.className = 'delta-grid-content';
        gridContent.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridContent.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        
        // Processar os painéis existentes
        this.processPanels(gridContent);
        
        // Limpar e reconstruir o grid
        this.innerHTML = '';
        if (title) {
            this.setAttribute('data-title', title);
        }
        this.appendChild(gridContent);
    }

    processPanels(gridContent) {
        const panels = Array.from(this.querySelectorAll('delta-panel'));
        const scale = this.getAttribute('data-scale') || '1x1';
        const [maxRows, maxCols] = scale.split('x').map(Number);
        
        const occupiedPositions = new Set();
        const placedPanels = new Set();
        
        // Primeiro processa os painéis com coordenadas específicas
        panels.forEach(panel => {
            const coord = panel.getAttribute('data-coord');
            if (coord) {
                const position = this.parseCoordinates(coord);
                if (position && this.isValidPosition(position, maxRows, maxCols)) {
                    const positionKey = `${position.row},${position.col}`;
                    if (!occupiedPositions.has(positionKey)) {
                        occupiedPositions.add(positionKey);
                        this.placePanel(panel, position, gridContent);
                        placedPanels.add(panel);
                    }
                }
            }
        });

        // Preencher posições restantes em ordem
        let currentRow = 1;
        let currentCol = 1;

        panels.forEach(panel => {
            if (!placedPanels.has(panel)) {
                // Encontrar próxima posição disponível
                while (occupiedPositions.has(`${currentRow},${currentCol}`)) {
                    currentCol++;
                    if (currentCol > maxCols) {
                        currentCol = 1;
                        currentRow++;
                        if (currentRow > maxRows) break;
                    }
                }

                if (currentRow <= maxRows && currentCol <= maxCols) {
                    const position = { row: currentRow, col: currentCol };
                    occupiedPositions.add(`${currentRow},${currentCol}`);
                    this.placePanel(panel, position, gridContent);
                    placedPanels.add(panel);

                    currentCol++;
                    if (currentCol > maxCols) {
                        currentCol = 1;
                        currentRow++;
                    }
                }
            }
        });
    }

    parseCoordinates(coord) {
        const matches = coord.match(/\(?(\d+),(\d+)\)?/);
        if (matches && matches.length === 3) {
            const row = parseInt(matches[1]);
            const col = parseInt(matches[2]);
            return { row, col };
        }
        return null;
    }

    isValidPosition(position, maxRows, maxCols) {
        return position.row >= 1 && position.row <= maxRows && 
               position.col >= 1 && position.col <= maxCols;
    }

    placePanel(panel, position, gridContent) {
        panel.style.gridRow = position.row;
        panel.style.gridColumn = position.col;
        gridContent.appendChild(panel);
    }
}

class DeltaPanel extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        // Garantir que os painéis tenham o comportamento consistente
        if (this.hasAttribute('simple')) {
            this.setAttribute('simple', '');
        }
    }
}

// Registrar os custom elements
customElements.define('delta-grid', DeltaGrid);
customElements.define('delta-panel', DeltaPanel);