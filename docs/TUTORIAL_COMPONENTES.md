# Tutorial: criando componentes customizados

Um passo-a-passo de ponta a ponta: do zero até um componente `<quote>` funcionando dentro de
um `.html` compilado. O caminho é o **pacote** — a única unidade de extensão do Delta —
carregado no documento pela tag `<import src="…" />`.

> **Pré-requisitos:** saber escrever um `.dlt` e compilá-lo. Nenhuma experiência com Custom
> Elements é necessária — a API é ensinada aqui.
>
> **Documentos irmãos:** [PACKAGES.md](PACKAGES.md) é o *design* do sistema de pacotes (por que
> ele é assim) e [AUTHORING_PACKAGES.md](AUTHORING_PACKAGES.md) é a *referência* completa
> (manifesto, tabela de tokens, checklist de publicação). Este tutorial é a porta de entrada
> para os dois.

---

## 1. Como um pacote chega ao navegador

Um pacote Delta é **uma pasta com um script de navegador e, opcionalmente, uma folha de
estilo**. O mínimo é isto:

```
quote/
  index.js      # registra o(s) elemento(s)
  theme.css     # estiliza o(s) elemento(s)  (opcional)
```

O documento puxa a pasta com uma tag:

```xml
<document>
  <import src="./quote" />
  ...
</document>
```

### O que o compilador faz com esse `src`

A resolução acontece em [`src/compiler/imports.ts`](../src/compiler/imports.ts), em três etapas:

1. **Achar a pasta.** Uma **pasta local existente sempre vence** — o caminho é resolvido
   relativo ao `.dlt`. Isso vale inclusive para nomes sem `./`: em
   [`examples/hello.dlt`](../examples/hello.dlt) o `src="imports/mod"` é uma pasta local. Se a
   pasta não existir e o `src` não parecer um caminho (`./`, `../`, `/`), o compilador tenta
   resolvê-lo como pacote npm dentro de `node_modules`.
2. **Ler o manifesto — que é opcional.** Sem manifesto, vale a convenção `index.js` +
   `theme.css`. É o que usaremos aqui. Quando existe, ele é o campo `"delta"` do `package.json`
   ou um arquivo `delta.pack.json` ao lado:

   ```jsonc
   {
     "delta": {
       "js":   "dist/pack.min.js",  // entrada (padrão: "index.js")
       "css":  "dist/pack.min.css", // estilos (padrão: "theme.css", silencioso se ausente)
       "tags": ["quote"],           // as tags que o pacote registra, sem o prefixo "delta-"
       "needs": []                  // outros pacotes dos quais este depende
     }
   }
   ```

3. **Ler os dois arquivos para dentro do contexto de compilação.** O conteúdo é *lido*, não
   referenciado — nada é buscado em tempo de visualização.

### Onde o código aterrissa no HTML

O emissor ([`src/compiler/emit.ts`](../src/compiler/emit.ts)) coloca cada peça em um lugar
preciso. O esqueleto do arquivo gerado:

```html
<head>
  <style> /* CORE_CSS: base.css + todos os components/*.css */ </style>
  <style> /* tema embutido, se houver (theme="impatech")      */ </style>
  <style> /* tema do tipo de documento (article/book/…)       */ </style>
  <style> /* CSS do KaTeX, só se o documento usa matemática   */ </style>
  <style> /* ►► SEU theme.css ◄◄                              */ </style>
  <style> /* tema do autor (<document theme="meu.css">)       */ </style>
</head>
<body>
  <!-- o documento inteiro, já serializado -->
  <script> /* RUNTIME_JS: o runtime do Delta */ </script>
  <script>
  /* pack: quote */
  /* ►► SEU index.js ◄◄ */
  </script>
</body>
```

Três consequências que moldam tudo o que você vai escrever:

- **Seu JS roda depois do runtime.** É por isso que `window.Delta` já existe quando seu código
  executa, e por isso que a árvore inteira já está parseada.
