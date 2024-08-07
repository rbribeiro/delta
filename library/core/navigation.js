const nav = {};

nav.init = function () {
  document.addEventListener("keydown", (e) => {
    const currentSlide = deltaApp.state.currentSlide;
    const slide = document.querySelectorAll("slide")[currentSlide - 1];

    switch (e.key) {
      case "ArrowRight":
        const steps = slide.querySelectorAll(".step");
        if (steps.length > 0) {
          steps[0].classList.remove("step");
          steps[0].classList.add("activeStep");
        } else {
          deltaApp.goToSlide(currentSlide + 1);
        }
        break;
      case "ArrowLeft":
        const activeSteps = slide.querySelectorAll(".activeStep");
        if (activeSteps.length > 0) {
          activeSteps[activeSteps.length - 1].classList.remove("activeStep");
          activeSteps[activeSteps.length - 1].classList.add("step");
        } else {
          deltaApp.goToSlide(currentSlide - 1);
        }

      default:
        break;
    }
  });
};

deltaApp.eventDispatcher.on("deltaIsReady", nav.init);
