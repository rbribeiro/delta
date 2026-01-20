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

class DeltaQuote extends HTMLElement {
  constructor() {
    super()
  }

   connectedCallback() {
    const initialContent = this.innerHTML
    const contentWrapper = document.createElement("div")
    contentWrapper.classList.add("delta-quote-content")

    let quoteColor = this.getAttribute("data-quote-color")
    if (quoteColor) {
      if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(quoteColor)) {
        quoteColor = quoteColor
      } else {
        quoteColor = `var(--dft-${quoteColor})`
      }
    }


    const openQuote = document.createElement("span")
    openQuote.classList.add("delta-quote-mark", "delta-quote-open")
    openQuote.textContent = "“"

    const bodyWrapper = document.createElement("div")
    bodyWrapper.classList.add("delta-quote-body")
    bodyWrapper.innerHTML = initialContent

    const closeQuote = document.createElement("span")
    closeQuote.classList.add("delta-quote-mark", "delta-quote-close")
    closeQuote.textContent = "”"

    contentWrapper.appendChild(openQuote)
    contentWrapper.appendChild(bodyWrapper)
    contentWrapper.appendChild(closeQuote)

    this.innerHTML = ""
    const author = this.getAttribute("data-author")
    if(author) {
      const authorWrapper = document.createElement("div")
      authorWrapper.classList.add("delta-quote-author")
      authorWrapper.textContent = author
      this.append(authorWrapper)
    }
    if(quoteColor) {
      openQuote.style.color = quoteColor
      closeQuote.style.color = quoteColor

    }
    this.prepend(contentWrapper)
  }

}

customElements.define("delta-quote", DeltaQuote)

class DeltaCase extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        const title = this.getAttribute('data-title') || '';
        const number = this.getAttribute('data-number') || '';
        const level = this.getAttribute('data-level');
        const originalContent = this.innerHTML;
        this.innerHTML = "";

        const wrapper = document.createElement("div");
        wrapper.classList.add("case-wrapper");

        const trigger = document.createElement("button");
        trigger.classList.add("case-trigger");

        const caseTitle = document.createElement("span");
        caseTitle.classList.add("case-title");
        caseTitle.textContent = number ? `Case ${number}.` : "Case.";

        const caseSummary = document.createElement("span");
        caseSummary.classList.add("case-summary");
        caseSummary.textContent = title;

        if (level) {
            const levelTag = document.createElement("span");
            const leveltextTag = document.createElement("span");
            leveltextTag.textContent = level;
            leveltextTag.classList.add("level-text");
            levelTag.append(leveltextTag);
            levelTag.classList.add("level-tag");
            levelTag.classList.add(`level-${level}`);
            caseSummary.append(levelTag);
            caseSummary.classList.add("with-level");
        }

        trigger.append(caseTitle, caseSummary);

        const caseContent = document.createElement("div");
        caseContent.classList.add("case-content");

        const caseContentInner = document.createElement("div");
        caseContentInner.classList.add("case-content-inner");
        caseContentInner.innerHTML = originalContent;

        caseContent.append(caseContentInner);

        wrapper.append(trigger, caseContent);
        this.append(wrapper);

        trigger.addEventListener("click", () => wrapper.classList.toggle("open"));
    }
}

customElements.define('delta-case', DeltaCase);