- **Seu JS é um script clássico**, não um módulo: o `<script>` não tem `type="module"`. Portanto
  **nada de `import` ou `export`** no seu `index.js`. Se você usar ferramentas, empacote para
  um IIFE único (`esbuild --format=iife`).
- **Seu CSS vem antes do tema do autor.** Você estiliza seu elemento, mas quem escreve o
  documento ainda pode sobrescrever você — como deve ser.

Cada pacote ganha o próprio `<script>`, com um marcador `/* pack: <nome> */` no topo. Esse
marcador é o primeiro lugar para olhar quando algo não aparece no HTML.

> Além do `<import>` local, um pacote pode vir do npm (`<import src="delta-quote" />`) ou valer
> para o projeto inteiro pela chave `packages` do `project.toml`. Os três canais desembocam no
> mesmo inliner — ver [PACKAGES.md](PACKAGES.md).

---

## 2. A ponte entre o `.dlt` e o elemento

Este é o conceito que faz o resto encaixar.

**O compilador renomeia *toda* tag `<foo>` para `<delta-foo>`.** Sem exceção, sem lista de tags
conhecidas, em qualquer profundidade. A função `serialize` em `emit.ts` é literalmente isto:

```ts
case "element": {
  const tag = `delta-${node.tag}`;
  ...
}
```

Então, dado este trecho de `.dlt`:

```xml
<quote align="right">
  A matemática é a rainha das ciências.
  <author>Carl Friedrich Gauss</author>
</quote>
```

o HTML gerado é:

```html
<delta-quote align="right">
  A matemática é a rainha das ciências.
  <delta-author>Carl Friedrich Gauss</delta-author>
</delta-quote>
```

Quatro coisas a guardar:

- **Você registra a tag com prefixo.** O autor escreve `<quote>`; seu código define
  `"delta-quote"`. O filho também: `<author>` vira `<delta-author>`.
- **Os atributos passam intactos.** `align="right"` chega ao navegador com o nome e o valor que
  você escreveu (só com escape de HTML). Atributos são o canal de configuração do seu componente.
- **Tags desconhecidas não geram aviso.** Não existe registro de tags no compilador. Um
  `<qoute>` com erro de digitação compila em silêncio e vira `<delta-qoute>`, um elemento inerte
  que renderiza como texto. Quando algo "não funciona", confira a grafia primeiro.
- **`<import>` tem que ser filho direto de `<document>`.** O compilador varre apenas os filhos
  imediatos; um `<import>` dentro de uma `<section>` é ignorado e ainda vaza como
  `<delta-import>` no HTML.

---

## 3. Mãos à obra

Crie a pasta do pacote e um documento de teste lado a lado:

```
tutorial/
  teste.dlt
  quote/
    index.js
    theme.css
```

`teste.dlt`:

```xml
<document lang="pt" type="article" theme-accent="teal">
  <title>Testando o componente quote</title>

  <import src="./quote" />

  <section>
    <title>Uma citação</title>

    <quote>
      A matemática é a rainha das ciências.
      <author>Carl Friedrich Gauss</author>
    </quote>

    <quote align="right" mark="false">
      O que é afirmado sem prova pode ser negado sem prova.
      <author>Euclides</author>
    </quote>
  </section>
</document>
```

Para compilar, a partir da raiz do repositório Delta:

```bash
npm run dev -- build tutorial/teste.dlt -o tutorial/teste.html
```

Por enquanto o resultado é texto solto — o `index.js` ainda está vazio. Vamos preenchê-lo.

---

## 4. A API de Custom Elements, um conceito por vez

### 4.1 A classe e o registro são dois passos

Um componente é **uma classe que herda de `HTMLElement`**, registrada com um nome de tag.
Declare a classe primeiro:

```js
class DeltaQuote extends HTMLElement {
  // ainda vazia
}
```

