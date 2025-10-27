# Componentes de Plotagem

Os componentes de plotagem são componentes delta que permitem a criação de uma grade que pode desenhar gráficos (a princípio, bidimensionais).

## Function

O componente function representa uma função arbitrária dada por alguma expressão analítica. Funções vão obedecer uma sintaxe próxima da sintaxe do javascript, apenas com fatores adicionais de conveniência e funções adicionais. Em cada linha de conteúdo, recebe-se uma expressão com x, e se não for a primeira linha, com y.

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
    - Recebe uma string representando um título identificador para a função. Ainda inutilizado, para pode ser usado futuramente para chamarmos um função por exemplo de "f" e criar outra função que faça operações usando f, como "f(x)+3+f(3x)*f(4x)".
- from $\rightarrow$ A = float (default = 0), B = float (default = 1):
    - Recebe uma tupla de números em ponto flutuante (A,B) designando o domínio da função: um intervalo onde apenas pontos x pertencentes a esse intervalo serão mostrados no gráfico.
- to $\rightarrow$ C = float (default = 0), D = float (default = 1):
    - Recebe uma tupla de números em ponto flutuante (C,D) designando o contradomínio da função: um intervalo onde apenas pontos x onde f(x) pertence a esse intervalo serão mostrados no gráfico.
- points $\rightarrow$ E integer (default = 200):
    - Recebe um inteiro representando o número de pontos a serem coletados para amostrar a aproximação do gráfico.
- color $\rightarrow$ F string (default = cor dependente do número da função no plot):
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

**Mecânicas Ainda Não Implementadas**:

??? $\rightarrow$ Função log em uma base específica $B$

??? $\rightarrow$ Função $\binom{a}{b}$ - $a$ escolhe $b$

??? $\rightarrow$ Operação de Somatório

??? $\rightarrow$ Operação de Produtório

??? $\rightarrow$ Fatorial e Fatoriais Múltiplos

??? $\rightarrow$ Piecewise Functions - Funções que são definidas de forma diferente conforme o domínio **Observação: Já podemos usar operador ternário então é possível**

## Plot

O componente plot é o componente base para criar um gráfico genérico. Ele consiste de uma grade bidimensional de limites fixos, desenhando no gráfico por meio de subcomponentes adicionais, como funções.

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
- size $\rightarrow$ E = float $\in (0,1]$ (default = 0.8), F = float $>0$ (default = 0.5):
    - Recebe uma tupla de números em ponto flutuante (E,F) designando por E a porcentagem da largura disponível usada como largura do plot e por F a mesma unidade, mas usada como altura do plot.
- grid $\rightarrow$ G = bool (default = True):
    - Recebe um booleano representando se a grade deve ser mostrada ou não.
- axis $\rightarrow$ H = bool (default = True):
    - Recebe um booleano representando se os eixos devem ser mostrados ou não.
- x-label $\rightarrow$ I = string (default = X):
    - Recebe uma string representando o texto a ser mostrado no eixo X.
- y-label $\rightarrow$ J = string (default = Y):
    - Recebe uma string representando o texto a ser mostrado no eixo Y.