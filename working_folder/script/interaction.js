function configureRefInteraction() {
  document.querySelectorAll("ref").forEach((ref) => {
    ref.onclick = () => {
      refId = ref.getAttribute("ref-id");
      const refBox = document.createElement("ref-box");
      refBox.setAttribute("ref-id", refId);
      document.body.appendChild(refBox);
    };
  });
}

configureRefInteraction();