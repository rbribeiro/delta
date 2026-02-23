BASE_T = 0; PLOT_T = 1; NEW_T = 2;
TEMPLATE_ID = BASE_T;
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
    function "$x^3 - x - 1$":
        x^3 - x - 1
    function "Função Nula", color "#FF6B6B":
        0
    legend position "top left" objects "1" size "0.22,0.12":

Esta visualização mostra a função f(x) = x³ - x - 1 e a linha y = 0, demonstrando graficamente a existência de uma raiz.`
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

plot "Distributions", y "0,1" x "-2,2":
    distribution pdf "Normal" parameters "0,0.5":
    distribution pdf "Uniform" parameters "-1,1":
    distribution pdf "Exponential" parameters "1":

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
,
`# Continuous Functions

We now come to a significant milestone in our progress toward a rigorous theory of real-valued functions—a proper definition of the seminal concept of continuity that avoids any intuitive appeals to “unbroken curves” or functions without “jumps” or “holes.”

definition "Continuity", level "easy" id "continuity":
    A function $f: A \\rightarrow \\mathbb{R}$ is _continuous at a
    point_ $c \\in A$ if, for all $\\epsilon > 0$, there exists a $\\delta > 0$ such that whenever $\\|x-c\\|<\\delta$ (and $x \\in A$) it follow that $\\|f(x)-f(c)\\| < \\epsilon$.

    If $f$ is continuous at every point in the domain $A$, then we say that $f$ is _continuous on_ $A$.

The definition of continuity looks much like the definition for functional limits, with a few subtle differences. The most important is that we require the point $c$ to be in the domain of $f$. The value $f(c)$ then becomes the value of $\\lim_{x \\rightarrow c} f(x)$. With this observation in mind, it is tempting to shorten [](def, "continuity") to say that $f$ is continuous at $c \\in A$ if
$$\\lim_{x \\rightarrow c} f(x) = f(c)$$

This is fine as long as $c$ is a limit point of $A$. If $c$ is an isolated point of $A$, then $\\lim_{x \\rightarrow c} f(x)$ isn’t defined but [](def, "continuity") can still be applied. An unremarkable but noteworthy consequence of this definition is that functions arecontinuous at isolated points of their domains [](Exercise 4.3.5).

We saw in the previous section that, in addition to the standard $\\epsilon-\\delta$ definition, functional limits have a useful formulation in terms of sequences. The same is true of continuity. The next theorem summarizes these various equivalent ways to characterize the continuity of a function at a given point.

theorem "Characterizations of Continuity":
    Let $f: A \\rightarrow \\mathbb{R}$, and let $c \\in A$. The function $f$ is continuous at $c$ if and only if one of the following three conditions is met\\:
    enumerate label "romam":
        item: 
            For all $\\epsilon > 0$, there exists a $\\delta > 0$ such that $\\|x-c\\|<\\delta$ (and $x \\in A) \\implies \\|f(x) -f(c) \\| < \\epsilon$;
        item:
            For all $V_{\\epsilon}(f(c))$, there exists a $V_{\\delta}(c)$ with the property that $x \\in V_{\\delta}(c)$ (and $x \\in A$) $\\implies f(x) \\in V_{\\epsilon}(f(c))$;
        item:
            For all $(x_n) \\rightarrow c$ (with $x_n \\in A$), it follows that $f(x_n) \\rightarrow f(c)$.
    If $c$ is a limit point of $A$, then the above conditions are equivalent to
        item:
            $\\lim_{x \\rightarrow c} f(x) = f(c)$

proof: 
    Statement (i) is just [](Definition 4.3.1), and statement (ii) is the standard rewording of (i) using topological neighborhoods in place of the absolute value notation. Statement (iii) is equivalent to (i) via an argument nearly identical to that of [](Theorem 4.2.3), with some slight modifications for when $x_n = c$. Finally, statement (iv) is seen to be equivalent to (i) by considering Definition 4.2.1 and observing that the case $x=c$ (which is excluded in the definition of functional limits) leads to the requirement $f(c) \\in V_{\\epsilon}(f(c))$, which is trivially true.

The length of this list is somewhat deceiving. Statements (i), (ii), and (iv) are closely related and essentially remind us that functional limits have an $\\epsilon-\\delta$ formulation as well as a topological description. Statement (iii), however, is qualitatively different from the others. As a general rule, the sequential characterization of continuity is typically the most useful for demonstrating that a function is not continuous at some point.

