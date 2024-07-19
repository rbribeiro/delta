class ProgressBar extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const barContainer = document.createElement('div');
        const bar = document.createElement('div');

        barContainer.style.left = '0'
        barContainer.style.top = '0'
        barContainer.style.position = 'fixed'
        barContainer.style.width = '100vw';
        barContainer.style.height = '5px';
        barContainer.style.backgroundColor = '#e0e0e0';
        barContainer.style.border = '2px'

        bar.style.width = '0';
        bar.style.height = '100%';
        bar.style.backgroundColor = '#76c7c0';
        bar.style.transition = 'width 0.5s';

        barContainer.appendChild(bar);
        shadow.appendChild(barContainer);
        

        this.bar = bar;
       
    }

    connectedCallback() {
        // Listen for the custom event
        document.addEventListener('appStateChange', this.handleCustomEvent.bind(this));
    }

    handleCustomEvent(event) {
        console.log('Custom event received:', event.detail);
        console.log(this)
        this.bar.style.width = `${100*event.detail.currentSlide/event.detail.totalSlides}%`
    }

    updateProgress(current,total) {
        const progress = (current / total) * 100;
        this.innerHTML = `${progress}%`;
    }
}

customElements.define('progress-bar', ProgressBar);