Herdar de `HTMLElement` significa que **a classe *é* o elemento**. Não há um "elemento" separado
guardado dentro dela: `this`, aqui, é o próprio nó da árvore do documento. Todos os métodos de
DOM que você já conhece estão disponíveis em `this`:

```js
this.getAttribute("align")            // ler um atributo da tag
this.querySelector(":scope > delta-author")  // achar um filho
this.append(algumNo)                  // inserir conteúdo
this.classList.add("is-fancy")        // mexer em classes
```

Só depois de a classe estar pronta é que você a associa a um nome de tag:

```js
customElements.define("delta-quote", DeltaQuote);
```

Regras do `define`:

- **O nome precisa ter um hífen.** `quote` seria inválido; `delta-quote` é válido. (A convenção
  do Delta resolve isso sozinha, já que toda tag ganha o prefixo `delta-`.)
- **Uma classe por tag.** Não dá para registrar a mesma classe em dois nomes. Quando o Delta
  precisa disso — os catorze ambientes de teorema compartilham um comportamento — ele cria uma
  subclasse anônima por tag: ``customElements.define(`delta-${kind}`, class extends DeltaEnvironment {})``.
- **O registro é síncrono.** No instante em que `define` é chamado, o navegador percorre a
  página e "promove" todas as instâncias já existentes daquela tag, rodando o
  `connectedCallback` de cada uma antes de a próxima linha do seu script executar.

Essa separação classe/registro é o padrão do core: veja `class DeltaBox` seguido de
`defineBox()` em [`src/runtime/elements/box.ts`](../src/runtime/elements/box.ts).

### 4.2 `connectedCallback`: onde o trabalho acontece

O navegador chama alguns métodos de ciclo de vida na sua classe. O único que o Delta usa é o
`connectedCallback`, disparado quando o elemento entra no documento:

```js
class DeltaQuote extends HTMLElement {
  connectedCallback() {
    console.log("um <quote> entrou na página");
  }
}
```

**Por que não o `constructor`?** Porque na hora do construtor o elemento ainda não tem filhos —
a especificação proíbe inspecionar ou modificar filhos ali. Nenhum elemento do Delta define um
construtor.

**Por que os filhos já estão garantidamente lá no `connectedCallback`?** Porque o `<script>` do
runtime fica no **fim do `<body>`** — o HTML inteiro já foi parseado quando ele executa. Não há
`defer`, não há `DOMContentLoaded`: a garantia vem da posição do script. O próprio código do
runtime depende disso, como diz o comentário no topo de
[`src/runtime/elements/index.ts`](../src/runtime/elements/index.ts):

> *"The runtime is inlined at the end of `<body>`, so the whole tree is parsed before anything
> upgrades."*

Como o seu pacote é inlinado depois do runtime, a garantia vale igualmente para você. Pode ler
`this.children` e `this.querySelector(...)` à vontade.

### 4.3 O guard: `connectedCallback` roda mais de uma vez

Esta é a pegadinha número um. `connectedCallback` dispara **toda vez** que o elemento é
conectado ao documento — e mover um nó no DOM é uma desconexão seguida de reconexão. Como os
componentes do Delta movem nós o tempo todo (o `<box>` embrulha o corpo, o deck reposiciona
slides, o `<floating>` recolhe o sumário), um elemento pode ser inicializado duas ou três vezes
— duplicando tudo que você inseriu.

A solução idiomática, presente em vinte arquivos do runtime, é uma marca no próprio elemento:

```js
connectedCallback() {
  if (this.dataset.deltaReady) return;
  this.dataset.deltaReady = "1";

  // ... daqui para baixo, roda exatamente uma vez
}
```

`this.dataset.deltaReady` é o atributo `data-delta-ready` no HTML. Ele sobrevive à movimentação
do nó, então a segunda chamada sai imediatamente.

**Escreva essas duas linhas antes de qualquer outra coisa em todo componente que você criar.**

### 4.4 Lendo um filho: o `<author>`

Queremos transformar isto:

