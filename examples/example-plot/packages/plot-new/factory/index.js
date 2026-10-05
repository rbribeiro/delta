// Function Factory Logic
// Parses a math expression with a shunting-yard pass and compiles it to a JS function.
// Only whitelisted tokens become code, so arbitrary JS in <function> never runs.

const FN_NAMES = [
    "abs", "sqrt", "cbrt", "sin", "cos", "tan", "asin", "acos", "atan",
    "sinh", "cosh", "tanh", "asinh", "acosh", "atanh", "sign", "round",
    "floor", "ceil", "max", "min", "log2", "log10", "log"
];

const FN_CONSTANTS = { pi: "Math.PI", e: "Math.E"};

const FN_OPERATORS = {
    ",":   { prec: 0, assoc: "left",  arity: 2, emit: (a, b) => [...[a].flat(), b] },
    "+":   { prec: 1, assoc: "left",  arity: 2, emit: (a, b) => `(${a}+${b})` },
    "-":   { prec: 1, assoc: "left",  arity: 2, emit: (a, b) => `(${a}-${b})` },
    "*":   { prec: 2, assoc: "left",  arity: 2, emit: (a, b) => `(${a}*${b})` },
    "/":   { prec: 2, assoc: "left",  arity: 2, emit: (a, b) => `(${a}/${b})` },
    "neg": { prec: 3, assoc: "right", arity: 1, emit: (a) => `(-${a})` },
    "^":   { prec: 4, assoc: "right", arity: 2, emit: (a, b) => `(${a}**${b})` }
};
FN_OPERATORS["**"] = FN_OPERATORS["^"];

// Functions are prefix unary operators; "," builds their argument list
for (const name of FN_NAMES) {
    FN_OPERATORS[name] = { prec: 5, assoc: "right", arity: 1, fn: true, emit: (a) => `Math.${name}(${[a].flat().join(",")})` };
}

// Converts an infix expression into a JS expression string, throwing on any invalid input
function compileFunctionExpression(expr, vars) {
    const out = [];
    const ops = [];
    let expectOperand = true;

    const apply = (name) => {
        const op = FN_OPERATORS[name];
        if (out.length < op.arity) throw new Error(`faltam argumentos para "${name === "neg" ? "-" : name}"`);
        const args = out.splice(-op.arity);
        if (!op.fn && name !== "," && args.some(Array.isArray)) throw new Error(`"," só separa argumentos de funções`);
        out.push(op.emit(...args));
    };

    const source = String(expr);
    const re = /\s*(?:(\d+\.?\d*|\.\d+)|([A-Za-z_]\w*)|(\*\*|[-+*/^(),]))\s*/y;

    while (re.lastIndex < source.length) {
        const at = re.lastIndex;
        const m = re.exec(source);
        if (!m) throw new Error(`símbolo inválido na posição ${at + 1}`);
        const [token, num, word, sym] = m;

        if ((num !== undefined || word !== undefined || sym === "(") && !expectOperand) {
            throw new Error(`falta um operador antes de "${token.trim()}"`);
        }

        if (num !== undefined) {
            out.push(String(parseFloat(num)));
            expectOperand = false;
        } else if (word !== undefined) {
            if (FN_OPERATORS[word]?.fn) { ops.push(word); continue; }
            if (vars.includes(word)) out.push(word);
            else if (word in FN_CONSTANTS) out.push(FN_CONSTANTS[word]);
            else throw new Error(`nome desconhecido "${word}"`);
            expectOperand = false;
        } else if (sym === "(") {
            ops.push("(");
        } else if (sym === ")") {
            while (ops.length && ops.at(-1) !== "(") apply(ops.pop());
            if (!ops.length) throw new Error(`")" sem "(" correspondente`);
            ops.pop();
            expectOperand = false;
        } else if (expectOperand) {
            if (sym === "-") ops.push("neg");
            else if (sym !== "+") throw new Error(`"${sym}" sem operando à esquerda`);
        } else {
            const op = FN_OPERATORS[sym];
            while (ops.length && ops.at(-1) !== "(") {
                const top = FN_OPERATORS[ops.at(-1)];
                if (top.prec > op.prec || (top.prec === op.prec && op.assoc === "left")) apply(ops.pop());
                else break;
            }
            ops.push(sym);
            expectOperand = true;
        }
    }

    while (ops.length) {
        const name = ops.pop();
        if (name === "(") throw new Error(`"(" sem ")" correspondente`);
        apply(name);
    }
    if (out.length !== 1 || Array.isArray(out[0])) throw new Error("expressão vazia ou incompleta");
    return out[0];
}

// Builds f(...vars) from an expression; returns null (and warns) when it is invalid
function make_function(expr, vars) {
    try {
        return new Function(...vars, `return ${compileFunctionExpression(expr, vars)};`);
    } catch (e) {
        console.warn(`[plot] função inválida "${expr}": ${e.message}`);
        return null;
    }
}
