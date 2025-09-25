const page_head = `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Análise Real</title>
<link href="style/impatech_colors.css" rel="stylesheet">
<link href="style/essential.css" rel="stylesheet">
`;

const page_body = `
<nav>
</nav>
`;

function loadMathJax() {
  const mathjaxScript = document.createElement("script");
  mathjaxScript.id = "MathJax-script";
  mathjaxScript.src = "https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-chtml.js";
  mathjaxScript.onload = () => {
    if (window.MathJax) {
      MathJax.typesetPromise().catch((err) => console.error(err));
    } else {
      console.error("MathJax didn't load");
    }
  };
  document.head.appendChild(mathjaxScript);
}

function loadScripts() {
  const components = ["table_of_contents", "ref_box"];
  const scripts = ["dynamic_content", "interaction"];

  const componentsPath = components.map((el) => `script/components/${el}.js`);
  const scriptsPath = scripts.map((el) => `script/${el}.js`);
  const page_scripts = [...componentsPath, ...scriptsPath];

  page_scripts.forEach((src) => {
    const script = document.createElement("script");
    script.src = src;
    document.body.appendChild(script);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  document.head.innerHTML = page_head;

  const main = document.querySelector("main");
  document.body.innerHTML = page_body;
  document.body.appendChild(main);

  loadScripts();
  loadMathJax();
});
