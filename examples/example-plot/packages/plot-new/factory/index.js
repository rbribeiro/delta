// Function Factory Logic
function make_function(expr, vars) {
    try {
        const body = `
            try {
                const res = ${expr};
                return Number.isNaN(res) ? null : res;
            } catch (e) {
                return null;
            }
        `;
        return new Function(...vars, body);
    } catch (e) {
        return null;
    }
}
