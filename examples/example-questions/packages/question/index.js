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
                            // Salva que a questão foi respondida corretamente
                            if (parentBlock) parentBlock.dataset.correct = 'true';
                        } else {
                            this.classList.add('wrong');
                            // Salva que a questão foi respondida incorretamente
                            if (parentBlock) parentBlock.dataset.correct = 'false';
                            // Se errou, mostra qual era a correta automaticamente
                            const correctOption = parentBlock?.querySelector('delta-option[correct="true"]');
                            if (correctOption) correctOption.classList.add('correct');
                        }
                }
                // Marca a questão como respondida para bloquear novos cliques
                if (parentBlock && !isMultiple) {
                    parentBlock.setAttribute('answered', 'true');

                    // Chama a explicação assim que responder (escolha única)
                    if (typeof parentBlock.revealExplanation === 'function') {
                        parentBlock.revealExplanation();
                    }

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

            // Tipo de indexação (letters, numbers, roman). Padrão é letters (a, b, c).
            const indexType = this.getAttribute('index-type') || 'letters';

            const customStartText = this.getAttribute('start-text') || 'Iniciar Questão';
            const titleNode = this.querySelector(':scope > delta-title');

            // Captura a tag de explicação (se existir). O Delta converte <explanation> em <delta-explanation>
            const explanationNode = this.querySelector(':scope > delta-explanation');

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

            // Aplica os índices (A, B, C...) depois do shuffle
            this.applyIndexes(targetContainer, indexType);

            // Se a questão for de múltipla escolha, adiciona o botão de confirmação
            if (isMultiple) {
                this.confirmButton = document.createElement('button');
                this.confirmButton.textContent = 'Confirmar Resposta';
                this.confirmButton.className = 'delta-confirm-btn';

                this.confirmButton.addEventListener('click', () => {
                    if (this.hasAttribute('answered')) return;

                    let isPerfect = true; // Flag para verificar se todas as respostas estão corretas

                    // Avalia todas as opções
                    const options = this.querySelectorAll('delta-option');
                    options.forEach(opt => {
                        const isSelected = opt.classList.contains('selected');
                        const isCorrectAttr = opt.getAttribute('correct') === 'true';

                        if (isCorrectAttr) {
                            opt.classList.add('correct'); // Destaca as corretas obrigatoriamente
                            if (!isSelected) isPerfect = false; // Se uma correta não foi selecionada
                        }
                        if (isSelected && !isCorrectAttr) {
                            opt.classList.add('wrong'); // Destaca as erradas que o usuário selecionou
                            isPerfect = false; // Se selecionou uma errada
                        }
                    });

                    //Define o status final da questão de múltipla escolha
                    this.dataset.correct = isPerfect ? 'true' : 'false';

                    this.setAttribute('answered', 'true');
                    this.confirmButton.style.display = 'none'; // Esconde o botão ao finalizar

                    // Revela a explicação ao confirmar
                    this.revealExplanation();
                    this.stopTimer();
                });

                // Adiciona o botão no final das opções
                targetContainer.appendChild(this.confirmButton);
            }

            // Estrutura o toggle de explicação (escondido inicialmente)
            if (explanationNode) {
                this.explanationContainer = document.createElement('details');
                this.explanationContainer.className = 'delta-explanation';
                this.explanationContainer.style.display = 'none'; // Escondido até responder

                this.summaryElement = document.createElement('summary');
                this.summaryElement.textContent = 'Ver explicação'; // Texto temporário

                const explanationContent = document.createElement('div');
                explanationContent.className = 'delta-explanation-content';
                explanationContent.append(...explanationNode.childNodes);
                explanationNode.remove();

                this.explanationContainer.appendChild(this.summaryElement);
                this.explanationContainer.appendChild(explanationContent);
                targetContainer.appendChild(this.explanationContainer);
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

        // Adiciona a) b) c), 1) 2) 3) ou I) II) III) nas alternativas
        applyIndexes(container, indexType) {
            const options = Array.from(container.querySelectorAll('delta-option'));
            const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

            options.forEach((opt, idx) => {
                let label = '';
                if (indexType === 'numbers') {
                    label = (idx + 1).toString();
                } else if (indexType === 'roman') {
                    label = romanNumerals[idx] || (idx + 1).toString();
                } else {
                    label = String.fromCharCode(65 + idx); // Letras: A, B, C, D...
                }

                opt.dataset.indexLabel = label; // Salva para usar na explicação depois

                const indexSpan = document.createElement('span');
                indexSpan.className = 'delta-option-index';

                // Formatação: se for romano deixa maiúsculo, senão minúsculo seguido de parêntese
                const displayLabel = indexType === 'roman' ? `${label}) ` : `${label.toLowerCase()}) `;
                indexSpan.textContent = displayLabel;

                opt.prepend(indexSpan);
            });
        }

        // Revela a caixa de explicação e mostra a resposta certa
        revealExplanation() {
            if (!this.explanationContainer) return;

            // Pega as opções corretas e extrai as letras/números delas (Ex: "A" ou "A, C")
            const correctOptions = Array.from(this.querySelectorAll('delta-option[correct="true"]'));
            const correctLabels = correctOptions.map(opt => opt.dataset.indexLabel).join(', ');

            // Atualiza o texto do botão toggle
            this.summaryElement.innerHTML = `<strong>Resposta Correta: ${correctLabels}</strong> &mdash; Ver explicação`;
            this.explanationContainer.style.display = 'block';
        }
    }
);

customElements.define(
    'delta-questionnaire',
    class extends HTMLElement {
        connectedCallback() {
            if (this.dataset.deltaReady) return;
            this.dataset.deltaReady = "1";

            const titleNode = this.querySelector(':scope > delta-title');
            const titleAttr = this.getAttribute('title');
            const isTimed = this.getAttribute('timed') !== 'false'; // por padrão o timer é sempre ativado
            
            const header = document.createElement('div');
            header.className = 'delta-questionnaire-header';

            const titleElement = document.createElement('h2');
            titleElement.className = 'delta-questionnaire-title';

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
            
            this.contentContainer = document.createElement('div');
            this.contentContainer.className = 'delta-questionnaire-content';
            while (this.firstChild) {
                this.contentContainer.appendChild(this.firstChild);
            }

            this.appendChild(header);
            this.appendChild(this.contentContainer);

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
                    this.updateGlobalTimer(); 
                }

                // Calcula a pontuação final:
                const correctAnswers = this.querySelectorAll('delta-question[data-correct="true"]').length;

                // Container de encerramento
                const resultsContainer = document.createElement('div');
                resultsContainer.className = 'delta-questionnaire-results';

                const scoreDisplay = document.createElement('div');
                scoreDisplay.className = 'delta-score-badge';
                scoreDisplay.innerHTML = `Pontuação: <strong>${correctAnswers}/${totalQuestions}</strong>`;
                resultsContainer.appendChild(scoreDisplay);

                // Move o cronômetro para o rodapé ao lado da pontuação
                if (isTimed && this.globalTimeDisplay) {
                    this.globalTimeDisplay.classList.add('completed');
                    resultsContainer.appendChild(this.globalTimeDisplay);
                }

                // Insere no fim do conteúdo (após a última questão)
                this.contentContainer.appendChild(resultsContainer);
            }
        }
    }
);
