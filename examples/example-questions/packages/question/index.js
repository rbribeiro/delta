/*
Esse componente funciona a partir da definição de um bloco de quiz:

    <question timed="true" number="1" title="Derivadas Básicas" start-text="Iniciar Questão">
      Qual a derivada de $x^2$?
      <option>$x$</option>
      <option correct="true">$2x$</option>
    </question>

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

                // parar o cronômetro, caso a questão tenha um
                if (typeof parentBlock.stopTimer === 'function'){
                    parentBlock.stopTimer();
                }
            }});
        }
    }
);

customElements.define(
    'delta-question',
    class extends HTMLElement {
        connectedCallback() {
            if (this.hasAttribute('initialized')) return;
            this.setAttribute('initialized', 'true');

            const isTimed = this.getAttribute('timed') === 'true'; // definir se o timer será usado
            const qNumber = this.getAttribute('number'); // identificador da questão

            const customStartText = this.getAttribute('start-text') || 'Iniciar Questão';

            const titleNode = this.querySelector(':scope > delta-title');

            const boxElement = document.createElement('div');
            boxElement.className = 'box delta-question-box';

            // Cria o cabeçalho com número, título ou cronômetro se forem definidos pelo usuário
            if (qNumber || qTitle || isTimed) {
                const header = document.createElement('div');
                header.className = 'delta-question-header';

                if (qNumber || titleNode) {
                    const tagElement = document.createElement('div');
                    tagElement.className = 'box-tag';

                    // Se tiver número, adiciona no tagElement
                    if (qNumber) {
                        tagElement.append(document.createTextNode(`${qNumber} `));
                    }

                    if (titleNode) {
                        const titleSpan = document.createElement('span');
                        titleSpan.className = 'box-tag-title';

                        titleSpan.append(...titleNode.childNodes);
                        titleNode.remove();
                        
                        tagElement.append(titleSpan);
                    }
                    header.appendChild(tagElement);
                }

                if (isTimed) {
                    this.timeDisplay = document.createElement('div');
                    this.timeDisplay.className = 'delta-timer-display';
                    this.timeDisplay.style.display = 'none'; // Escondido até iniciar
                    this.timeDisplay.textContent = '⏱ 00:00';
                    header.appendChild(this.timeDisplay);
                }

                boxElement.appendChild(header);
            }

            const contentContainer = document.createElement('div');
            contentContainer.className = 'delta-question-content';

            if (isTimed) {
                const innerContent = document.createElement('div');
                innerContent.style.display = 'none';

                while (this.firstChild) {
                    innerContent.appendChild(this.firstChild);
                }

                this.startButton = document.createElement('button');
                this.startButton.textContent = customStartText; // Usa o texto customizado
                this.startButton.className = 'delta-start-btn'; // botão para iniciar a questão
                
                contentContainer.appendChild(this.startButton);
                contentContainer.appendChild(innerContent);

                this.startButton.addEventListener('click', () => {
                    this.startButton.style.display = 'none';
                    if (this.timeDisplay) {
                        this.timeDisplay.style.display = 'block';
                    }
                    innerContent.style.display = 'block';

                    // cronometrando o tempo:
                    this.startTime = Date.now();
                    this.timerInterval = setInterval(() => {
                        this.updateTimerDisplay();
                    }, 1000);
                });
            } else {
                while (this.firstChild) {
                    contentContainer.appendChild(this.firstChild);
                }
            }
            boxElement.appendChild(contentContainer);
            this.appendChild(boxElement);
        }

        disconnectedCallback() {
            this.stopTimer();
        }

        updateTimerDisplay() {
            if (!this.startTime) return;
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const seconds = String(elapsed % 60).padStart(2, '0');
            if (this.timeDisplay) {
                this.timeDisplay.textContent = `⏱ ${minutes}:${seconds}`;
            }
        }

        stopTimer() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }
    }
);

customElements.define(
    'delta-question-group',
    class extends HTMLElement {
        connectedCallback() {
            if (this.dataset.deltaReady) return;
            this.dataset.deltaReady = "1";

            const titleNode = this.querySelector(':scope > delta-title');
            const titleAttr = this.getAttribute('title');

            const isTimed = this.getAttribute('timed') !== 'false'; // por padrão o timer é sempre ativado
            
            const header = document.createElement('div');
            header.className = 'delta-question-group-header';

            const titleElement = document.createElement('h2');
            titleElement.className = 'delta-question-group-title';

            if (titleNode) {
                titleElement.append(...titleNode.childNodes);
                titleNode.remove();
            } else if (titleAttr) {
                titleElement.textContent = titleAttr;
            } else {
                titleElement.textContent = 'Questionário';
            }
            header.appendChild(titleElement);

            if (isTimed) {
                this.globalTimeDisplay = document.createElement('div');
                this.globalTimeDisplay.className = 'delta-timer-display global-timer';
                this.globalTimeDisplay.textContent = '⏱ Tempo Total: 00:00';
                header.appendChild(this.globalTimeDisplay);
            }
            
            const contentContainer = document.createElement('div');
            contentContainer.className = 'delta-question-group-content';
            while (this.firstChild) {
                contentContainer.appendChild(this.firstChild);
            }

            this.appendChild(header);
            this.appendChild(contentContainer);

            this.startTime = null;
            this.timerInterval = null;
            this.isCompleted = false;

            this.addEventListener('click', () => {
                if (isTimed && !this.startTime && !this.isCompleted) {
                    this.startTime = Date.now();
                    this.timerInterval = setInterval(() => this.updateGlobalTimer(), 1000);
                }

                setTimeout(() => {
                    this.checkCompletion(isTimed);
                }, 50);
            });
        }
        
        updateGlobalTimer() {
            if (!this.startTime || this.isCompleted || !this.globalTimeDisplay) return; // se o isTimed for falso
            
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const seconds = String(elapsed % 60).padStart(2, '0');
            this.globalTimeDisplay.textContent = `⏱ Tempo Total: ${minutes}:${seconds}`;
        }

        checkCompletion(isTimed) {
            if (this.isCompleted) return;

            const totalQuestions = this.querySelectorAll('delta-question').length;
            const answeredQuestions = this.querySelectorAll('delta-question[answered="true"]').length;

            if (totalQuestions > 0 && totalQuestions === answeredQuestions) {
                this.isCompleted = true; 
                
                // finaliza o relógio se ele existir:
                if (isTimed) {
                    if (this.timerInterval) clearInterval(this.timerInterval);
                    this.globalTimeDisplay.classList.add('completed');
                    this.updateGlobalTimer(); 
                }
            }
        }
    }
);
