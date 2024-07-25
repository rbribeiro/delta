class slideCounter extends HTMLElement {
    constructor() {
        super()
        const total = Delta.state.totalSlides
        const current = Delta.state.currentSlide
        const content = `${current}/${total}`

        this.innerHTML = content
        
    }

    connectedCallback() {
        document.addEventListener("stateChange:currentSlide", (e) => {
            this.updateState(e.detail.currentSlide,e.detail.totalSlides)
        })
        document.addEventListener("stateChange:totalSlides", (e) => {
            this.updateState(e.detail.currentSlide,e.detail.totalSlides)
        })
    }

    updateState(current,total) {
        const content = `${current}/${total}`
        this.innerHTML = content
    }
}

customElements.define("slide-counter", slideCounter);
