// Pacote de demonstração da página "API do runtime" (site/api.dlt). Uma tag:
//
//   <termo def="…">palavra</termo>
//     A palavra ganha um sublinhado pontilhado; um clique (ou Enter) abre um balão
//     com a definição, pelo Delta.popover que o runtime expõe em window.Delta.
//
// O código abaixo deste cabeçalho aparece na íntegra em site/api.dlt: mantenha os
// dois iguais. O compilador renomeia <termo> para <delta-termo>; é esse nome que
// o pacote registra. Sem rede, sem globais além do elemento.
customElements.define(
  "delta-termo",
  class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.deltaReady) return; // pode disparar de novo se o nó for movido
      this.dataset.deltaReady = "1";
      const def = this.getAttribute("def");
      if (!def) return;
      this.tabIndex = 0; // alcançável pelo teclado
      this.setAttribute("role", "button");

      // O balão. Delta.popover o move para o <body>: estilize-o pela classe.
      const card = document.createElement("div");
      card.className = "termo-pop";

      const pop = Delta.popover(this, card, {
        onOpen: (content) => {
          if (content.childElementCount) return; // monta uma vez, na primeira abertura
          const label = document.createElement("span");
          label.className = "termo-pop-label";
          label.textContent = Delta.t("termo", "Definição");
          const term = document.createElement("strong");
          term.textContent = this.textContent;
          const text = document.createElement("p");
          text.textContent = def;
          content.append(label, term, text);
        },
      });

      // Enter ou espaço abrem e fecham, como o clique.
      this.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pop.toggle();
        }
      });
    }
  },
);
