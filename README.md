## **DELTA**

> A nova forma de escrever matemática

O **DELTA** é uma nova linguagem que visa simplificar a criação de documentos matemáticos. A solução da linguagem **DELTA** surgiu para superar as limitações do PDF. Enquanto o PDF mantém o conhecimento estático, o formato `.delta` transforma o aprendizado em uma experiência viva. Com ele, você integra vídeos, elementos interativos e recursos avançados de HTML diretamente no fluxo do texto, mesmo que você não saiba nada de programação.


---

## Por que o DELTA?

O Delta surgiu para simplificar o trabalho de formatação em LaTeX, propondo-se como um **editor** e **compilador** focado no conteúdo, sem a aparência de código.
Como escrever em LaTeX pode intimidar os iniciantes os quais não tem familiaridade com programação, o Delta busca tornar esse processo mais acessível. Além disso, ao desenvolvermos nosso próprio editor temos a liberdade para incorporar elementos interativos que enriquecem a experiência de leitura digital (adaptação do conteúdo à tela ou aumento de fonte) 


---

## Exemplo Comparativo

Veja como é mais simples definir um título e subtítulo no DELTA em comparação ao LaTeX tradicional:

| Recurso | Sintaxe DELTA | LaTeX Tradicional |
| :--- | :--- | :--- |
| **Título** | `# Título` | `\title{Título}` |
| **Seção** | `## Seção` | `\section{Seção}` |
| **Teorema** | `theorem "Título":` | `\begin{theorem}...\end{theorem}` |
| **Prova** | `proof:` | `\begin{proof}...\end{proof}` |
| **Definição** | `definition "Título":` | `\begin{definition}...\end{definition}` |
| **Lema** | `lemma "Título":` | `\begin{lemma}...\end{lemma}` |
| **Exemplo** | `example:` | `\begin{example}...\end{example}` |
| **Ênfase (itálico)** | `*texto*` | `\emph{texto}` |
| **Lista numerada** | `1. Item` | `\begin{enumerate}...\end{enumerate}` |

  ## Exemplo de Documento em DELTA
A linguagem DELTA foi pensada para que você escreva matemática de forma natural, como se estivesse redigindo um texto comum, sem se preocupar com comandos técnicos ou estrutura de código. Títulos, teoremas, definições e provas são escritos de maneira direta e legível, enquanto fórmulas continuam usando a notação matemática padrão. O objetivo é que seu foco esteja totalmente no conteúdo — não na formatação.


    ```delta
    # Introdução à Análise Matemática

    ## Continuidade

    definition "Função contínua":
        Dizemos que uma função $f: \mathbb{R} \to \mathbb{R}$ é contínua em um ponto $a$ se
        $$\lim_{x \to a} f(x) = f(a).$$

    theorem "Teorema do Valor Intermediário":
        Seja $f$ contínua em $[a,b]$. Se $f(a) < 0 < f(b)$, então existe $c \in (a,b)$ tal que
        $$f(c) = 0.$$

        proof:
            Como $f$ é contínua em $[a,b]$, sua imagem é um intervalo.
            Como $0$ está entre $f(a)$ e $f(b)$, segue o resultado.

    example:
        Considere $f(x) = x^3 - 1$. Temos $f(0) = -1$ e $f(1) = 0$, logo existe
        $c \in (0,1)$ tal que $f(c) = 0$.

---

## Funcionalidades Principais

* **Renderização Instantânea:** Visualize as alterações no layout em tempo real.
* **Mapeamento Automático:** Conversão inteligente de tags Delta para HTML semântico.
* **Layout Responsivo:** Ajuste automático de largura e tamanho de fonte para leitura em qualquer dispositivo.
* **Barra Lateral de Navegação:** Sumário automático para documentos longos e capítulos.

---

## Requisitos do Sistema

Antes de começar, certifique-se de ter instalado:
* **Python:** Versão 3.8 ou superior.
* **Dependências:** Listadas no arquivo `requirements.txt` (A SER ESCRITO).

---

##  Guia de Instalação

1. Clone o repositório:
   ```bash
   git clone (https://github.com/rbribeiro/delta.git)

2. Acesse a pasta do projeto:
    ```bash
    cd delta/editor

3. Execute o arquivo `index.html` utilizando um servidor local.

# Licença

Este projeto está licenciado sob a Licença Creative Commons Atribuição–NãoComercial 4.0 Internacional.

[![Licença: CC BY-NC 4.0](https://i.creativecommons.org/l/by-nc/4.0/88x31.png)](http://creativecommons.org/licenses/by-nc/4.0/)

Você é livre para:

- **Compartilhar** — copiar e redistribuir o material em qualquer meio ou formato  
- **Adaptar** — remixar, transformar e criar a partir do material  

Sob os seguintes termos:

- **Atribuição** — Você deve dar o crédito apropriado, fornecer um link para a licença e indicar se alterações foram feitas. Isso pode ser feito de qualquer maneira razoável, desde que não sugira que o licenciante endossa você ou seu uso.
- **NãoComercial** — Você não pode usar o material para fins comerciais.

Leia a licença completa [aqui](http://creativecommons.org/licenses/by-nc/4.0/).

