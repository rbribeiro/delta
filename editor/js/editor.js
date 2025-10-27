TEMPLATE_ID = 1
const DeltaTemplates = [
`# Introdução aos Limites e Continuidade

definition "Continuidade":
    Uma função $f$ é contínua em um ponto $c$ se o limite de $f(x)$ quando $x$ se aproxima de $c$ é igual a $f(c)$.

theorem "Teorema do Valor Intermediário", level "medium":
    Se $f$ é contínua em $[a,b]$ e $k$ está entre f(a) e f(b), então existe $c$ em $(a,b)$ tal que $f(c) = k$.
    hint: Use o teorema de Bolzano-Weierstrass para a demonstração.

proof:
    Vamos demonstrar este teorema fundamental passo a passo.
    step "Configuração inicial":
        Seja $S = {x [a,c] : f(x) < k }$. Este conjunto é limitado superiormente por b.
        hint:
            O conjunto S é não-vazio pois a ∈ S (assumindo f(a) < k).
    step "Aplicação do supremo":
        Por ser limitado superiormente, S possui supremo. Seja c = sup(S).
        hint: Lembre-se que todo conjunto limitado superiormente possui supremo nos reais.

exercise "Aplicação prática", level "easy":
    Prove que a equação x³ - x - 1 = 0 possui pelo menos uma raiz real no intervalo [1,2].
    hint:
        Calcule f(1) e f(2) e aplique o Teorema do Valor Intermediário.

## Teoremas de Aproximação

lemma "Aproximação por Polinômios":
    Toda função contínua em um intervalo fechado pode ser uniformemente aproximada por polinômios.

example "Função Exponencial":
    A função $f(x) = e^x$ pode ser aproximada pela série:
    $$e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!} = 1 + x + \\frac{x^2}{2!} + \\frac{x^3}{3!} + \\cdots$$
    hint:
        Esta é a série de Taylor da função exponencial.

definition "Convergência Uniforme":
    Uma sequência de funções {f_n} converge uniformemente para f se:
    $$\\lim_{n \\to \\infty} \\sup_{x \\in D} |f_n(x) - f(x)| = 0$$

## Exercícios Avançados

exercise "Teorema de Weierstrass", level "hard":
    Demonstre que se f é contínua em [a,b], então f é uniformemente contínua em [a,b].
    hint:
        Use o método da contradição e a compacidade do intervalo [a,b].

note: 
    Os teoremas fundamentais da análise real formam a base para toda a matemática avançada.
    hint:
        Estude bem estes conceitos - eles aparecem em todas as áreas da matemática!

## Visualização

plot "Teorema do Valor Intermediário", x "0,3" y "-2,8":
    function:
        x^3 - x - 1
    function color "#FF6B6B":
        0

Esta visualização mostra a função f(x) = x³ - x - 1 e a linha y = 0, demonstrando graficamente a existência de uma raiz.
`
,

`plot "Piecewise Function", x "0,10" y "0,20":
    function points "100000":
        e^-(x-3)
        gcd(4.2*(x+0.15),2) - 1.5(x-3)*(x-5)
        -4*(7-x)^2 + 17
        sin(x*pi*4)+17
        x <= 3 ? y : x <= 5 ? y2 : x <= 7 ? y3 : y4

plot "This is an example plot", x "0.7,1.4" y "-1.4,1.4":
    function:
        1 + sin(18*x)/3
	function color "#48ce94" points "30000":
        x/3*sin(1/log(x))
	function from "0.8,1.3" to "-1.25,0":
        (sin(30*x)/tan(30*x))/3 - 1

plot "Function Family", x "0,10" y "0,20":
    function points "1000" color "#000":
        log(x)
    function points "1000" color "#333":
        x
    function points "1000" color "#666":
        x^1.5
    function points "1000" color "#999":
        x^2
    function points "1000" color "#BBB":
        x^3
    function points "1000" color "#DDD":
        x^4
    function points "5000" color "#F00":
        x^5
    function points "5000" color "#0F0":
        x^6
    function points "5000" color "#00F":
        x^7
    function points "5000" color "#0FF":
        x^8
    function points "7500" color "#F0F":
        x^9
    function points "7500" color "#0FF":
        x^10
    legend:`
]
const INITIAL_DELTA_TEXT = DeltaTemplates[TEMPLATE_ID]

