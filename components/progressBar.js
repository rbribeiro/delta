class ProgressBar extends HTMLElement {
  constructor() {
    super();
    const link = document.getElementsByTagName("link")[0].cloneNode();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.appendChild(link);

    const barContainer = document.createElement("div");
    barContainer.classList.add("pbContainer");

    const bar = document.createElement("div");
    bar.classList.add("pb");
    bar.style.width = "0";
    bar.style.height = "100%";

    barContainer.appendChild(bar);
    shadow.appendChild(barContainer);

    this.bar = bar;
  }

  connectedCallback() {
    // Listen for the custom event
    document.addEventListener(
      "appStateChange",
      this.handleCustomEvent.bind(this),
    );
  }

  handleCustomEvent(event) {
    this.bar.style.width = `${
      (100 * event.detail.currentSlide) / event.detail.totalSlides
    }%`;
  }

  updateProgress(current, total) {
    const progress = (current / total) * 100;
    this.innerHTML = `${progress}%`;
  }
}

customElements.define("progress-bar", ProgressBar);
