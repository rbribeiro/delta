/*
Esse componente funciona a partir da definição de um bloco de quiz:

    <quiz-block>
      Qual a derivada de $x^2$
      <quiz-option>$x$</quiz-option>
      <quiz-option correct="true">$2x$</quiz-option>
    </quiz-block>

As alternativas devem ser definidas e a alternativa correta ser apontada por:
correct="true"
*/


customElements.define(
    'delta-option',
    class extends HTMLElement {
        connectedCallback() {
            this.addEventListener('click', () => { // adicionar a iteratividade de clique para escolha de alternativa
            // Verifica se o atributo 'correct' existe e é 'true'
            const isCorrect = this.getAttribute('correct') === 'true';
            
            // Se o usuário já respondeu o formulário uma vez, não poderá clicar em uma nova alternativa
            const parentBlock = this.closest('delta-question');
            if (parentBlock && parentBlock.hasAttribute('answered')) return;

            if (isCorrect) {
                this.classList.add('correct');
            } else {
                this.classList.add('wrong');
                // Se errou, mostra qual era a correta automaticamente
                const correctOption = parentBlock?.querySelector('delta-option[correct="true"]');
                if (correctOption) correctOption.classList.add('correct');
            }
            // Marca a questão como respondida para bloquear novos cliques
            if (parentBlock) {
                parentBlock.setAttribute('answered', 'true');
            }});
        }
    }
);

customElements.define(
    'delta-question',
    class extends HTMLElement {}
);