class DeltaBlock extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {

    const title = this.getAttribute("data-title") || null
    const level = this.getAttribute("data-level") || null
    const type = this.getAttribute("data-type") || null

    const blockHeader = document.createElement("div")
    blockHeader.textContent = title ? `${type} (${title}).` : `${type}`
    blockHeader.classList.add("block-header")

    if (level) {
      blockHeader.classList.add("with-level")
      const levelTag = document.createElement("span")
      levelTag.textContent = level
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

  
}

customElements.define("delta-proof", DeltaProof)

