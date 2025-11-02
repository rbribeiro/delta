class DeltaPage extends HTMLElement {
    constructor() {
        super();
    }
}

class DeltaComposition extends HTMLElement {
    constructor() {
        super();
        this.currentOrder = 1;
        this.pages = [];
        this.maxOrder = 1;
    }

    connectedCallback() {
        // Só seleciona os filhos diretos
        this.pages = Array.from(this.children).filter(child => child.tagName === 'DELTA-PAGE');
        this.calculateMaxOrder();
        this.updateDisplay();
    }

    calculateMaxOrder() {
        const orders = this.pages.map(page => {
            const order = parseInt(page.getAttribute('data-order'));
            return isNaN(order) ? 1 : order;
        });
        this.maxOrder = Math.max(...orders);
    }

    next() {
        if (this.currentOrder < this.maxOrder) {
            this.currentOrder++;
            this.updateDisplay();
        }
    }

    prev() {
        if (this.currentOrder > 1) {
            this.currentOrder--;
            this.updateDisplay();
        }
    }

    updateDisplay() {
        this.pages.forEach(page => {
            const pageOrder = parseInt(page.getAttribute('data-order'));
            
            // Páginas com ordem <= currentOrder são visíveis
            // Páginas com ordem > currentOrder ficam ocultas mas mantêm o espaço
            if (pageOrder <= this.currentOrder) {
                page.classList.remove('hidden');
            } else {
                page.classList.add('hidden');
            }
        });
    }
}

class DeltaSlide extends HTMLElement {
    constructor() {
        super();
        this.currentIndex = 0;
        this.pages = [];
    }

    connectedCallback() {
        // Só seleciona os filhos diretos
        this.pages = Array.from(this.children).filter(child => child.tagName === 'DELTA-PAGE');
        this.updateDisplay();
    }

    next() {
        if (this.currentIndex < this.pages.length - 1) {
            this.currentIndex++;
            this.updateDisplay();
        }
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateDisplay();
        }
    }

    updateDisplay() {
        this.pages.forEach((page, index) => {
            page.classList.remove('active', 'prev');
            
            if (index === this.currentIndex) {
                page.classList.add('active');
            } else if (index < this.currentIndex) {
                page.classList.add('prev');
            }
        });
    }
}

// Registra os custom elements
customElements.define('delta-page', DeltaPage);
customElements.define('delta-composition', DeltaComposition);
customElements.define('delta-slide', DeltaSlide);

// Sistema global de teclado
document.addEventListener('keydown', (event) => {
    // Encontra todos os compositions e slides na página
    const compositions = Array.from(document.querySelectorAll('delta-composition'));
    const slides = Array.from(document.querySelectorAll('delta-slide'));
    
    // Teclas para Composition (setas para cima e para baixo)
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        // Avança todos os compositions
        compositions.forEach(comp => comp.next());
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        // Volta todos os compositions
        compositions.forEach(comp => comp.prev());
    }
    
    // Teclas para Slide (setas para esquerda e direita)
    if (event.key === 'ArrowRight') {
        event.preventDefault();
        // Avança todos os slides
        slides.forEach(slide => slide.next());
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        // Volta todos os slides
        slides.forEach(slide => slide.prev());
    }
});