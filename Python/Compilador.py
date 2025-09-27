import re
from random import uniform
import argparse

MATHEX = ['\\[', '\\]', '$$']
CHARESC = ['\\"', '\\#', '\\(', '\\)', '\\:', '\\\\', '\\}','\\&']
PRETXT = {'0':'<main>\n', '1':'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Mathematical Paper</title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-chtml.js"></script>
   <link rel="stylesheet" href="rodrigo_ribeiro.css">
</head>
<body>

    <main class="paper-content">\n'''}
POSTXT = {'0':'''\n</main>
<script src="script/load_page.js"></script>''', '1':'''\n    </main>
<script>
MathJax = {
  tex: {
    inlineMath: {'[+]': [['$', '$']]}
  },
  svg: {
    fontCache: 'global'
  }
};
</script>

    <script src="linear_transformation.js"></script>

</body>
</html>
'''}

def processar_texto(entrada, tipo):
    '''Use **[conteúdo]** para <b>[conteúdo]<\\b>, em uma mesma linha.
    Use *[conteúdo]* para <i>[conteúdo]<\\i>, em uma mesma linha.
    Use *{[tag] [atributos]}[conteúdo]* para <[tag] [atributos]>[conteúdo]<\\tag>, em uma mesma linha.
    Use &[número] [conteúdo] para <h[número]>[conteúdo]<\\h[número]>, em uma mesma linha.
    
    Cada tab de mesmo nível para cada aglomerado de linhas consecutivas representa um ambiente.
    Uma tag a mais do que a linha anterior representa um ambiente de nível superior ao anterior.
    Ao deparar-se com uma tab a menos do que a linha anterior, o compilador fecha a tag automaticamente.
    
    É possível criar uma tag como ambiente usando [tag] [atributos]:, resultando por hora em <[tag] [atributos]>.

    OBS: qualquer atributo deve ser feito da seguinte maneira: [nome]:"[conteúdo do atributo]". A separação é feita por meio de espaços. Essas propriedades valem para ambos os casos acima.

    Os ambientes pré-ajustados possíveis neste compilador são "list", "item", "section", "subsection" e "p".

    Para criar listas, basta fazer uma tab mais um "-", seguido do conteúdo dentro do item.
    Para fazer subitens, basta fazer uma tab a mais do que o item anterior, seguida de "-" e seguido do conteúdo dentro do subitem.
    Para escrever coisas dentro dos itens da lista, basta escrever algo com a mesma tab do item, porém sem o "-".

    As seções e suas derivadas não utilizam de tab para se manterem abertas. Uma vez abertas, permanecerão assim até um encontro com outra seção de nível igual ou maior.
    Para fazer seções use "###" seguido do título da seção.
    Para fazer subsseções use "##" seguido do título da subseção.
    Para fazer subsubsseções use "#" seguido do título da subsubseção.

    Para abrir um parágrafo, basta dar um tab a mais do que o ambiente anterior.
    
    Para usar caracteres em situações ambíguas, basta colocar uma barra "\\" antes deles.'''

    def ambientes_math_curtos(entrada):
        a = 0
        ambmath = re.findall(r'(?<!\\)\\\(.*?\\\)(?!\\)', entrada)
        ambmath2 = []
        for _ in range(len(ambmath)):
            while True:
                if str(a) in entrada:
                    a += uniform(0,1000)
                else:
                    break
            entrada = re.sub(r'(?<!\\)\\\(.*?\\\)(?!\\)', str(a), entrada, count=1)
            ambmath2.append(str(a))
        return entrada, ambmath, ambmath2
            
    def substituicao_linha(linha):
        match = re.findall(r'(?<!\\)\*{([^\s]*)(.*?)(?<!\\)}(.*?)(?<!\\)\*', linha) # Tags em uma linha
        for k in match:
            linha = re.sub(r'(?<!\\)\*{([^\s]*)(.*?)(?<!\\)}(.*?)(?<!\\)\*',
                           f'<{k[0]+re.sub(r'([^\s]*):\s*"(.*?)(?<!\\)"',r'\1="\2"',k[1])}>{k[2]}</{k[0]}>', linha, count=1)
        linha = re.sub(r'(?<!\\)\*\*(.*?)(?<!\\)\*\*', r'<b>\1</b>', linha) # Negritos
        linha = re.sub(r'^\s*(?<!\\)&(\d+)\s*"(.*?)(?<!\\)"\s*$', r'<h\1>\2</h\1>', linha) # Heading tags
        linha = re.sub(r'(?<!\\)\*(\S.*?)(?<!\\)\*', r'<i>\1</i>', linha) # Itálicos
        return linha

    entrada, ambmath, ambmath2 = ambientes_math_curtos(entrada) # Ambientes matemáticos curtos
    linhasf = []
    linhas = entrada.split('\n')
    pilha = []
    sec = 0
    pular = 0

    for linha in linhas:
        # Ambiente matemático extenso
        for s in MATHEX:
            if s in linha:
                m = linha.split(s)
                if pular == 0:
                    if m[0].strip() != '':
                        linha = substituicao_linha(m[0]) + s + m[1]
                elif m[1].strip() != '':
                    linha = m[0] + s + substituicao_linha(m[1])
                pular += 1
        if pular >= 1:
            pular %= 2
            linhasf.append(linha)
            continue

        # Negritos, itálicos e tags em linha
        linha = substituicao_linha(linha)

        # Seções
        match2 = re.match(r'^\s*(?<!\\)(#+)\s*"(.*?)(?<!\\)"(.*)$', linha)
        if match2:
            attr = re.sub(r'([^\s]*):\s*"(.*?)(?<!\\)"',r'\1="\2"',match2.group(3))

            for k in range(len(pilha)-sec, 0, -1):
                linhasf.append(' '*(4*k-4) + f'</{pilha.pop()}>')

            for k in range(2,2-len(match2.group(1)),-1):
                if k*'sub' + 'section' in pilha:
                    pilha.remove(k*'sub' + 'section')
                    linhasf.append(' '*(4*len(pilha)) + '</' + k*'sub' + f'section>')
                    sec -= 1

            linhasf.append(' '*(4*len(pilha)) + '<' + (3-len(match2.group(1)))*'sub' + f'section{attr}>')
            pilha.append((3-len(match2.group(1)))*'sub' + 'section')
            linhasf.append(' '*(4*len(pilha)) + f'<title>{match2.group(2)}</title>')
            sec += 1
            continue
        
        # Inicialização das variáveis envolvidas com o processo dos ambientes de acordo com o tab
        m = re.match(r'^(\s*)(.*)$', linha)
        n = len(m.group(1))//4 # Tabs
        match0 = re.match(r'^\s*-(.*)$', linha) # Listas
        match = re.match(r'^([^\s]*)\s*(.*?)(?<!\\):$', linha.strip()) # Tags
        if match:
            title = re.findall(r'title:\s*"(.*?)(?<!\\)"',match.group(2)) # Título
            attr = re.sub(r'([^\s]*):\s*"(.*?)(?<!\\)"',r'\1="\2"',
                          re.sub(r'\s*title:\s*"(.*?)(?<!\\)"\s*',' ', match.group(2), count=1)
                          ).strip()
            if title:
                title = title[0]
        k0 = 0
        # Manutenção dos ambientes de acordo com o tab
        if n > len(pilha) - pilha.count('list') - sec:
            if match0:
                if pilha and pilha[-1] == 'item':
                    linhasf.append(' '*(4*len(pilha)-4) + '</item>')
                    pilha.pop()
                for k in range(len(pilha),n+sec):
                    if pilha and 'list' in pilha:
                        linhasf.append(' '*(4*k) + '<item>')
                        pilha.append('item')
                        k0 = 4
                    linhasf.append(' '*(4*k+k0) + '<list>')
                    linhasf.append(' '*(4*k+4+k0) + '<item>')
                    if match0.group(1).strip() != '':
                        linhasf.append(' '*(4*k+8+k0) + match0.group(1))
                    pilha.append('list')
                    pilha.append('item')
                continue
            elif match:
                if attr == '':
                    linhasf.append(' '*(4*len(pilha)) + f'<{match.group(1)}>')
                else:
                    linhasf.append(' '*(4*len(pilha)) + f'<{match.group(1)} {attr}>')
                if title:
                    linhasf.append(' '*(4*len(pilha)+4) + f'<title>{title}</title>')
                pilha.append(match.group(1))
            else:
                linhasf.append(' '*(4*len(pilha)) + '<p>')
                linhasf.append(' '*(4*len(pilha)+4) + linha.strip())
                pilha.append('p')

        elif n == len(pilha) - pilha.count('list') - sec:
            if match0:
                if pilha and pilha[-1] == 'item':
                    pilha.pop()
                    linhasf.append(' '*(4*len(pilha)) + '</item>')
                linhasf.append(' '*(4*len(pilha)) + '<item>')
                pilha.append('item')
                if match0.group(1).strip() != '':
                    linhasf.append(' '*(4*len(pilha)) + match0.group(1))
                continue
            elif match:
                if attr == '':
                    linhasf.append(' '*(4*len(pilha)) + f'<{match.group(1)}>')
                else:
                    linhasf.append(' '*(4*len(pilha)) + f'<{match.group(1)} {attr}>')
                pilha.append(match.group(1))
                if title:
                    linhasf.append(' '*(4*len(pilha)) + f'<title>{title}</title>')
            else:
                linhasf.append(' '*(4*len(pilha)) + linha.strip())

        else:
            for k in range(len(pilha),n+sec,-1):
                linhasf.append(' '*(4*k-4) + f'</{pilha.pop()}>')

            if match0:
                if match0.group(1).strip() != '':
                    linhasf.append(' '*(4*len(pilha)) + '<item>')
                    pilha.append('item')
                    linhasf.append(' '*(4*len(pilha)) + match0.group(1))
                    continue
            elif match:
                if attr == '':
                    linhasf.append(' '*(4*len(pilha)) + f'<{match.group(1)}>')
                else:
                    linhasf.append(' '*(4*len(pilha)) + f'<{match.group(1)} {attr}>')
                pilha.append(match.group(1))
                if title:
                    linhasf.append(' '*(4*len(pilha)) + f'<title>{title}</title>')
            else:
                linhasf.append(' '*(4*len(pilha)) + linha.strip())

    for k in range(len(pilha),0,-1):
        linhasf.append(' '*(4*k-4) + f'</{pilha.pop()}>')

    # Eliminar escapes
    res = '\n'.join(linhasf)
    for i,k in enumerate(CHARESC):
        res = res.replace(k,[k[1:] for k in CHARESC][i])

    # Inserir os ambientes matemáticos curtos:
    for i,j in zip(ambmath, ambmath2):
        res = res.replace(j,i)

    return PRETXT[tipo] + res + POSTXT[tipo]

if __name__ == '__main__':
    # Utilização por meio de argumentos
    parser = argparse.ArgumentParser(description='Compilador para o Delta.', epilog=processar_texto.__doc__)
    parser.add_argument('-t', '--type', type=str, required=True, help='Insira aqui o tipo do Delta. (0 ou 1)')
    parser.add_argument('-file', '--filename', type=str, required=False, help='Insira aqui o arquivo texto de origem.')
    parser.add_argument('-txt', '--text', type=str, required=False, help='Insira aqui o texto para conversão em html.')

    args = parser.parse_args()

    if args.filename:
        with open(args.filename) as file:
            with open(args.filename[:-3] + 'html', 'w') as filef:
                filef.write(processar_texto(file.read(), args.type))
    elif args.text:
        print(processar_texto(args.text, args.type))
