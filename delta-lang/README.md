# Delta Language

A markup language for scientific papers with Python-like indentation syntax.

## 🌟 Features

- 🐍 **Python-like syntax** - Uses indentation for structure, familiar to developers
- 📐 **Mathematical notation** - Built-in LaTeX math support with MathJax
- 🧩 **Structured blocks** - Theorems, definitions, proofs, lemmas, examples, and more
- 🌐 **Web-ready** - Generates semantic HTML with custom elements
- 📱 **Responsive** - Works beautifully on desktop and mobile
- 🎨 **Customizable styling** - Clean, professional appearance with CSS theming
- 📤 **Export ready** - Generate standalone HTML files that work anywhere

## 🚀 Quick Start

### Browser (CDN)

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/delta-lang/dist/delta.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/delta-lang/dist/delta.css">
</head>
<body>
    <div id="document"></div>
    
    <script>
        const deltaText = `
# My Research Paper

theorem "Main Result":
    For any mathematical structure $S$, there exists a unique
    solution to our problem.
    
    proof:
        The proof follows from the fundamental theorem.
        $$\\int_0^1 f(x) dx = \\frac{1}{2}$$
        
definition "Important Concept":
    A *fundamental structure* is one that satisfies
    all the required properties.
        `;

        document.getElementById('document').innerHTML = Delta.compile(deltaText);
    </script>
</body>
</html>
```

### Local Development

```html
<!-- Include individual source files for development -->
<link rel="stylesheet" href="delta-lang/src/styles/delta.css">
<script src="delta-lang/src/core/parser.js"></script>
<script src="delta-lang/src/renderer/html-renderer.js"></script>
<script src="delta-lang/src/components/custom-elements.js"></script>
```

### Node.js/CLI

```bash
npm install -g delta-lang
delta compile paper.dlt --output paper.html
```

## 📝 Syntax Overview

Delta uses Python-like indentation to create structured documents:

```delta
# Document Title

## Section

theorem "Fundamental Theorem":
    This is the main result of our paper.
    
    proof:
        The proof is straightforward:
        1. First, we observe that...
        2. Then, we apply the lemma.
        
        $$f(x) = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}$$

definition "Key Definition":
    A *widget* is a mathematical object with special properties.

lemma "Helper Result", reference="lemma1":
    This supports our main theorem.

example:
    Consider the case where $x = 0$.
```

## 🎯 Block Types

Delta supports various mathematical and academic block types:

- **theorem** - Main mathematical results
- **definition** - Concept definitions  
- **lemma** - Supporting results
- **proof** - Mathematical proofs
- **proposition** - Mathematical statements
- **corollary** - Results that follow from theorems
- **example** - Illustrative examples
- **note** - Additional remarks
- **equation** - Numbered equations

## 📚 Documentation

- [📖 Syntax Guide](docs/syntax.md) - Complete syntax reference
- [🔧 API Reference](docs/api.md) - JavaScript API documentation
- [🧩 Block Types](docs/blocks.md) - Detailed block type reference

## 🏗️ Project Structure

```
delta-lang/
├── src/                    # Source files
│   ├── core/              # Core parsing logic
│   ├── renderer/          # Output generators
│   ├── components/        # Web components
│   └── styles/           # CSS styling
├── dist/                  # Built bundles
├── docs/                  # Documentation
├── examples/              # Usage examples
├── tests/                 # Test files
└── tools/                 # Build and CLI tools
```

## 🤝 Contributing

Contributions are welcome! Please see our contributing guidelines.

## 📄 License

MIT License - see LICENSE file for details.

## 🌟 Why Delta?

Traditional academic writing tools like LaTeX can be intimidating and have steep learning curves. Delta provides:

- **Familiar syntax** for developers who know Python
- **Instant preview** in web browsers
- **Lightweight** - no complex installation required
- **Modern output** - responsive HTML instead of PDF-only
- **Collaboration friendly** - works with standard web tools

Perfect for researchers, professors, and students who want to focus on content rather than formatting!