class DeltaBlock extends HTMLElement {
  constructor() {
    super()
  }

  connectedCallback() {

    const title = this.getAttribute("data-title") || null
    const level = this.getAttribute("data-level") || null
    const type = this.getAttribute("data-type") || null
    
    // MERGED: Keeping both attributes from the conflict
    const number = this.getAttribute("data-number") || null
    const align = this.getAttribute("data-align") || null

    const blockHeader = document.createElement("div")

    // Construct header with number
    let headerText = type || 'Block';

    // Capitalize type (optional, but looks nicer if type is lowercase)
    headerText = headerText.charAt(0).toUpperCase() + headerText.slice(1);

    if (number) {
      headerText += ` ${number}`
    }
    if (title) {
        headerText += ` (${title})`;
    }
        
    headerText += "."; // add the final dot

    blockHeader.textContent = headerText;
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

    // TO DO: Change text align based on 'data-align' value
    if (align) {
        this.style.textAlign = align;
    }

    this.prepend(blockHeader)
  }
}

class DeltaTheorem extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-theorem", DeltaTheorem)

class DeltaProposition extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-proposition", DeltaProposition)

class DeltaDefinition extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-definition", DeltaDefinition)

class DeltaConjecture extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-conjecture", DeltaConjecture)

class DeltaLemma extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-lemma", DeltaLemma)

class DeltaProof extends DeltaBlock {
  constructor() {
    super();
  }
  
  connectedCallback() {
    super.connectedCallback();

    const steps = this.querySelectorAll("delta-step");
    const cases = this.querySelectorAll("delta-case");
    
    steps.forEach((step, idx) => {
      if (!step.hasAttribute("data-number")) {
        step.setAttribute("data-number", idx + 1);
      }
    });

    cases.forEach((caseElem, idx) => {
      if (!caseElem.hasAttribute("data-number")) {
        caseElem.setAttribute("data-number", idx + 1);
      }
    });
  }
}

customElements.define("delta-proof", DeltaProof);

class DeltaCorollary extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-corollary", DeltaCorollary)

class DeltaProblem extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-problem", DeltaProblem)

class DeltaOpenProblem extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-open_problem", DeltaOpenProblem)

class DeltaExample extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-example", DeltaExample)

class DeltaExercise extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-exercise", DeltaExercise)

class DeltaAxiom extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-axiom", DeltaAxiom)

class DeltaPostulate extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-postulate", DeltaPostulate)

class DeltaHypothesis extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-hypothesis", DeltaHypothesis)

class DeltaFact extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-fact", DeltaFact)

class DeltaClaim extends DeltaBlock {
  constructor(){
    super()
  }
}

customElements.define("delta-claim", DeltaClaim)

class DeltaAssumption extends DeltaBlock {
  constructor(){
    super()
  }
}

customElements.define("delta-assumption", DeltaAssumption)

class DeltaSolution extends DeltaBlock {
  constructor() {
    super()
  }
}

customElements.define("delta-solution", DeltaSolution)

// TO DO: Algorithm