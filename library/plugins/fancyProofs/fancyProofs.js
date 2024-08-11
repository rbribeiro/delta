class ProofSteps extends HTMLElement {
  constructor() {
    super();
    const fancyStyles = document.createElement("link");
    fancyStyles.href = "./library/plugins/fancyProofs/fancyProofs.css";
    fancyStyles.rel = "stylesheet";
    document.head.append(fancyStyles);
  }

  connectedCallback() {
    const paragraphs = this.querySelectorAll("p") || [];
    paragraphs.forEach((p) => {
      const isExpanded = !p.hasAttribute("contracted");
      const buttonDiv = document.createElement("div");
      buttonDiv.classList.add("fancy-proofs-button-div");

      const button = document.createElement("button");
      button.classList.add("fancy-proofs-toggle-step");
      buttonDiv.append(button);

      const contentDiv = document.createElement("div");
      contentDiv.style.overflow = "hidden";
      contentDiv.style.transition = "max-height 0.5s ease-out";
      contentDiv.innerHTML = p.innerHTML;

      // Check if the 'contracted' attribute is present
      if (isExpanded) {
        contentDiv.style.maxHeight = "100%";
        button.innerHTML = "-";
      } else {
        contentDiv.style.maxHeight = "0";
        button.innerHTML = "+";
      }

      p.innerHTML = "";
      p.append(contentDiv);
      p.append(buttonDiv);

      button.addEventListener("click", () => {
        if (!p.hasAttribute("contracted")) {
          contentDiv.style.maxHeight = "0";
          button.innerHTML = "+";
          p.setAttribute("contracted", true);
        } else {
          contentDiv.style.maxHeight = contentDiv.scrollHeight + "px";
          button.innerHTML = "-";
          p.removeAttribute("contracted");
        }
      });
    });
  }
}

Delta.getInstance().eventDispatcher.on("deltaIsReady", () => {
  customElements.define("step-proof", ProofSteps);
});
