// Pacote de demonstração da página "Animações" (site/animacoes.dlt). Uma tag:
//
//   <parabola a="1" b="0"/>
//     Desenha a parábola y = (x − a)² + b, com o vértice marcado.
//
// Ele existe para mostrar o protocolo dos parâmetros animados, que é só este: o elemento
// declara em observedAttributes os atributos de que o desenho depende e se redesenha
// quando um deles muda. Um <set target="…" a="2"/> numa animação escreve o atributo
// quadro a quadro, e o elemento acompanha. Nenhuma API do Delta é usada.
//
// O código abaixo deste cabeçalho aparece na íntegra em site/animacoes.dlt: mantenha os
// dois iguais. O compilador renomeia <parabola> para <delta-parabola>; é esse nome que o
// pacote registra. Sem rede, sem globais além do elemento.
customElements.define(
  "delta-parabola",
  class extends HTMLElement {
    // Os parâmetros: mudar um deles redesenha.
    static get observedAttributes() {
      return ["a", "b"];
    }
    connectedCallback() {
      this.draw();
    }
    attributeChangedCallback() {
      this.draw();
    }

    draw() {
      const a = Number(this.getAttribute("a")) || 0;
      const b = Number(this.getAttribute("b")) || 0;
      // A janela vai de −4 a 4 em x e de −1 a 5 em y, a 40 unidades do SVG por unidade.
      const X = (x) => ((x + 4) * 40).toFixed(1);
      const Y = (y) => ((5 - y) * 40).toFixed(1);
      let curve = "";
      for (let x = -4; x <= 4.001; x += 0.1) {
        curve += `${curve ? "L" : "M"}${X(x)} ${Y((x - a) ** 2 + b)}`;
      }
      this.innerHTML = `<svg viewBox="0 0 320 240" role="img" aria-label="y = (x − a)² + b">
        <path class="parabola-axis" d="M0 ${Y(0)}H320M${X(0)} 0V240"/>
        <path class="parabola-curve" d="${curve}"/>
        <circle class="parabola-vertex" cx="${X(a)}" cy="${Y(b)}" r="4"/>
        <text class="parabola-value" x="8" y="20">a = ${a.toFixed(2)}, b = ${b.toFixed(2)}</text>
      </svg>`;
    }
  },
);
