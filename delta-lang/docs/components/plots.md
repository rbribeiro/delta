# Componentes de Plotagem

Os componentes de plotagem são componentes delta que permitem a criação de uma grade que pode desenhar gráficos (a princípio, bidimensionais).

## Plot

O componente plot é o componente base para criar um gráfico genérico. Ele consiste de uma grade bidimensional de limites fixos, desenhando no gráfico por meio de subcomponentes adicionais, como funções, legenda, dentre outros. Subcomponentes listados nesse documento são subcomponentes exclusivos do plot, que não fazem sentido de serem usados sozinhos.

**Definição**:
```
plot "T" x "A,B" y "C,D" size "E,F" grid "G" axis "H" x-label "I" y-label "J":
    CONTENT
```

**Parâmetros**:
- data-title (unnamed parameter) $\rightarrow$ T = string (default = null):
    - Recebe uma string representando o título do plot, que será renderizado em um componente separado que precede o plot.
- x $\rightarrow$ A = float (default = 0), B = float (default = 1):
    - Recebe uma tupla de números em ponto flutuante (A,B) designando o intervalo mostrado no eixo x visível no plot.
- y $\rightarrow$ C = float (default = 0), D = float (default = 1):
    - Recebe uma tupla de números em ponto flutuante (C,D) designando o intervalo mostrado no eixo x visível no plot.
- size $\rightarrow$ E = float $\in (0,1]$ (default = 0.9), F = float $>0$ (default = 0.5):
    - Recebe uma tupla de números em ponto flutuante (E,F) designando por E a porcentagem da largura disponível usada como largura do plot e por F a mesma unidade, mas usada como altura do plot.
- grid $\rightarrow$ G = bool (default = True):
    - Recebe um booleano representando se a grade deve ser mostrada ou não.
- axis $\rightarrow$ H = bool (default = True):
    - Recebe um booleano representando se os eixos devem ser mostrados ou não.
- x-label $\rightarrow$ I = string (default = X):
    - Recebe uma string representando o texto a ser mostrado no eixo X.
- y-label $\rightarrow$ J = string (default = Y):
    - Recebe uma string representando o texto a ser mostrado no eixo Y.

## Function

O subcomponente function representa uma função arbitrária dada por alguma expressão analítica. Funções vão obedecer uma sintaxe próxima da sintaxe do javascript, apenas com fatores adicionais de conveniência e funções adicionais. Em cada linha de conteúdo, recebe-se uma expressão com x, e se não for a primeira linha, com y.

**Definição**:
```
function "F" domain "A,B" range "C,D" points "E" color "F":
    CONTENT 1
    CONTENT 2
    ...
    CONTENT N
```

**Parâmetros**:
- data-title (unnamed parameter) $\rightarrow$ F = string (default = null):
    - Recebe uma string representando um título identificador para a função. Utilizado como prioridade para a legenda do plot se incluído.
- from $\rightarrow$ A = float (default = 0), B = float (default = 1):
    - Recebe uma tupla de números em ponto flutuante (A,B) designando o domínio da função: um intervalo onde apenas pontos x pertencentes a esse intervalo serão mostrados no gráfico.
- to $\rightarrow$ C = float (default = 0), D = float (default = 1):
    - Recebe uma tupla de números em ponto flutuante (C,D) designando o contradomínio da função: um intervalo onde apenas pontos x onde f(x) pertence a esse intervalo serão mostrados no gráfico.
- points $\rightarrow$ E = integer (default = 200):
    - Recebe um inteiro representando o número de pontos a serem coletados para amostrar a aproximação do gráfico.
- color $\rightarrow$ F = string (default = cor dependente do número da função no plot):
    - Recebe uma string com o nome ou código de uma cor para designar a sua função.

**Mecânicas Implementadas**:

*Nível 0 - Já Implementado por Javascript*
```
x
0-9 .
+ - / *
( )
%
| ~
```

*Nível 1 - Adiciona o Prefixo Math*
```
abs
sqrt cbrt
sin cos tan asin acos atan
sinh cosh tanh asinh acosh atanhfe
sign round floor ceil
max min
log2 log10 log
```

*Nível 2 - Converção por Substituição*

```
pi e
^
^^
```

pi $\rightarrow$ 3.141592653589 (Constante pi)

 e $\rightarrow$ 2.718281828459 (Constante e)

 ^ $\rightarrow$ ** (Operação de potência)

^^ $\rightarrow$ ^ (Operação de ou exclusivo)

gcd $\rightarrow$ Função gcd de máximo divisor comum

lcm $\rightarrow$ Função lcm de mínimo múltiplo comum

C ? A : B $\rightarrow$ Piecewise Functions. Funções que são definidas de forma diferente conforme o domínio. Possíveis usando operadores ternários, onde C é a condição booleana, A o valor caso a condição seja verdadeira e B caso seja falsa.

**Mecânicas Ainda Não Implementadas**:

??? $\rightarrow$ Função log em uma base específica $B$

??? $\rightarrow$ Função $\binom{a}{b}$ - $a$ escolhe $b$

??? $\rightarrow$ Operação de Somatório

??? $\rightarrow$ Operação de Produtório

??? $\rightarrow$ Fatorial e Fatoriais Múltiplos

## Legend

O subcomponente legend representa um objeto de legenda pertencente ao plot. Apenas o primeiro componente desse tipo é considerado, ignorando os demais. Ele é quem define como será mostrada a legenda e quais objetos do plot serão considerados nela.

**Definição**:
```
legend objects "A" position "B" fixed "C" opacity "D" size "E,F":
```

**Parâmetros**:
- objects $\rightarrow$ A = tuple string (default = 'all'):
    - Recebe uma string representando uma tupla de todos os elementos que devem ser considerados na legenda. Cada elemento da tupla pode ser um inteiro positivo ou uma palavra entre as opções 'all', 'functions', dentre outras opções futuras, que representam os tipos dos objetos a serem considerados. Inteiros positivos $k$ representam que o $k$-ésimo objeto na ordem dada pelo objeto plot será considerado.
	- Os elementos considerados pela legenda serão a união de todos os elementos da tupla.
- position $\rightarrow$ B = tuple string (default = 'top right'):
    - Recebe informações sobre a posição da legenda no plot. Pode ser uma tupla de números em ponto flutuante representando a porcentagem de quanto para a direita e quanto para baixo a legenda deve estar e também pode ser uma string entre as opções 'top right', 'top left', 'bottom right', 'bottom left'.
- fixed $\rightarrow$ C = bool (default = False):
    - Recebe uma booleano indicando se a opção da legenda ser móvel deve ser desativada, isto é, a legenda deve ser fixa.
- opacity $\rightarrow$ D = float $\in [0,1]$ (default = 0.8):
	- Recebe um número real de 0 até 1 representando a opacidade desejada da legenda.
- size $\rightarrow$ E = float $\in [0.1,0.8]$ (default = 0.3), F = float $\in [0.1,0.8]$ (default = 0.4):
    - Recebe uma tupla de números em ponto flutuante (E,F) designando por E a porcentagem da largura disponível usada como largura da legenda e por F a mesma unidade, mas usada como altura da legenda.