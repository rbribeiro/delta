// This file os made to deal with the collapsing of environments and sections/subsections. More generally, any element of the collapsible class

function configureCollapsibles() {
  const collapsibles = document.querySelectorAll(".collapsible");

  collapsibles.forEach((collapsibleEl) => {
    const title = collapsibleEl.querySelector("dlt-title");

    if (title) {
      title.addEventListener("click", () => {
        collapsibleEl.classList.toggle("is-collapsed");
      });
    }
  });
}

configureCollapsibles();