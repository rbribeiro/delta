class ProgressBar extends HTMLElement {
  constructor() {
    super();
    const barContainer = document.createElement("div");
    barContainer.classList.add("pb-container");

    const bar = document.createElement("div");
    bar.classList.add("pb");
    bar.style.width = "0";
    bar.style.height = "100%";

    barContainer.appendChild(bar);
    this.appendChild(barContainer);

    this.bar = bar;

    this.app = Delta.getInstance();
  }

  connectedCallback() {
    // Listen for change in the current slide or total slides
    this.app.eventDispatcher.on(
      "stateChange:currentSlide",
      this.handleStateChange.bind(this),
    );
    this.app.eventDispatcher.on(
      "stateChange:totalSlides",
      this.handleStateChange.bind(this),
    );
  }

  handleStateChange(e) {
    this.updateProgress(
      e.detail.currentState.currentSlide,
      e.detail.currentState.totalSlides,
    );
  }

  updateProgress(current, total) {
    this.bar.style.width = `${(100 * current) / total}%`;
  }
}

class SlideCounter extends HTMLElement {
  constructor() {
    super();
    const total = 0;
    const current = 0;
    const content = `${current}/${total}`;

    this.innerHTML = content;
    this.app = Delta.getInstance();
  }

  connectedCallback() {
    this.app.eventDispatcher.on("stateChange:currentSlide", (e) => {
      this.updateState(
        e.detail.currentState.currentSlide,
        e.detail.currentState.totalSlides,
      );
    });
    this.app.eventDispatcher.on("stateChange:totalSlides", (e) => {
      this.updateState(
        e.detail.currentState.currentSlide,
        e.detail.currentState.totalSlides,
      );
    });
  }

  updateState(current, total) {
    const content = `${current}/${total}`;
    this.innerHTML = content;
  }
}
