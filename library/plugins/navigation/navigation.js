navigation  = {}

navigation.init = function() {
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") {
          Delta.stepForward();
        } else if (e.key === "ArrowLeft") {
          Delta.stepBack();
        }
      });
}

document.addEventListener('deltaIsReady', () => {
    navigation.init()
})