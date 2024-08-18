class QuizOption extends HTMLElement {
  constructor() {
    super();
    this.render();
  }

  render() {
    const type = this.getAttribute("type") || "radio";
    const input = document.createElement("input");
    input.type = type;
    const label = document.createElement("label");
    label.innerHTML = this.innerHTML;
    label.prepend(input);

    this.correct = this.hasAttribute("correct");
    if (this.correct) input.setAttribute("correct", this.correct);
    this.replaceWith(label);
  }
}

class QuizQuestion extends HTMLElement {
  constructor() {
    super();
    this.classList.add("interactive-question");
    this.render();
  }
  render() {
    const name = this.getAttribute("name") || Math.random().toString();
    const title = this.querySelector("title")
      ? this.querySelector("title").textContent
      : "";
    const content = this.querySelector("content")
      ? this.querySelector("content").innerHTML
      : "";

    const wrapper = document.createElement("div");
    const titleElement = document.createElement("h2");
    titleElement.classList.add("question-title");
    titleElement.textContent = title;

    const contentElement = document.createElement("p");
    contentElement.innerHTML = content;

    const form = document.createElement("form");
    form.setAttribute("name", name);

    this.querySelectorAll("question-option, label").forEach((option) => {
      option.firstChild.setAttribute("name", name);
      option.classList.add("option");
      form.appendChild(option.cloneNode(true));
    });

    const checkButton = document.createElement("button");
    checkButton.classList.add("question-check-answer");
    checkButton.innerHTML = "Check Answer";
    checkButton.addEventListener("click", () => this.checkAnswer(form));

    const controlsWrapper = document.createElement("div");
    controlsWrapper.classList.add("controls-wrapper");
    controlsWrapper.appendChild(checkButton);

    this.innerHTML = "";
    wrapper.appendChild(titleElement);
    wrapper.appendChild(contentElement);
    wrapper.appendChild(form);
    wrapper.appendChild(controlsWrapper);
    this.append(wrapper);
  }

  checkAnswer(form) {
    let score = 0;
    const options = form.querySelectorAll(
      "input[type='radio'], input[type='checkbox']",
    );
    options.forEach((option) => {
      if (option.hasAttribute("correct") && option.checked) {
        score++;
      }
    });
    window.alert(`Your score is ${score}`);
  }
}

Delta.getInstance().eventDispatcher.on("deltaIsReady", () => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./library/plugins/quiz/quiz.css";
  document.head.appendChild(link);

  customElements.define("question-option", QuizOption);
  customElements.define("interactive-question", QuizQuestion);
});
