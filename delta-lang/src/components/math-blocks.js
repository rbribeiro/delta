// Exemplo feito em sala
class DeltaExercise extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {
    const title = this.getAttribute("data-title") || null
    const level = this.getAttribute("level") || null

    const blockHeader = document.createElement("div")
    blockHeader.textContent = title ? `Exercise. "${title}"` : "Exercise."
    blockHeader.classList.add("block-header")

    if (level) {
      const levelTag = document.createElement("span")
      levelTag.textContent = level
      levelTag.classList.add("level-tag")
      levelTag.classList.add(`level-${level}`)
      blockHeader.append(levelTag)
    }


    this.prepend(blockHeader)
  }


} 

customElements.define("delta-exercise", DeltaExercise)


class DeltaTheorem extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {
    const title = this.getAttribute("data-title") || null
    const difficulty = this.getAttribute("difficulty") || null

    const blockHeader = document.createElement("div")
    blockHeader.textContent = title ? `Theorem (${title}).` : "Theorem."
    blockHeader.classList.add("block-header")

    if (difficulty) {
      blockHeader.classList.add("with-difficulty")
      const difficultyTag = document.createElement("span")
      difficultyTag.textContent = difficulty
      difficultyTag.classList.add("difficulty-tag")
      difficultyTag.classList.add(`difficulty-${difficulty}`)
      blockHeader.append(difficultyTag)
    }


    this.prepend(blockHeader)
  }


} 

customElements.define("delta-theorem", DeltaTheorem)

class DeltaDefinition extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {
    const title = this.getAttribute("data-title") || null

    const blockHeader = document.createElement("div")
    blockHeader.textContent = title ? `Definition (${title}).` : "Definition."
    blockHeader.classList.add("block-header")

    this.prepend(blockHeader)
  }
}

customElements.define("delta-definition", DeltaDefinition)

class DeltaLemma extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {
    const title = this.getAttribute("data-title") || null

    const blockHeader = document.createElement("div")
    blockHeader.textContent = title ? `Lemma (${title}).` : "Lemma."
    blockHeader.classList.add("block-header")

    this.prepend(blockHeader)
  }
}

customElements.define("delta-lemma", DeltaLemma)

class DeltaProposition extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {
    const title = this.getAttribute("data-title") || null

    const blockHeader = document.createElement("div")
    blockHeader.textContent = title ? `Proposition (${title}).` : "Proposition."
    blockHeader.classList.add("block-header")

    this.prepend(blockHeader)
  }
}

customElements.define("delta-proposition", DeltaProposition)