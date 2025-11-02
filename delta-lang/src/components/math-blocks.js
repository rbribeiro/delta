class DeltaBlock extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {

    const title = this.getAttribute("data-title") || null
    const level = this.getAttribute("data-level") || null
    const type = this.getAttribute("data-type") || null

    const blockHeader = document.createElement("div")
    blockHeader.textContent = title ? `${type} (${title}).` : `${type}.`
    blockHeader.classList.add("block-header")

    if (level) {
      blockHeader.classList.add("with-level")
      const levelTag = document.createElement("span")
      const leveltextTag = document.createElement("span")
      leveltextTag.textContent = level
      leveltextTag.classList.add("level-text")
      levelTag.append(leveltextTag)
      levelTag.classList.add("level-tag")
      levelTag.classList.add(`level-${level}`)
      blockHeader.append(levelTag)
    }


    this.prepend(blockHeader)
  }
}

class DeltaTheorem extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-theorem",DeltaTheorem)

class DeltaExercise extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-exercise",DeltaExercise)


class DeltaLemma extends DeltaBlock {
  constructor() {
    super()
  }
}


customElements.define("delta-lemma",DeltaLemma)



class DeltaDefinition extends DeltaBlock {
  constructor() {
    super()
  }
}


customElements.define("delta-definition",DeltaDefinition)


class DeltaProof extends DeltaBlock {
  constructor() {
    super()
  }

  connectedCallback() {
      super.connectedCallback()
      const steps = this.querySelectorAll("delta-step")

      steps.forEach((step,idx) => {
      if (!step.hasAttribute("data-number")) step.setAttribute("data-number", idx + 1)
    })
  }

  
}

customElements.define("delta-proof", DeltaProof)

class DeltaExample extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-example", DeltaExample)

class DeltaCorollary extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-corollary", DeltaCorollary)