```html
<delta-quote>
  A matemática é a rainha das ciências.
  <delta-author>Carl Friedrich Gauss</delta-author>
</delta-quote>
```

nisto:

```html
<delta-quote data-delta-ready="1">
  <div class="quote-body">A matemática é a rainha das ciências.</div>
  <div class="quote-author">Carl Friedrich Gauss</div>
</delta-quote>
```

O código:

```js
// 1. Achar o filho — sempre com ":scope >", nunca um descendente solto.
const author = this.querySelector(":scope > delta-author");

let authorLine = null;
if (author) {
  authorLine = document.createElement("div");
  authorLine.className = "quote-author";
  // 2. MOVER os filhos, não copiar o texto.
  authorLine.append(...author.childNodes);
  author.remove();
}

// 3. O que sobrou é o corpo da citação.
const body = document.createElement("div");
body.className = "quote-body";
body.append(...this.childNodes);

// 4. Montar na ordem final.
this.append(body);
if (authorLine) this.append(authorLine);
```

Quatro decisões, cada uma com um motivo:

**1. `:scope >` seleciona apenas filhos diretos.** `querySelector("delta-author")` acharia um
`<author>` aninhado em qualquer profundidade — inclusive dentro de uma citação aninhada, ou
dentro de um `<paper>` de bibliografia. `:scope > delta-author` restringe ao filho imediato.
O runtime usa essa forma em todo lugar; [`columns.ts`](../src/runtime/elements/columns.ts)
documenta o porquê: a tag `<column>` é usada tanto por `<columns>` quanto por `<table>`, e o
`:scope >` é exatamente o que impede as duas de colidirem.

**2. Mova `childNodes` em vez de copiar `textContent`.** Se você fizesse
`authorLine.textContent = author.textContent`, um autor escrito como
`<author>P. <em>Erdős</em></author>` perderia a ênfase, e um nome com matemática inline perderia
o KaTeX já renderizado. `append(...author.childNodes)` **transfere** os nós, preservando toda a
estrutura. O comentário no `box.ts` resume: *"move children so math/emphasis survive"*.

**3. `author.remove()`** tira a casca `<delta-author>` vazia da página.

**4. A ordem dos dois `append` importa.** Repare que `body.append(...this.childNodes)` varre o
que restou **antes** de qualquer `this.append(...)`. Se você inserisse a linha de autoria
primeiro, a varredura seguinte a engoliria junto com o corpo. É a mesma armadilha resolvida no
`box.ts`, e vale para todo componente que "embrulha o próprio conteúdo".

> **O `<author>` não precisa de `customElements.define`.** Ele nunca é um componente: é dado
> lido pelo pai. Uma tag filha só precisa de registro quando tem comportamento próprio.
> `<column>` dentro de `<columns>` funciona exatamente assim.

### 4.5 Lendo atributos

Atributos são como o autor configura o seu componente. Leia-os com `getAttribute`, que devolve
uma **string** ou `null`.

Há duas rotas para transformar um atributo em comportamento, e o `<quote>` usa as duas.

**Rota A — deixar o CSS decidir.** Quando o atributo só muda aparência, não construa estilo em
JavaScript: valide o valor e republique-o como um `data-*` no elemento, para o CSS reagir com um
seletor de atributo.

```js
const ALIGNMENTS = new Set(["left", "center", "right"]);

const align = this.getAttribute("align")?.trim().toLowerCase();
if (align && ALIGNMENTS.has(align)) {
  this.dataset.align = align;   // vira data-align="right" no HTML
}
```

e, do outro lado, no `theme.css`:

```css
delta-quote[data-align="right"] { text-align: right; }
```

Validar contra um `Set` é o que impede um `align="banana"` de virar CSS quebrado — o valor
inválido é simplesmente ignorado e o padrão prevalece. É o mesmo desenho do `<box>`, que checa a
cor contra a lista de paletas antes de usá-la.

