const summary = document.getElementById("summary");

function generateNavSummary(el, parentIdx) {
  const children = el.querySelectorAll(":scope > *");

  let currentIdx = 1;
  for (const child of children) {
    let idx = parentIdx;
    if (child.tagName == "DLT-SECTION") {
      const title = child.getAttribute("title");
      const li = document.createElement("li");
      idx += "." + currentIdx.toString();
      // idx logic is wrong because of the dlt-page structure --> rethink structure
      // li.innerHTML = idx + " " + title; 
      li.innerHTML = title;
      summary.appendChild(li);
      currentIdx++;
    }
    generateNavSummary(child, idx);
  }

}

window.addEventListener("DOMContentLoaded", () => {
    fetch("./content.html")
      .then(resp => resp.text())
      .then(html => {
        const content = document.getElementById("main-content");
        content.innerHTML = html;

        generateNavSummary(content, 1);
      })
      .catch(err => console.error("Erro ao carregar conteúdo:", err));
  });


const btn = document.getElementById("nav-bar-icon")

btn.addEventListener("click", () => {
  const nav = document.querySelector("nav");
  if (nav.style.display == "none") {
    nav.style.display = "flex";
  }
  else {
    nav.style.display = "none";
  }
});

