# Componentes

- base
- citations 
- equations 
- interactive-ui 
- math-blocks +/-
- media 
- plots +

# Componetes de teste no editor

headings

+ theorem *
- equation
+ exercise
+ definition
- proof
- note
+ lemma
- example 
+ plot 


# Ideias de Componentes  

- project


# Outras Ideias:

- Como fazer comentários no texto-código?
- Metadados?
- Renderizar a sintaxe do markdown, como já foi feito para os heandings


## Bugs indentificados: 
- Quebra de linha no texto dentro do bloco theorem
- Formatação não está sendo exportada  corretamente 


## Exemplo do Quarto

project:
  type: book

book:
  title: "mybook"
  author: "Jane Doe"
  date: "8/18/2021"
  chapters:
    - index.qmd
    - intro.qmd
    - summary.qmd
    - references.qmd

bibliography: references.bib

format:
  html:
    theme: cosmo
  pdf:
    documentclass: scrreprt
  epub:
    cover-image: cover.png
    

# Fontes

    "Computer Modern Serif"
    "Computer Modern Sans"

"Arial"
"Times New Roman"
+futuramente


