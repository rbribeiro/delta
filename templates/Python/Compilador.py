import re
from random import uniform
import argparse

MATHEX = ['\\[', '\\]', '$$']
CHARESC = ['\\"', '\\#', '\\(', '\\)', '\\:', '\\\\', '\\}']
PRETXT = '<main>\n'
POSTXT = '''</main>
<script src="script/load_page.js"></script>'''

def processar_texto(entrada):
    '''Use **[conteúdo]** para <b>[conteúdo]<\\b>, em uma mesma linha.
    Use *[conteúdo]* para <i>[conteúdo]<\\i>, em uma mesma linha.
    Use *{[tag] [atributos]}[conteúdo]* para <[tag] [atributos]>[conteúdo]<\\tag>, em uma mesma linha.
    
    Cada tab de mesmo nível para cada aglomerado de linhas consecutivas representa um ambiente.
    Uma tag a mais do que a linha anterior representa um ambiente de nível superior ao anterior.
    Ao deparar-se com uma tag a menos do que a linha anterior, o compilador fecha a tag automaticamente.
    
    É possível criar uma tag como ambiente usando [tag] [atributos]:, resultando por hora em <[tag] [atributos]>.

    Os ambientes pré-ajustados possíveis neste compilador são "list", "item", "section", "subsection" e "p".

    Para criar listas, basta fazer uma tab mais um "-", seguido do conteúdo dentro do item.
    Para fazer subitens, basta fazer uma tab a mais do que o item anterior, seguida de "-" e seguido do conteúdo dentro do subitem.
    Para escrever coisas dentro dos itens da lista, basta escrever algo com a mesma tab do item, porém sem o "-".

    Para fazer seções use "##" seguido do título da seção.
    Para fazer subsseções use "#" seguido do título da subseção.

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
            entrada = re.sub(r'(?<!\\)\\\(.*?\\\)(?!\\)', str(a), entrada, 1)
            ambmath2.append(str(a))
        return entrada, ambmath, ambmath2
            
    def substituicao_linha(linha):
        linha = re.sub(r'(?<!\\)\*\*(.*?)(?<!\\)\*\*', r'<b>\1</b>', linha)
        linha = re.sub(r'(?<!\\)\*{([^\s]*)\s*(.*?)(?<!\\)}(.*?)(?<!\\)\*', r'<\1 \2>\3</\1>', linha)
        linha = re.sub(r'(?<!\\)\*(\S.*?)(?<!\\)\*', r'<i>\1</i>', linha)
        return linha

    entrada, ambmath, ambmath2 = ambientes_math_curtos(entrada) # Ambientes matemáticos curtos
    entrada += '\n'
    linhasf = []
    linhas = entrada.split('\n')
    pilha = []
    pular = 0

    for linha in linhas:
        # Seções
        linha = re.sub(r'^(\s*)(?<!\\)##\s*"(.*?)"\s*(.*)$', r'\1section title:"\2" \3:', linha)
        linha = re.sub(r'^(\s*)(?<!\\)#\s*"(.*?)"\s*(.*)$', r'\1subsection title:"\2" \3:', linha)

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
        
        linha = substituicao_linha(linha)

        # Inicialização das variáveis envolvidas com o processo dos ambientes de acordo com o tab
        m = re.match(r'^(\s*)(.*)$', linha)
        n = len(m.group(1))//4 # Tabs
        match0 = re.match(r'^\s*-(.*)$', linha) # Listas
        match = re.match(r'^([^\s]*)\s*(.*?)(?<!\\):$', linha.strip()) # Tags
        if match:
            title = re.findall(r'title:\s*"(.*?)(?<!\\)"',match.group(2)) # Título
            attr = re.sub(r'([^\s]*):\s*"(.*?)(?<!\\)"',r'\1="\2"',
                          re.sub(r'\s*title:\s*"(.*?)(?<!\\)"\s*',' ', match.group(2),1)
                          ).strip()
            if title:
                title = title[0]
        k0 = 0

        # Manutenção dos ambientes de acordo com o tab
        if n > len(pilha) - pilha.count('list'):
            if match0:
                if pilha and pilha[-1] == 'item':
                    linhasf.append(' '*(4*len(pilha)-4) + '</item>')
                    pilha.pop()
                for k in range(len(pilha),n):
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

        elif n == len(pilha) - pilha.count('list'):
            if match0:
                if pilha and pilha[-1] == 'item':
                    linhasf.append(' '*(4*len(pilha) - 4) + '</item>')
                    pilha.pop()
                linhasf.append(' '*(4*len(pilha)) + '<item>')
                if match0.group(1).strip() != '':
                    linhasf.append(' '*(4*len(pilha)+4) + match0.group(1))
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
                linhasf.append(' '*(4*len(pilha)) + linha.strip())

        else:
            l = len(pilha)
            for k in range(l,n,-1):
                linhasf.append(' '*(4*k-4) + f'</{pilha.pop()}>')

            if match0:
                if match0.group(1).strip() != '':
                    linhasf.append(' '*(4*len(pilha)) + '<item>')
                    linhasf.append(' '*(4*len(pilha)+4) + match0.group(1))
                    linhasf.append(' '*(4*len(pilha)) + '</item>')
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
                linhasf.append(' '*(4*len(pilha)) + linha.strip())

    # Eliminar escapes
    res = '\n'.join(linhasf)
    for i,k in enumerate(CHARESC):
        res = res.replace(k,[k[1:] for k in CHARESC][i])

    # Inserir os ambientes matemáticos curtos:
    for i,j in zip(ambmath, ambmath2):
        res = res.replace(j,i)

    return PRETXT + res + POSTXT

if __name__ == '__main__':
    # Utilização por meio de argumentos
    parser = argparse.ArgumentParser(description='Compilador para o Delta.', epilog=processar_texto.__doc__)
    parser.add_argument('-file', '--filename', type=str, required=False, help='Insira o arquivo texto de origem.')
    parser.add_argument('-txt', '--text', type=str, required=False, help='Insira o texto para conversão em html.')

    args = parser.parse_args()

    if args.filename:
        with open(args.filename) as file:
            with open(args.filename + '.html', 'w') as filef:
                filef.write(processar_texto(file.read()))
    elif args.text:
        print(processar_texto(args.text))
