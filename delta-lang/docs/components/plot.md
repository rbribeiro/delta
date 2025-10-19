# Componentes de Plotagem

Os componentes de plotagem são componentes delta que permitem a criação de uma grade que pode desenhar gráficos (a princípio, bidimensionais).

## Function

O componente function representa uma função arbitrária dada por alguma expressão analítica.

***Pendente***

## Plot

O componente plot é o componente base para criar um gráfico genérico. Ele consiste de uma grade bidimensional de limites fixos, desenhando no gráfico por meio de subcomponentes adicionais, como funções.

**Definição**:
```
plot x "A,B" y "C,D" size "E,F" grid "G" axis "H" x_label "I" y_label "J":
	CONTENT
```

Parâmetros:
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
- x_label $\rightarrow$ I = string (default = X):
	- Recebe uma string representando o texto a ser mostrado no eixo X.
- y_label $\rightarrow$ J = string (default = Y):
	- Recebe uma string representando o texto a ser mostrado no eixo Y.