**Rota B — ramificar em JavaScript.** Quando o atributo muda a *estrutura* do que você constrói,
a decisão é no código. Atributos booleanos no Delta são strings explícitas (`.dlt` é XML
estrito: não existe atributo sem valor), então o teste compara com `"false"`:

```js
const showMark = this.getAttribute("mark") !== "false";  // padrão: mostrar

if (showMark) {
  const mark = document.createElement("span");
  mark.className = "quote-mark";
  mark.textContent = "“";
  mark.setAttribute("aria-hidden", "true");
  body.prepend(mark);   // `body` é o .quote-body montado no passo 4.4
}
```

Esse é o padrão de [`hint.ts`](../src/runtime/elements/hint.ts), que lê `show-icon="false"` do
mesmo jeito. Note o `aria-hidden`: a aspa é decoração visual e não deve ser lida por um leitor
de tela.

> **E o `attributeChangedCallback`?** A API de Custom Elements oferece
> `static observedAttributes` + `attributeChangedCallback` para reagir a mudanças de atributo
> depois da inicialização. **O Delta não usa nenhum dos dois** — zero ocorrências em todo o
> `src/runtime/elements/`. O motivo é a regra que organiza o projeto inteiro: *dados são
> resolvidos em tempo de compilação, o chrome é renderizado em tempo de execução*. Os atributos
> chegam prontos do compilador e não mudam mais. Você só precisaria deles se estivesse
> construindo um componente que muda em resposta a interação — aí, sim, a API está lá.

### O `index.js` completo

```js
// Pacote Delta: registra <quote> (o compilador renomeia para <delta-quote>).
// Script clássico — nada de import/export. Roda depois do runtime do Delta,
// então window.Delta já existe e a árvore inteira já está parseada.

// Valores aceitos em align="…"; qualquer outro é ignorado.
const ALIGNMENTS = new Set(["left", "center", "right"]);

class DeltaQuote extends HTMLElement {
  connectedCallback() {
    // connectedCallback dispara de novo se o nó for movido — proteja-se.
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    this.applyAlignment();

    // Levanta o <author> para uma linha de atribuição própria.
    const author = this.querySelector(":scope > delta-author");
    let authorLine = null;
    if (author) {
      authorLine = document.createElement("div");
      authorLine.className = "quote-author";
      authorLine.append(...author.childNodes); // move os nós: ênfase e matemática sobrevivem
      author.remove();
    }

    // O que sobrou é a citação em si. Varra ANTES de anexar qualquer coisa nova,
    // senão a varredura engoliria o que você acabou de inserir.
    const body = document.createElement("div");
    body.className = "quote-body";
    body.append(...this.childNodes);

    this.append(body);
    if (authorLine) this.append(authorLine);

    // A aspa decorativa pode ser desligada com mark="false".
    if (this.getAttribute("mark") !== "false") {
      const mark = document.createElement("span");
      mark.className = "quote-mark";
      mark.textContent = "“";
      mark.setAttribute("aria-hidden", "true"); // decoração: invisível para leitores de tela
      body.prepend(mark);                       // dentro do corpo, para fluir com a 1ª linha
    }
  }

  /** Publica align="…" como data-align para o CSS decidir o layout. */
  applyAlignment() {
    const align = this.getAttribute("align")?.trim().toLowerCase();
    if (align && ALIGNMENTS.has(align)) this.dataset.align = align;
  }
}

customElements.define("delta-quote", DeltaQuote);
```

Repare que `applyAlignment` é um método comum da classe. Como o componente *é* uma classe, você
pode quebrar um `connectedCallback` grande em métodos nomeados — o `this` continua sendo o
elemento em todos eles.

---

## 5. O `theme.css`