corollary "Criterion for Discontinuity": 
    Let $f: A \\rightarrow \\mathbb{R}$ and let $c \\in A$ be a limit point of $A$. If there exists a sequence $(x_n) \\subseteq A$ where $(x_n) \\rightarrow c$ but such that $f(x_n)$ does not converge to $f(c)$, we may conclude that $f$ is not continuous at $c$.

The sequential characterization of continuity is also important for the other reasons that it was important for functional limits. In particular, it allows us to bring our catalog of results about the behavior of sequences to bear on the study of continuous functions. The next theorem should be compared to [](Corollary 4.2.3) as well as to [](Theorem 2.3.3).

theorem "Algebraic Continuity Theorem":
    Assume $f: A \\rightarrow \\mathbb{R}$ and $g: A \\rightarrow \\mathbb{R}$ are continuous at a point $c \\in A$. Then,
    enumarate label "roman":
        item:
            $kf(x)$ is continuous at $c$ for all $k \\in \\mathbb{R}$;
        item:
            $f(x) + g(x)$ is continuous at $c$;
        item:
            $f(x)g(x)$ is continuous at $c$; and
        item:
            $f(x)/g(x)$ is continuous at $c$, provided the quotient is defined.
            
proof:
    All of these statements can be quickly derived from [](Corollary 4.2.4) and [](Theorem 4.3.2).

These results provide us with the tools we need to firm up our arguments
in the opening section of this chapter about the behavior of Dirichlet’s function and Thomae’s function. The details are requested in [](Exercise 4.3.7). Here are some more examples of arguments for and against continuity of some familiar functions.

example:
    All polynomials are continuous on $\\mathbb{R}$. In fact, rational functions (i.e., quotients of polynomials) are continuous wherever they are defined.

    To see why this is so, consider the identity function $g(x)$. Because $\\|g(x) - g(c)\\| = \\|x-c\\|$, we can respond to a given $\\epsilon > 0$ by choosing $\\delta = \\epsilon$, and it follows that $g$ is continuous on all of $\\mathbb{R}$. It is even simpler to show that a constant function $f(x) = k$, is continuous. (Letting $\\delta =1$ regardless of the value of $\\epsilon$ does the trick.) Because an arbitrary polynomial
    $$p(x) = a_0 + a_1x + a_2x^2 + \\cdots + \_nx^n$$
    consists of sums and products of $g(x)$ with different constant functions, we may conclude from [](Theorem 4.3.4) that $p(x)$ is continuous.

    Likewise, [](Theorem 4.3.4) implies that quotients of polynomials are continuous as long as the denominator is not zero.

example:
    In [](Example 4.2.6), we saw that the oscillations of $\\sin(1/x)$ are so rapid near the origin that $\\lim_{x\\rightarrow 0} \\sin(1/x)$ does not exist. Now, consider the function
    $$g(x) = \\begin{cases} x \\sin(1/x) & \\text{if } x \\neq 0 \\\\ 0 & \\text{if } x = 0. \\end{cases}$$
    To investigate the continuity of $g$ at $c = 0$ ([](Fig. 4.6)), we can estimate
    $$\\|g(x) - g(0)\\| = \\|x\\sin(1/x) -0\\| \\leq \\|x\\|.$$
    Given $\\epsilon > 0$, set $\\delta = \\epsilon$, so that whenever $\\|x-0\\|=\\|x\\| < \\delta$ if follows that $\\|g(x) - g(0)\\|< \\epsilon$. Thus, $g$ is continuous at the origin.
    
plot x "-.5,.5" y "-.5,.5":
    function "$x\sin(1/x)$", points "3000" color "#413e9e":
        x*sin(1/x)
    legend position "top left" objects "1" size "0.22,0.12":

