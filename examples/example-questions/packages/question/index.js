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
            if (this.dataset.deltaReady) return;
            this.dataset.deltaReady = "1";

            this.addEventListener('click', () => {
                const parentBlock = this.closest('delta-question');
                if (parentBlock && parentBlock.hasAttribute('answered')) return;

                const isMultiple = parentBlock && parentBlock.getAttribute('multiple') === 'true';

                if (isMultiple) {
                    // Se for múltipla escolha, apenas alterna a classe 'selected'
                    this.classList.toggle('selected');
                } else {
                    // Lógica para questão de escolha única (avaliação instantânea da resposta)
                    // Verifica se o atributo 'correct' existe e é 'true'
                    const isCorrect = this.getAttribute('correct') === 'true';
                        if (isCorrect) {
                            this.classList.add('correct');
                        } else {
                            this.classList.add('wrong');
                            // Se errou, mostra qual era a correta automaticamente
                            const correctOption = parentBlock?.querySelector('delta-option[correct="true"]');
                            if (correctOption) correctOption.classList.add('correct');
                        }
                }
                // Marca a questão como respondida para bloquear novos cliques
                if (parentBlock && !isMultiple) {
                    parentBlock.setAttribute('answered', 'true');
                // parar o cronômetro, caso a questão tenha um
                if (typeof parentBlock.stopTimer === 'function'){
                    parentBlock.stopTimer();
                    }
                }
            });
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

            const isRandomized = this.getAttribute('randomize') === 'true'; // definir se as alternativas serão randomizadas
            
            const isMultiple = this.getAttribute('multiple') === 'true'; // definir se a questão é de múltipla escolha

            const customStartText = this.getAttribute('start-text') || 'Iniciar Questão';
            const titleNode = this.querySelector(':scope > delta-title');

            const boxElement = document.createElement('div');
            boxElement.className = 'box delta-question-box';

            // Cria o cabeçalho com número, título ou cronômetro se forem definidos pelo usuário
            if (qNumber || titleNode || isTimed) {
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

            const targetContainer = isTimed ? document.createElement('div') : contentContainer;
            if (isTimed) targetContainer.style.display = 'none';

            while (this.firstChild) {
                targetContainer.appendChild(this.firstChild);
            }

            if (isRandomized) {
                this.shuffleOptions(targetContainer);
            }

            // Se a questão for de múltipla escolha, adiciona o botão de confirmação
            if (isMultiple) {
                this.confirmButton = document.createElement('button');
                this.confirmButton.textContent = 'Confirmar Resposta';
                this.confirmButton.className = 'delta-confirm-btn';

                this.confirmButton.addEventListener('click', () => {
                    if (this.hasAttribute('answered')) return;

                    // Avalia todas as opções
                    const options = this.querySelectorAll('delta-option');
                    options.forEach(opt => {
                        const isSelected = opt.classList.contains('selected');
                        const isCorrectAttr = opt.getAttribute('correct') === 'true';

                        if (isCorrectAttr) {
                            opt.classList.add('correct'); // Destaca as corretas obrigatoriamente
                        }
                        if (isSelected && !isCorrectAttr) {
                            opt.classList.add('wrong'); // Destaca as erradas que o usuário selecionou
                        }
                    });

                    this.setAttribute('answered', 'true');
                    this.confirmButton.style.display = 'none'; // Esconde o botão ao finalizar
                    this.stopTimer();
                });

                // Adiciona o botão no final das opções
                targetContainer.appendChild(this.confirmButton);
            }

            if (isTimed) {
                this.startButton = document.createElement('button');
                this.startButton.textContent = customStartText;
                this.startButton.className = 'delta-start-btn';
                
                contentContainer.appendChild(this.startButton);
                contentContainer.appendChild(targetContainer);

                this.startButton.addEventListener('click', () => {
                    this.startButton.style.display = 'none';
                    if (this.timeDisplay) this.timeDisplay.style.display = 'block';
                    targetContainer.style.display = 'block';

                    this.startTime = Date.now();
                    this.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);
                });
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

        shuffleOptions(container) { 
            // Procura as opções apenas dentro do container da questão específica
            const options = Array.from(container.querySelectorAll('delta-option'));
            
            if (options.length > 0) {
                for (let i = options.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [options[i], options[j]] = [options[j], options[i]];
                }
            
                options.forEach(option => container.appendChild(option)); 
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
                
                // finaliza o cronômetro:
                if (isTimed) {
                    if (this.timerInterval) clearInterval(this.timerInterval);
                    this.globalTimeDisplay.classList.add('completed');
                    this.updateGlobalTimer(); 
                }
            }
        }
    }
);
