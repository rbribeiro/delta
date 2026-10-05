# Function Factory

`make_function(expr, vars)` transforma o texto de um `<function>` em uma função JavaScript `f(x, y)`.

A expressão passa por uma variação do algoritmo **shunting-yard**: cada pedaço do texto é reconhecido como número, variável, constante, operador ou função, e só esses pedaços conhecidos viram código. Qualquer outra coisa (`alert(1)`, `x[0]`, `;`) invalida a expressão, então nenhum JavaScript arbitrário é executado e deixa o código mais seguro.

- Expressão válida: retorna a função compilada.
- Expressão inválida: retorna `null` e mostra um aviso no console (`[plot] função inválida "...": motivo`). A curva não é desenhada.

## Recursos Suportados

| Recurso | Exemplo | Observação |
| :--- | :--- | :--- |
| Números inteiros e decimais | `3`, `2.5`, `.5`, `2.` | Sem notação científica (`1e3`) |
| Variável `x` | `x^2` | Varia ao longo do eixo horizontal |
| Variável `y` | `y` | Reservada; hoje sempre vale `0` |
| Constantes | `pi`, `e` | Somente minúsculas |
| Parênteses | `(x + 1) * 2` | Precisam estar balanceados |
| Funções com vários argumentos | `max(x, 1, -x)` | `,` só é aceita dentro de funções |
| Funções sem parênteses | `sin x` | Pega só o próximo termo: `sin x^2` = `(sin x)^2` |
| Espaços | `x+1` ou `x + 1` | Indiferente |

**Não suportado:** multiplicação implícita (`2x`, `2(x+1)`, `x sin(x)`; use `*`), atribuições, comparações e qualquer nome fora das listas abaixo.

## Operadores

Da menor para a maior precedência:

| Operador | Uso | Significado | Associatividade |
| :--- | :--- | :--- | :--- |
| `,` | `max(a, b)` | Separa argumentos | esquerda |
| `+` `-` | `x + 1`, `x - 1` | Soma e subtração | esquerda |
| `*` `/` | `2 * x`, `x / 2` | Multiplicação e divisão | esquerda |
| `-` (unário) | `-x`, `2 * -x` | Negação | direita |
| `+` (unário) | `+x` | Ignorado | — |
| `^` ou `**` | `x^2`, `x**2` | Potência | direita |
| funções | `sin(x)` | Aplicação de função | direita |

Consequências práticas:

- `-x^2` é `-(x^2)`, não `(-x)^2`.
- `2^-x` é `2^(-x)`.
- `x^2^0.5` é `x^(2^0.5)` (potência associa à direita).
- `sin(x)^2` é `(sin(x))^2`.
- `1 - 2 - 3` é `(1 - 2) - 3`.

## Funções

Todas mapeiam para a função de mesmo nome em `Math`.

| Grupo | Funções | Exemplo |
| :--- | :--- | :--- |
| Raízes e módulo | `sqrt`, `cbrt`, `abs` | `sqrt(abs(x))` |
| Trigonométricas | `sin`, `cos`, `tan` | `sin(2 * x)` |
| Trigonométricas inversas | `asin`, `acos`, `atan` | `atan(x)` |
| Hiperbólicas | `sinh`, `cosh`, `tanh` | `tanh(x)` |
| Hiperbólicas inversas | `asinh`, `acosh`, `atanh` | `asinh(x)` |
| Logaritmos | `log` (natural), `log2`, `log10` | `log(x)` |
| Arredondamento | `floor`, `ceil`, `round` | `floor(x)` |
| Sinal | `sign` | `sign(x)` |
| Extremos (2+ argumentos) | `max`, `min` | `max(sin(x), 0)` |

Ângulos em radianos. Pontos fora do domínio (ex.: `sqrt(-1)`, `log(0)`) geram `NaN`/`Infinity` e simplesmente não são desenhados.