```css
/* Estilos de <quote> (o elemento delta-quote, definido em index.js).
   Tudo escopado na tag e construído sobre os tokens --delta-*, para acompanhar
   o tema do documento, o theme-accent e o modo escuro sem código extra. */

delta-quote {
  display: block;                          /* obrigatório: ver nota abaixo */
  position: relative;
  margin: var(--delta-block-gap) 0;
  padding: 0.2rem 0 0.2rem 1.1rem;
  border-left: 3px solid var(--delta-accent);
  font-family: var(--delta-serif);
  font-style: italic;
  color: color-mix(in oklab, var(--delta-ink) 85%, var(--delta-accent));
}

delta-quote .quote-body {
  line-height: var(--delta-leading);
}

delta-quote .quote-author {
  margin-top: 0.4rem;
  font-style: normal;
  font-family: var(--delta-sans);
  font-size: var(--delta-t-small);
  color: var(--delta-mute);
}

delta-quote .quote-author::before {
  content: "— ";
}

delta-quote .quote-mark {
  font-size: 2.4em;
  line-height: 0;
  vertical-align: -0.35em;
  margin-right: 0.1em;
  color: color-mix(in oklab, var(--delta-accent) 45%, var(--delta-rule));
}

/* O atributo align="…" chega aqui como data-align, publicado pelo index.js. */
delta-quote[data-align="center"] {
  text-align: center;
  border-left: none;
  padding-left: 0;
  border-top: 1px solid var(--delta-rule-soft);
  border-bottom: 1px solid var(--delta-rule-soft);
  padding-block: 0.7rem;
}

delta-quote[data-align="right"] {
  text-align: right;
  border-left: none;
  border-right: 3px solid var(--delta-accent);
  padding: 0.2rem 1.1rem 0.2rem 0;
}
```

Três regras que fazem a diferença entre um componente que parece nativo e um que parece colado:

**1. `display: block` é obrigatório.** Todo custom element é `display: inline` por padrão no
HTML. Não existe nenhuma regra guarda-chuva no Delta que conserte isso — cada componente do core
declara o seu próprio `display`. Esquecer essa linha é a causa mais comum de "meu componente
ficou todo torto".

**2. Use os tokens `--delta-*`, nunca cores literais.** `var(--delta-accent)` e
`color-mix(in oklab, …)` fazem o componente seguir de graça o `theme-accent="teal"` do documento
e o `theme-mode="dark"`. Um `#3366cc` cravado no CSS não segue nada. A lista completa de tokens
está no bloco `:root` de [`src/styles/base.css`](../src/styles/base.css) e resumida em tabela em
[AUTHORING_PACKAGES.md](AUTHORING_PACKAGES.md).

**3. Escope tudo na sua tag.** Não há shadow DOM aqui — seu CSS entra na mesma página que todo o
resto. Um seletor `.quote-author { … }` solto vazaria para qualquer elemento com essa classe.
Escreva sempre `delta-quote .quote-author`.

> Uma nota de cascata: o CSS do core vive dentro de `@layer` (`delta.base`, `delta.components`,
> `delta.theme`), mas o CSS de pacote é inlinado **fora** de qualquer layer, o que o coloca
> naturalmente acima do core. Ainda assim o tema do autor (`<document theme="meu.css">`) vem
> depois e vence você — é intencional: quem escreve o documento tem a última palavra.

---

## 6. Compilar e conferir

```bash
npm run dev -- build tutorial/teste.dlt -o tutorial/teste.html
```

Abra o `teste.html` no navegador — deve funcionar direto do `file://`, sem servidor. Depois,
confira no arquivo gerado:

```bash
grep -c "pack: quote"      tutorial/teste.html   # 1 → o pacote foi inlinado
grep -o "<delta-quote[^>]*" tutorial/teste.html   # a tag foi renomeada, com os atributos
grep -cE '(src|href)="https?:' tutorial/teste.html  # 0 → o arquivo é autossuficiente
```

Se o elemento não renderizou, a ordem de investigação é:

1. O marcador `/* pack: quote */` está no HTML? Se não, o `<import>` não resolveu — confira o
   caminho e se a tag é filha direta de `<document>`.
