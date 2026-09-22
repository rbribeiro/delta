// Pacote da página inicial do site (site/index.dlt). Dois elementos, sem estado e
// sem rede, inlinados no HTML como qualquer pacote (docs/AUTHORING_PACKAGES.md).
//
//   <go to="comecar.html" class="btn primary">Começar</go>
//     Um link comum, na mesma aba. As tags do Delta não servem para a navegação de um
//     site: <link> abre sempre em aba nova, com ícone de link externo (certo para um
//     site de terceiros), e <ref> abre primeiro a prévia do alvo. A classe do autor
//     passa para o <a>, para que `.btn` estilize o link e não a tag inerte.
//
//   <h level="1">Título</h>
//     Um <h1>/<h2>/<h3> de verdade. Fora de uma <section>, o Delta não gera título
//     nenhum, e uma página inicial precisa de um h1 e de títulos reais nas faixas,
//     para leitores de tela e para o esboço do documento.
//
// O compilador renomeia <go> para <delta-go> e <h> para <delta-h>; o pacote registra
// esses nomes. `data-delta-ready` evita reprocessar um elemento movido no DOM.
customElements.define(
  "delta-go",
  class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.deltaReady) return;
      this.dataset.deltaReady = "1";
      const to = this.getAttribute("to");
      if (!to) return;
      const a = document.createElement("a");
      a.href = to;
      if (this.className) {
        a.className = this.className;
        this.removeAttribute("class");
      }
      while (this.firstChild) a.appendChild(this.firstChild);
      this.appendChild(a);
    }
  },
);

customElements.define(
  "delta-h",
  class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.deltaReady) return;
      this.dataset.deltaReady = "1";
      const level = Math.min(6, Math.max(1, Number(this.getAttribute("level")) || 2));
      const heading = document.createElement(`h${level}`);
      if (this.className) {
        heading.className = this.className;
        this.removeAttribute("class");
      }
      while (this.firstChild) heading.appendChild(this.firstChild);
      this.appendChild(heading);
    }
  },
);
