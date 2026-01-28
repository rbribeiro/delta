/*
    Dicionário de definição dos operadores disponíveis e:
    - sua ordem de precedência, número de argumentos, associatividade, expressão correspondente.
*/
const UNARY_PRIORITY = 100;
const operators = {
    '(': [0, 'parenthesis', 'none', '('],
    ')': [0, 'parenthesis', 'none', ')'],
    '+': [1, 'binary', 'left-assoc', (a,b) => `(${a}+${b})`],
    '-': [1, 'binary', 'left-assoc', (a,b) => `(${a}-${b})`],
    '*': [2, 'binary', 'left-assoc', (a,b) => `(${a}*${b})`],
    '/': [2, 'binary', 'left-assoc', (a,b) => `(${a}/${b})`],
    ',': [2, 'binary', 'left-assoc', (a,b) => `${a},${b}`],
    '^': [3, 'binary', 'right-assoc', (a,b) => `(${a}**${b})`],
    '~': [UNARY_PRIORITY, 'unary', 'right-assoc', (a) => `(~${a})`],
    'negative': [UNARY_PRIORITY, 'unary', 'right-assoc', (a) => `(-${a})`],
};

// Funções criadas para serem chamadas com Math.X
const content_mathFunctions = [
	'abs', 'sqrt', 'cbrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
	'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'sign', 'round',
	'floor', 'ceil', 'max', 'min', 'log2', 'log10', 'log'
]

for(let f of content_mathFunctions){
    operators[f] = [UNARY_PRIORITY, 'unary', 'right-assoc', (a) => `Math.${f}(${a})`]
}

/*
    Lista de palavras que agem como identificadores: variável x, constantes
*/
const identifiers = {
    'pi': Math.PI,
    'e': Math.E,
    'x': 'x'
};

/*
    Quebra a function string em tokens e tenta identificar esses tokens
*/
function tokenize(input) {
    const build_operator_regex = () => {
        const keys = Object.keys(operators);
        const escapeChar = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = keys
            .sort((a, b) => b.length - a.length)
            .map(escapeChar)
            .join('|');
        return `(?:${pattern})`;
    };

    const numbersRegex = /(?:\d*\.\d+|\d+)/;
    const wordsRegex = /[a-zA-Z_][a-zA-Z0-9_]*/;
    const operatorsRegex = build_operator_regex();
    const combinedPattern = `${operatorsRegex}|${numbersRegex.source}|${wordsRegex.source}`;
    const regex = new RegExp(combinedPattern, 'g');
    const rawTokens = input.match(regex) || [];
    if (!rawTokens) return [];
    let tokens = [];

    for (let i = 0; i < rawTokens.length; i++) {
        let t = rawTokens[i];
        let lastToken = (tokens.length > 0 ? tokens[tokens.length - 1] : null);

        if (t in operators) {
            let val = t;
            if (t === '-') {
                const isUnary = lastToken == null || 
                                lastToken.value === '(' || 
                                (lastToken.type === 'OPERATOR' && operators[lastToken.value][1] !== 'parenthesis');
                if (isUnary) val = 'negative';
            }
            tokens.push({ type: 'OPERATOR', value: val, spec: operators[val][1], expr: operators[val][3]});
            continue;
        }
        if (numbersRegex.test(t)) {
            tokens.push({ type: 'NUMBER', value: parseFloat(t) });
            continue;
        }
        if (t in identifiers) {
            tokens.push({ type: 'IDENTIFIER', value: t, expr: identifiers[t]});
            continue;
        }
    }

    return tokens;
}