2. O console do navegador acusa erro? Um `import`/`export` esquecido no `index.js` aparece aqui
   como erro de sintaxe.
3. A tag no HTML é `<delta-quote>` mesmo? Se for `<delta-qoute>`, é erro de digitação no `.dlt`
   — e o compilador não avisa.

Por fim, teste que o componente acompanha o tema. Troque o cabeçalho do `teste.dlt` para

```xml
<document lang="pt" type="article" theme-accent="purple" theme-mode="dark">
```

recompile e confirme que a barra lateral e a aspa mudaram de cor junto com o resto do documento.
Se mudaram, seu CSS está construído sobre os tokens certos.

---

## 7. Armadilhas comuns

- **Nada de `import`/`export`** no `index.js` — é um script clássico. Use `esbuild --format=iife`
  se precisar de ferramentas.
- **O detector de recurso externo é literal.** O compilador avisa se o seu JS contém `fetch(`,
  `import(` ou `https://` — e o regex não distingue código de comentário. Um `// veja
  https://exemplo.com` no seu arquivo já dispara o aviso.
- **`<import>` só como filho direto de `<document>`.** Dentro de uma `<section>` ele é ignorado.
- **`.dlt` é XML estrito.** Todo atributo precisa de valor (`mark="false"`, nunca `mark` solto),
  toda tag precisa fechar, e `<`, `>`, `&` em prosa precisam ser escritos como entidades.
- **Um pacote gerado por `delta create package` não importa antes de ser construído.** O
  manifesto do esqueleto aponta para `dist/pack.min.js`, e `dist/` está no `.gitignore` — rode
  `npm install && npm run build` primeiro, senão a compilação falha com `import pack not found`.
- **Não esqueça o `display: block`** no CSS.
- **Não esqueça o guard `dataset.deltaReady`** no `connectedCallback`.

---

## 8. Próximos passos

**`window.Delta`** é a API estável que o runtime expõe aos pacotes, com três membros:
`Delta.popover(trigger, content)` (o controlador de balão compartilhado, usado por `<hint>` e
`<cite>`), `Delta.t(chave, padrão)` (string de UI localizada para o `lang` do documento — use
sempre isto em vez de cravar texto visível em português ou inglês) e `Delta.deck` (o handle da
apresentação, ou `null` fora de um deck). A tabela completa está em
[AUTHORING_PACKAGES.md](AUTHORING_PACKAGES.md).

**Para publicar no npm**, não monte o esqueleto à mão:

```bash
delta create package delta-quote   # package.json, src/, test/, build com esbuild
cd delta-quote && npm install
npm run build && npm test
```

**O que um pacote não pode fazer:** pacotes são exclusivamente de runtime. Não rodam nenhum
código no compilador, então não conseguem numerar ambientes, registrar um tipo de `<ref>`, ler
arquivos nem participar do sumário. Um recurso que precise disso tem que ser implementado no
próprio Delta — ver [PACKAGES.md](PACKAGES.md).

## Veja também

- [AUTHORING_PACKAGES.md](AUTHORING_PACKAGES.md) — a referência: manifesto completo, tabela de
  tokens `--delta-*`, contrato de estilo, minificação, checklist de publicação.
- [PACKAGES.md](PACKAGES.md) — o design do sistema: os três canais de resolução, por que o core
  é monolítico, o que fica de primeira mão.
- [`../examples/imports/mod/`](../examples/imports/mod/) — um pacote mínimo de verdade
  (`<callout>`), usado por [`../examples/hello.dlt`](../examples/hello.dlt).
- [`../src/runtime/elements/`](../src/runtime/elements/) — os elementos do próprio Delta. Comece
  por `box.ts` (levanta um filho, lê atributos) e `columns.ts` (tag filha não registrada,
  `data-*` lido pelo CSS).
- [`../src/styles/base.css`](../src/styles/base.css) — a lista autoritativa de tokens.
