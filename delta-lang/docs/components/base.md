# Delta Language: Base Components Syntax Help

This document describes the syntax and usage of the base components in Delta Language, focusing on mathematical environments and their generalization to other components.

---

## General Syntax for Math Environments

Supported environments:
- theorem
- proposition
- lemma
- conjecture
- proof
- definition
- example
- exercise

**Syntax:**
```
<environment> "optional title", level (optional) "level name: easy, medium, hard"
	Content goes here.
	step:
		Step content (for proof)
	hint:
		Optional hint for the reader
```

**Examples:**
```
theorem "Fundamental Theorem of Algebra", level "hard"
	Every non-constant polynomial has at least one complex root.

lemma "Key Lemma"
	This lemma is used in the main proof.

conjecture
	The Riemann Hypothesis is true.

proof
	step:
		Assume the contrary.
	step:
		Derive a contradiction.
	hint:
		Recall the definition of polynomial.
```




**Notes:**
- Indentation is significant and determines nesting.
- Components can be nested (e.g., steps and hints inside proofs).
- Use `hint:` to provide optional guidance to the reader.
- The `level` attribute is optional and can be used to indicate difficulty or hierarchy.

For more details, see the [Delta Language Syntax Guide](../syntax.md).
