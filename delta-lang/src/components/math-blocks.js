// Exemplo feito em sala
class DeltaExercise extends DeltaMathBlock {
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