example:
    Throughout the exercises we have been using the greatest integer function $h(x) = [[x]]$ which for each $x \\in \\mathbb{R}$ returns the largest integer $n \\in \\mathbb{Z}$ satisfying $n \\leq x$. This familiar step function certainly has discontinuous “jumps” at each integer value of its domain, but it is a useful exercise to try and articulate this observation in the language of analysis.

    Given $m \\in \\mathbb{Z}$, define the sequence $(x_n)$ by $x_n = m-1/n$. It follows that $(x_n) \\rightarrow m$, but
    $$h(x_n) \\rightarrow (m-1),$$
    which does not equal $m=h(m)$. By [](Corollary 4.3.3), we see that $h$ fails to be continuous at each $m \\in \\mathbb{Z}$.

    Now let’s see why $h$ is continuous at a point $c \\in \\mathbb{Z}$. Given $\\epsilon > 0$, we must find a $\\delta$-neighborhood $V_{\\delta}(c)$ such that $x \\in V_{\\delta}(c)$ implies $h(x) \\in V_{\\epsilon} (h(c))$. We know that $c \\in \\mathbb{R}$ falls between consecutive integers $n<c<n + 1$ for some $n \\in \\mathbb{Z}$. If we take $\\delta = \\min\\{c-n,(n + 1)- c\\}$, then it follows from the definition of $h$ that $h(x) = h(c)$ for all $x \\in V_{\\delta}(c)$. Thus, we certainly have
    $$h(x) \\in V_{\\epsilon} (h(c))$$
    whenever $x \\in V_{\\delta}(c)$.

    This latter proof is quite different from the typical situation in that the value of $\\delta$ does not actually depend on the choice of $\\epsilon$. Usually, a smaller $\\epsilon$ requires a smaller $\\delta$ in response, but here the same value of $\\delta$ works no matter how small $\\epsilon$ is chosen.

example:
    Consider $f(x) = \\sqrt{x}$ defined on $A = \\{x \\in \\mathbb{R}: x \\geq 0 \\}$. [](Exercise 2.3.1) outlines a sequential proof that $f$ is continuous on $A$. Here, we give an $\\epsilon-\\delta$ proof of the same fact.

    Let $\\epsilon > 0$. We need to argue that $\\|f(x)-f(c) \\|$ can be made less than $\\epsilon$ for all values of $x$ in some $\\delta$ neighborhood around $c$. If $c=0$, this reduces to the statement $\\sqrt{x} < \\epsilon$, which happens as long as $x < \\epsilon^2$. Thus, if we choose $\\delta = \\epsilon^2$, we see that $\\|x-0\\| < \\delta$ implies $\\|f(x)-0\\|< \\epsilon$.

    For a point $c \\in A$ different from zero, we need to estimate $\\| \\sqrt{x} - \\sqrt{c} \\|$. This time, write
    $$\\| \\sqrt{x} - \\sqrt{c} \\| = \\| \\sqrt{x} - \\sqrt{c} \\| \\left( \\frac{\\sqrt{x} + \\sqrt{c}}{\\sqrt{x} + \\sqrt{c}} \\right) = \\frac{\\|x-c\\|}{\\sqrt{x} + \\sqrt{c}} \\leq \\frac{\\|x-c\\|}{\\sqrt{c}}$$.
    In order to make this quantity less than $\\epsilon$, it suffices to pick $\\delta = \\epsilon \\sqrt{c}$. Then, $\\|x-c\\|<\\delta$ implies
    $$\\|\\sqrt{x} - \\sqrt{c} \\| < \\frac{\\epsilon \\sqrt{c}}{\\sqrt{c}}=\\epsilon$$.
    as desired.

Although we have now shown that both polynomials and the square root function are continuous, the Algebraic Continuity Theorem does not provide the justification needed to conclude that a function such as $h(x) = \\sqrt{3x^2 + 5}$ is continuous. For this, we must prove that compositions of continuous functions are continuous.

theorem "Composition of Continuous Functions":
    Given $f: A \\rightarrow \\mathbb{R}$ and $g: B \\rightarrow \\mathbb{R}$, assume that the range $f(A) = \\{f(x):x \\in A \\}$ is contained in the domain $B$ so that the composition $g \\circ f(x) = g(f(x))$ is defined on $A$.
    
    If $f$ is continuous at $c \\in A$, and if $g$ is continuous at $f(c)\\in B$, then $g \\circ f$ is continuous at $c$.

proof:
    [](Exercise 4.3.3.)

## Exercises`
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
                    [/^\s*(project|theorem|definition|lemma|proof|example|note|proposition|corollary|exercise|plot|legend|hint|step|caption|youtube|quote)/, { token: 'block-header', next: '@Tags' }],

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
                { token: 'block-header', foreground: 'ff6b6b', fontStyle: 'bold' },
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

const fullscreenBtn = document.getElementById("fullscreen-btn");
const appRoot = document.querySelector(".editor-container");

fullscreenBtn.addEventListener("click", () => {
  appRoot.classList.toggle("preview-reading-mode");
});

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.deltaEditor = new DeltaEditor();
    window.deltaEditor.init();
});


