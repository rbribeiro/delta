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
    }

    connectedCallback() {
        const title = this.getAttribute('data-title') || '';
        const number = this.getAttribute('data-number') || '';
        const level = this.getAttribute('data-level')
        const originalContent = this.innerHTML;
        this.innerHTML = "";

        const wrapper = document.createElement("div");
        wrapper.classList.add("step-wrapper");

        const trigger = document.createElement("button");
        trigger.classList.add("step-trigger");

        const stepTitle = document.createElement("span");
        stepTitle.classList.add("step-title");
        stepTitle.textContent = number ? `Step ${number}.` : "Step.";


        const stepSummary = document.createElement("span");
        stepSummary.classList.add("step-summary");
        stepSummary.textContent = title;

        if(level) {
        const levelTag = document.createElement("span")
        const leveltextTag = document.createElement("span")
        leveltextTag.textContent = level
        leveltextTag.classList.add("level-text")
        levelTag.append(leveltextTag)
        levelTag.classList.add("level-tag")
        levelTag.classList.add(`level-${level}`)
        stepSummary.append(levelTag)
        stepSummary.classList.add("with-level")
    }

        trigger.append(stepTitle, stepSummary);

        const stepContent = document.createElement("div");
        stepContent.classList.add("step-content");

        const stepContentInner = document.createElement("div");
        stepContentInner.classList.add("step-content-inner");
        stepContentInner.innerHTML = originalContent;

        stepContent.append(stepContentInner);

        wrapper.append(trigger, stepContent);
        this.append(wrapper);

        trigger.addEventListener("click", () => wrapper.classList.toggle("open"));
    }

}
customElements.define('delta-step', DeltaStep)


console.log('Base elements loaded (theorem, note)')

class DeltaNote extends HTMLElement {
    constructor() {
        super();
    }
}
customElements.define('delta-note', DeltaNote)

class DeltaRemark extends HTMLElement {
    constructor() {
        super();
    }
}
customElements.define('delta-remark', DeltaRemark)
