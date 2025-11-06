class DeltaPage extends HTMLElement {
    constructor() {
        super();
    }
}

class DeltaComposition extends HTMLElement {
    constructor() {
        super();
        this.currentOrder = 1;
        this.items = [];
        this.maxOrder = 1;
    }

    connectedCallback() {
        this.collectItems();
        this.calculateMaxOrder();
        this.updateDisplay();
    }

    collectItems() {
        // Coleta todos os filhos diretos que são delta-page OU têm data-order
        this.items = Array.from(this.children).filter(child => 
            child.tagName === 'DELTA-PAGE' || child.hasAttribute('data-order')
        );
    }

    calculateMaxOrder() {
        const orders = this.items.map(item => {
            if (item.tagName === 'DELTA-PAGE') {
                return parseInt(item.getAttribute('data-order')) || 1;
            } else {
                return parseInt(item.getAttribute('data-order')) || 1;
            }
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
        this.items.forEach(item => {
            let itemOrder;
            
            if (item.tagName === 'DELTA-PAGE') {
                itemOrder = parseInt(item.getAttribute('data-order')) || 1;
            } else {
                itemOrder = parseInt(item.getAttribute('data-order')) || 1;
            }
            
            if (itemOrder <= this.currentOrder) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    }
}

class DeltaSlide extends HTMLElement {
    constructor() {
        super();
        this.currentIndex = 0;
        this.items = [];
    }

    connectedCallback() {
        this.collectItems();
        this.updateDisplay();
    }

    collectItems() {
        // Coleta todos os filhos diretos que são delta-page OU têm data-order
        this.items = Array.from(this.children).filter(child => 
            child.tagName === 'DELTA-PAGE' || child.hasAttribute('data-order')
        );
    }

    next() {
        if (this.currentIndex < this.items.length - 1) {
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
        this.items.forEach((item, index) => {
            item.classList.remove('active', 'prev');
            
            if (index === this.currentIndex) {
                item.classList.add('active');
            } else if (index < this.currentIndex) {
                item.classList.add('prev');
            }
        });
    }
}

// Registrar os custom elements
customElements.define('delta-page', DeltaPage);
customElements.define('delta-composition', DeltaComposition);
customElements.define('delta-slide', DeltaSlide);

// Sistema global de teclado
document.addEventListener('keydown', (event) => {
    const compositions = Array.from(document.querySelectorAll('delta-composition'));
    const slides = Array.from(document.querySelectorAll('delta-slide'));
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        compositions.forEach(comp => comp.next());
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        compositions.forEach(comp => comp.prev());
    }
    
    if (event.key === 'ArrowRight') {
        event.preventDefault();
        slides.forEach(slide => slide.next());
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        slides.forEach(slide => slide.prev());
    }
});