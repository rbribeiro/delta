class DeltaHint extends HTMLElement {
    constructor() {
        super()
        this.isVisible = false
    }
    connectedCallback() {
        const content = this.innerHTML
        this.innerHTML = `
            <div class="hint">
                <div class="hint-lamp"></div>
                <div class="hint-content">${content}</div>
            </div>
        `
        
        const lamp = this.querySelector('.hint-lamp')
        const hintContent = this.querySelector('.hint-content')
        
        lamp.addEventListener('click', () => {
            this.isVisible = !this.isVisible
            const hintContainer = this.querySelector('.hint')
            if (this.isVisible) {
                hintContent.style.display = 'block'
                setTimeout(() => hintContent.classList.add('visible'), 10)
                hintContainer.classList.add('open')
            } else {
                hintContent.classList.remove('visible')
                setTimeout(() => hintContent.style.display = 'none', 300)
                hintContainer.classList.remove('open')
            }
        })
    }
}
customElements.define("delta-hint",DeltaHint)

class DeltaStep extends HTMLElement {
    constructor() {
        super();
        this.bodyIsVisible = false;
    }

    connectedCallback() {
        const title = this.getAttribute('data-title') || ''
        const level = this.getAttribute("data-level") || null
        const originalContent = this.innerHTML
        this.innerHTML = ""
        const stepContent = document.createElement("div")
        stepContent.classList.add("step-content")

        const stepTimelineDot = document.createElement("div")
        stepTimelineDot.classList.add("step-timeline-dot")
        stepTimelineDot.textContent = "+"

        const stepTitle = document.createElement("div")
        stepTitle.classList.add("step-title")
        stepTitle.textContent = title

        if (level) {
            stepTitle.classList.add("with-level")
            const levelTag = document.createElement("span")
            levelTag.textContent = level
            levelTag.classList.add("level-tag")
            levelTag.classList.add(`level-${level}`)
            stepTitle.append(levelTag)
        }

        const stepBody = document.createElement("div")
        stepBody.classList.add("step-body")
        stepBody.style.display = 'none';
        stepBody.innerHTML = originalContent
        
        this.append(stepContent)
        stepContent.append(stepTimelineDot, stepTitle, stepBody)
        stepTimelineDot.addEventListener("click", () => {this.toggleBody(stepTimelineDot, stepBody)})
        stepTitle.addEventListener("click", () => this.toggleBody(stepTimelineDot, stepBody))
        
    }

    toggleBody(toggle,stepBody) {
        this.bodyIsVisible = !this.bodyIsVisible
        stepBody.style.display = this.bodyIsVisible ? "block" : "none"
        toggle.textContent = this.bodyIsVisible ? "-" : "+"

    }
}
customElements.define('delta-step', DeltaStep)


console.log('Base elements loaded (theorem, note)')