class DeltaEditor {
    constructor() {
        // Simple direct references to global objects
        this.parser = new Parser();
        this.renderer = new DeltaRenderer();
        this.preview = document.getElementById('preview');
        this.documentContent = document.getElementById('document-content');
        this.editorContainer = document.getElementById('editor-container');
        this.isDarkTheme = false;
        
        // Debounce timer
        this.updateTimer = null;
    }
    
    init() {
        this.initializeEditor();
        this.setupControls();
        
        // Force initial preview update after a short delay to ensure editor is ready
        setTimeout(() => {
            this.updatePreview();
        }, 1000);
    }
    
    async initializeEditor() {
        try {
            // Try Monaco first, but with a short timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Monaco timeout')), 3000)
            );
            
            await Promise.race([
                this.createMonacoEditor(),
                timeoutPromise
            ]);
            
            console.log('Monaco editor created successfully');
        } catch (error) {
            console.log('Monaco not available, using enhanced textarea:', error.message);
            this.createFallbackEditor();
        }
    }
    
    async createMonacoEditor() {
        return new Promise((resolve, reject) => {
            if (!window.require) {
                reject(new Error('Monaco loader not available'));
                return;
            }
            
            window.require.config({ 
                paths: { 
                    vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' 
                }
            });
            
            window.require(['vs/editor/editor.main'], () => {
                const initialContent = INITIAL_DELTA_TEXT;

                // Register Delta language
                this.registerDeltaLanguage();
                
                this.monacoEditor = monaco.editor.create(this.editorContainer, {
                    value: initialContent,
                    language: 'delta',
                    theme: 'delta-light',
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontFamily: "'Fira Code', 'JetBrains Mono', 'Monaco', 'Cascadia Code', monospace",
                    automaticLayout: true,
                    wordWrap: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    renderWhitespace: 'selection',
                    tabSize: 4,
                    insertSpaces: true,
                    detectIndentation: false
                });
                
                // Listen for content changes
                this.monacoEditor.onDidChangeModelContent(() => {
                    this.debounceUpdate();
                });
                
                resolve();
            }, reject);
        });
    }
    
    registerDeltaLanguage() {
        // Register the Delta language
        monaco.languages.register({ id: 'delta' });
        
        // Define syntax highlighting rules
        monaco.languages.setMonarchTokensProvider('delta', {
            tokenizer: {
                root: [
                    // Section headers (# ## ###)
                    [/^#{1,6}\s+.*$/, 'section'],

                    // General Tags (proof:) (definition "title":) (theorem "title" attribute "value":)
                    [/^\s*(project|theorem|definition|lemma|proof|example|note|proposition|corollary|exercise|plot)/, { token: 'block-header', next: '@Tags' }],

                    // Math Tags
                    [/^\s*(equation|function)/, { token: 'block-header', next: '@mathTags' }],

                    // Math blocks $$...$$
                    [/\$\$/, { token: 'math-delimiter', next: '@mathBlock' }],

                    // Math blocks \[...\]
                    [/\\\[/, { token: 'math-delimiter', next: '@mathBlock' }],
                    
                    // Inline math $...$
                    [/\$/, { token: 'math-delimiter', next: '@mathBlock' }],

                    // Inline math \(...\)
                    [/\\\(/, { token: 'math-delimiter', next: '@mathBlock' }],
                    
                    // Comments (if we want to support them)
                    [/\/\/.*$/, 'comment'],
                ],

                Tags: [
                    // End of block header
                    [/:\s*/, { token: 'block-header', next: '@pop' }],
                    
                    // Quoted strings for block titles and attributes
                    [/"[^"]*"/, 'string'],

                    // Attribute keys
                    [/[^":]*/, 'attribute-key'],
                ],

                mathTags: [
                    // End of block header
                    [/:\s*/, { token: 'block-header', next: '@mathSpace' }],
                    
                    // Quoted strings for block titles and attributes
                    [/"[^"]*"/, 'string'],

                    // Attribute keys
                    [/[^":]*/, 'attribute-key'],
                ],

                mathSpace: [
                    [/\s*/, { token: 'block-header', next: '@mathTagsBlock' }],
                ],
                
                mathBlock: [
                    // LaTeX commands
                    [/\\[a-zA-Z]+/, 'math-command'],
                    
                    // Numbers (integers and decimals)
                    [/\d+\.?\d*/, 'math-number'],
                    
                    // Math operators
                    [/[+\-*^/=<>≤≥≠∫∑∏∆∇∞±×÷]/, 'math-operator'],
                    
                    // Delimiters
                    [/[()[\]{}|]/, 'math-delimiter-inner'],
                    
                    // End delimiter $$
                    [/\$\$/, { token: 'math-delimiter', next: '@pop' }],

                    // End delimiter \]
                    [/\\\]/, { token: 'math-delimiter', next: '@pop' }],

                    // End delimiter $
                    [/\$/, { token: 'math-delimiter', next: '@pop' }],

                    // End delimiter \)
                    [/\\\)/, { token: 'math-delimiter', next: '@pop' }],
                    
                    // Everything else is math content
                    [/./, 'math-content']
                ],
                
                mathTagsBlock: [
                    // LaTeX commands
                    [/\\[a-zA-Z]+/, 'math-command'],
                    
                    // Numbers (integers and decimals)
                    [/\d+\.?\d*/, 'math-number'],
                    
                    // Math operators
                    [/[+\-*^/=<>≤≥≠∫∑∏∆∇∞±×÷]/, 'math-operator'],
                    
                    // Delimiters
                    [/[()[\]{}|]/, 'math-delimiter-inner'],
                    
                    // End delimiter: when we hit a new line.
                    [/^/, { token: 'math-delimiter', next: '@root' }],
                    
                    // Everything else is math content
                    [/./, 'math-content']
                ]
            }
        });
        
        // Define themes
        monaco.editor.defineTheme('delta-light', {
            base: 'vs',
            inherit: true,
            rules: [
                { token: 'section', foreground: '0066cc', fontStyle: 'bold' },
                { token: 'block-header', foreground: '8b0000', fontStyle: 'bold' },
                { token: 'attribute-key', foreground: '4b0082' },
                { token: 'math-delimiter', foreground: '228b22', fontStyle: 'bold' },
                { token: 'math-command', foreground: '0066cc', fontStyle: 'bold' },
                { token: 'math-operator', foreground: 'dc143c' },
                { token: 'math-number', foreground: 'ff6347' },
                { token: 'math-delimiter-inner', foreground: '9370db' },
                { token: 'math-content', foreground: '2f4f4f' },
                { token: 'string', foreground: 'cc6600' },
                { token: 'comment', foreground: '999999', fontStyle: 'italic' },
            ],
            colors: {
                'editor.background': '#ffffff'
            }
        });
        
        monaco.editor.defineTheme('delta-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'section', foreground: '4fc3f7', fontStyle: 'bold' },
                { token: 'block-header-full', foreground: 'ff6b6b', fontStyle: 'bold' },
                { token: 'block-header-title', foreground: 'ff6b6b', fontStyle: 'bold' },
                { token: 'block-header-simple', foreground: 'ff6b6b', fontStyle: 'bold' },
                { token: 'block-type', foreground: 'ff6b6b', fontStyle: 'bold' },
                { token: 'attribute-key', foreground: 'da70d6' },
                { token: 'math-delimiter', foreground: '4caf50', fontStyle: 'bold' },
                { token: 'math-command', foreground: '4fc3f7', fontStyle: 'bold' },
                { token: 'math-operator', foreground: 'ff69b4' },
                { token: 'math-number', foreground: 'ffa07a' },
                { token: 'math-delimiter-inner', foreground: 'dda0dd' },
                { token: 'math-content', foreground: 'c0c0c0' },
                { token: 'string', foreground: 'ffb74d' },
                { token: 'comment', foreground: '666666', fontStyle: 'italic' },
            ],
            colors: {
                'editor.background': '#1e1e1e'
            }
        });
        
        // Set Delta as default theme
        monaco.editor.setTheme('delta-light');
    }

    createFallbackEditor() {
        // Create a textarea fallback with enhanced styling
        const textarea = document.createElement('textarea');
        textarea.id = 'editor-fallback';
        textarea.value = INITIAL_DELTA_TEXT;
        
        textarea.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            outline: none;
            resize: none;
            padding: 20px;
            font-family: 'Fira Code', 'JetBrains Mono', 'Monaco', monospace;
            font-size: 14px;
            line-height: 1.6;
            background-color: #fafafa;
            color: #333;
            tab-size: 4;
        `;
        
        // Add tab support
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                
                // Insert tab character
                e.target.value = e.target.value.substring(0, start) + 
                    '    ' + e.target.value.substring(end);
                
                // Move cursor
                e.target.selectionStart = e.target.selectionEnd = start + 4;
            }
        });
        
        textarea.addEventListener('input', () => {
            this.debounceUpdate();
        });
        
        this.editorContainer.appendChild(textarea);
        this.textarea = textarea;
        
        console.log('Fallback textarea editor created');
    }


    
    setupControls() {
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Format button
        document.getElementById('format-btn').addEventListener('click', () => {
            this.formatDocument();
        });
        
        // Export button
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportHTML();
        });
        
        // Fullscreen toggle
        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            this.togglePreviewFullscreen();
        });
    }
    
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        const themeButton = document.getElementById('theme-toggle');
        
        if (this.isDarkTheme) {
            themeButton.textContent = '☀️';
            document.body.classList.add('dark-theme');
            
            // Apply dark theme to Monaco
            if (this.monacoEditor) {
                this.monacoEditor.updateOptions({ theme: 'delta-dark' });
            }
            
            // Style textarea for dark theme
            if (this.textarea) {
                this.textarea.style.backgroundColor = '#1e1e1e';
                this.textarea.style.color = '#d4d4d4';
            }
        } else {
            themeButton.textContent = '🌙';
            document.body.classList.remove('dark-theme');
            
            // Apply light theme to Monaco
            if (this.monacoEditor) {
                this.monacoEditor.updateOptions({ theme: 'delta-light' });
            }
            
            // Style textarea for light theme
            if (this.textarea) {
                this.textarea.style.backgroundColor = '#fafafa';
                this.textarea.style.color = '#333';
            }
        }
    }
    
    formatDocument() {
        if (this.monacoEditor) {
            this.monacoEditor.getAction('editor.action.formatDocument').run();
            this.updateStatus('Document formatted!');
        } else {
            this.updateStatus('Formatting available with Monaco editor');
        }
    }
    
    exportHTML() {
        const deltaProject = document.querySelector("delta-project");
        const title = deltaProject?.getAttribute("title");
        const font = deltaProject?.getAttribute("font");
        const html = this.preview.innerHTML;
        const blob = new Blob([`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
            <style>
                body { font-family: ${font}; max-width: 800px; margin: 0 auto; padding: 20px; }
                ${document.querySelector('style')?.textContent || ''}
            </style>
        </head>
        <body>
            ${html}
        </body>
        </html>
        `], { type: 'text/html' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.html';
        a.click();
        URL.revokeObjectURL(url);
        
        this.updateStatus('Exported to HTML!');
    }
    
    togglePreviewFullscreen() {
        const previewPanel = document.querySelector('.preview-panel');
        previewPanel.classList.toggle('fullscreen');
    }
    
    updateStatus(message) {
        const status = document.querySelector('.status');
        status.textContent = message;
        setTimeout(() => {
            status.textContent = 'Ready';
        }, 2000);
    }
    
    getCurrentText() {
        if (this.monacoEditor) {
            return this.monacoEditor.getValue();
        } else if (this.textarea) {
            return this.textarea.value;
        }
        return '';
    }
    
    debounceUpdate() {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            this.updatePreview();
        }, 300);
    }
    
    updatePreview() {
        const text = this.getCurrentText();
        const ast = this.parser.parse(text);
        const html = this.renderer.render(ast);
        
        // Render into the document container (not the editor preview div)
        this.documentContent.innerHTML = html;
        
        // Re-render MathJax after DOM update
        if (window.MathJax) {
            MathJax.typesetPromise([this.documentContent]).catch((err) => {
                console.log('MathJax error:', err);
            });
        }
    }
    

}

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.deltaEditor = new DeltaEditor();
    window.deltaEditor.init();
});