/*
    Converte uma sequência de tokens para a notação pós-fixa, isto é, os operadores aparecem depois dos termos, e não no meio/antes.
*/
function to_postfix(tokens) {
    const outputQueue = [];
    const operatorStack = [];

    for (let token of tokens) {
        if (token.type === 'NUMBER' || token.type === 'IDENTIFIER') {
            outputQueue.push(token);
        } else if (token.value === '(') {
            operatorStack.push(token);
        } else if (token.value === ')') {
            while (operatorStack.length && operatorStack[operatorStack.length - 1].value !== '(') {
                outputQueue.push(operatorStack.pop());
            }
            operatorStack.pop();
        } else if (token.type === 'OPERATOR') {
            const o1 = token.value;
            const [p1, type1, assoc1] = operators[o1];

            while (operatorStack.length) {
                const o2Token = operatorStack[operatorStack.length - 1];
                if (o2Token.value === '(') break;

                const [p2, type2, assoc2] = operators[o2Token.value];

                if (p2 > p1 || (p2 === p1 && assoc1 === 'left-assoc')) {
                    outputQueue.push(operatorStack.pop());
                } else {
                    break;
                }
            }
            operatorStack.push(token);
        }
    }
    while (operatorStack.length) {
        outputQueue.push(operatorStack.pop());
    }
    return outputQueue;
}

function build_evaluator(infix) {
    let postfix = to_postfix(tokenize(infix))
    const stack = [];

    for (let token of postfix) {
        if (token.type === 'NUMBER') {
            stack.push(token.value);
        } else if (token.type === 'IDENTIFIER') {
            stack.push(token.expr)
        } else if (token.type === 'OPERATOR') {
            if (token.spec === 'unary') {
                if(stack.length < 1){
                    return [`Operador ${token.value} não possui argumentos o suficiente.`]
                }
                const a = stack.pop();
                stack.push(token.expr(a))
            } else {
                if(stack.length < 2){
                    return [`Operador ${token.value} não possui argumentos o suficiente.`];
                }
                const b = stack.pop();
                const a = stack.pop();
                stack.push(token.expr(a,b))
            }
        }
    }
    if (stack.length !== 1) return [`Termos demais na expressão matemática ou operadores inválidos utilizados.`];
    try {
        return ['OK', new Function('x', `return ${stack[0]};`)];
    } catch (e) {
        return [`Erro de compilação: ${e.message}`];
    }
}

function stress_test(){
    test = [
        ['2 + 2 + 3 + 4 - 3 + 1 + 1 - 6',                   0,                              4],
        ['2 * 3 + 5',                                       0,                              11],
        ['5 + 2*3 + 1',                                     0,                              12],
        ['x^2 + 2*x + 1',                                   1,                              4],
        ['x^x^x+x^x+x',                                     3,                              7625597485017],
        ['2^x',                                             7,                              128],
        ['x^2',                                             7,                              49],
        ['2^x*x^2+2^2*x^x',                                 5,                              13300],
        ['abs(x)',                                          -9,                             9],
        ['x^2+7*x-4*abs(x)',                                -3,                             -24],
        ['sqrt(abs(x))',                                    -7,                             Math.sqrt(7)],
        ['log2(1024)',                                      0,                              10],
        ['log2(2^x)^2-2*x+1',                               11,                             100],
        ['log(e^x)^log10(10^x)*3',                          2,                              12],
        ['logsqrt(e^2^x)',                                  3,                              4],
        ['signlog(2^-x) + signlog(2^-(-x))',                60,                             0],
        ['-3+-3-x+-x',                                      12,                             -30],
        ['1.135^-3.5531*x',                                 2,                              2*1.135**(-3.5531)],
    ]

    let stringy = ''
    for(let i = 0; i < test.length; i++){
        let r = build_evaluator(test[i][0])
        if(r.length == 1){
            console.log(test[i][0])
            console.log(to_postfix(tokenize(test[i][0])))
            console.log(r[0])
            stringy += '2'
            continue;
        } 
        let f = r[1]
        let fx = f(test[i][1])
        if(fx === test[i][2]){
            stringy += '0'
        } else {
            console.log(`${fx} is wrong, should be ${test[i][2]}`)
            stringy += '1'
        }
    }
    console.log(stringy)
    return stringy
}
stress_test()
