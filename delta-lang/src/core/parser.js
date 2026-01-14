// ----- Padrões -----

// Seção - Identifica uma linha de seção, que começa com 1 a 6 '#' seguidos de espaço dependendo do nível.
// Modificado: permite um * opcional para marcar ausência de numeração na seção (eg. #* ##*...)
const SECTION_PATTERN = /^#{1,6}\*?\s/;

// Bloco Simples - Identifica um 'bloco simples', isto é, uma linha que contém ':' e tem conteúdo depois.
const SIMPLE_BLOCK_PATTERN = new RegExp([
  '^',
  '([a-z][a-zA-Z0-9_]*\\*?)', // equation
  '(?:\\s+"([^"]*)")?', // equation "title"
  '(?:\\s*,?\\s+([a-z][a-zA-Z0-9_-]*\\s+"[^"]*"))*', // equation "title", attr "value" ...
  '\\s*:\\s*', // colon outside quotes
  '(.+)$' // mandatory content after colon
].join(''));

// Bloco Complexo - Identifica um 'bloco complexo': uma linha que termina com ':' e cujo conteúdo está nas linhas seguintes.
const COMPLEX_BLOCK_PATTERN = new RegExp([
  '^(',
    '[a-z][a-zA-Z0-9_]*\\*?\\s*', // 1. theorem
    '|',
    '[a-z][a-zA-Z0-9_]*\\*?\\s+"[^"]*"\\s*', // 2. theorem "title"
    '|',
    '[a-z][a-zA-Z0-9_]*\\*?(?:\\s+[a-z][a-zA-Z0-9_-]*\\s+"[^"]*")+', // 3. theorem attr "value" ...
    '|',
    '[a-z][a-zA-Z0-9_]*\\*?\\s+"[^"]*"\\s*,\\s*(?:[a-z][a-zA-Z0-9_-]*\\s+"[^"]*")(?:\\s+[a-z][a-zA-Z0-9_-]*\\s+"[^"]*")*', // 4. theorem "title", attr "value" ...
  ')\\s*:\\s*$'
].join(''), 'm');

// Atributos - Padrõa que extrai atributos no formato chave "valor". A chave é opcional, pois também existe o atributo data-title que não usa chave.
const ATTRIBUTE_PATTERN = /(?:([\w-]+)\s+)?"([^"]+)"/g;

// Indentação - Padrão que captura o espaço em branco no início da linha medindo a indentação.
const INDENTATION_PATTERN = /^(\s*)/;

// Conversão de \: para caractere :
const TWO_DOTS_PATTERN = /\\:/g;

// Negrito - Padrão que identifica texto em negrito delimitado por **.
const BOLD_PATTERN = /\*\*(.+?)(?<!\\)\*\*/

// Itálico - Padrão que identifica texto em itálico delimitado por __.
const ITALIC_PATTERN = /__(.+?)(?<!\\)__/

// Negrito e Itálico - Padrão que identifica texto em negrito e itálico delimitado por --.
const BOLD_ITALIC_PATTERN = /--(.+?)(?<!\\)--/

// Marcação - Padrão que identifica texto marcado delimitado por `.
const MARK_PATTERN = /``(.+?)(?<!\\)``/

// Sublinhado - Padrão que identifica texto sublinhado delimitado por ~~.
const UNDERSCORE_PATTERN = /~~(.+?)(?<!\\)~~/

// ----- Parser -----

class Parser {
    constructor() {
        this.lines = []
        this.currentIndex = 0
        this.stack = []
    }

    parse(text) {
        this.lines = text.split('\n')
        this.currentIndex = 0
        
        // Initialize with root
        const root = { type: 'document', children: [], indent: -1 }
        this.stack = [root]
        
        while(this.currentIndex < this.lines.length) {
            const line = this.lines[this.currentIndex]
            this.handleLine(line)
            this.currentIndex++
        }
        
        console.log(root)
        return root
    }

    handleLine(line) {
        let trimmed = line.trim()
        const indent = this.getIndent(line)
        
        if (this.matchSection(trimmed)) {
            const section = this.parseSection(trimmed, indent)

            // Changed
            this.addSectionToHierarchy(section)
            
        } else if (this.matchSimpleBlock(trimmed)) {
            const [simpleBlock, afterColon] = this.parseSimpleBlock(trimmed, indent)
            this.addToHierarchy(simpleBlock)
            
            // Handle inline content
            if (afterColon) {
                this.createParagraphFromSubLine(afterColon, indent + 4)
                //block.children.push({
                //    type: 'text',
                //    content: afterColon
                //})
            }

        } else if (this.matchBlock(trimmed)) {
            const block = this.parseBlock(trimmed, indent)
            this.addToHierarchy(block)
            
        } else {
            if (trimmed !== '') {
                //const escapedTrimmedLine = this.handleBackslashes(line).trimStart()
                const trimmedContent = line.trimStart() // Renamed to avoid conflict with top-level "trimmed"
                this.createParagraphFromSubLine(trimmedContent, indent)
            } else if (this.stack[this.stack.length-1].type === 'paragraph' && this.stack[this.stack.length-1].children.length !== 0) {
                this.addToHierarchy({
                    type: 'paragraph',
                    children: [],
                    indent: this.stack[this.stack.length-1].indent
                })
            }
        }
    }

    // NEW METHOD: Handles the logic for Sections (Title, Section, Subsection)

    addSectionToHierarchy(newSection) {
        // 1. First, we must close any "non-section" blocks that might still be open 
        // (like a Theorem or Note that wasn't closed properly), because a Section breaks everything.
        while (this.stack.length > 1) {
            const top = this.stack[this.stack.length - 1];

            // If the top is not a section, we close it (pop)
            if (top.type !== 'section') {
                this.stack.pop();
            } else {
                // if it is a section, we stop to check the levels
                break;
            }
        }

        // 2. Now we handle Section nesting based on level (#)
        // We pop the stack until we find a parent Section with a 'level' strictly less than our new section (when we find, it will be the parent).
        // Example: If stack is [Section 1 (Lvl 1), Subsection 1.1 (Lvl 2)] and we add Section 2 (Lvl 1):
        // We pop Subsection 1.1 (2 >= 1).
        // We pop Section 1 (1 >= 1).
        // We attach Section 2 to Root.

        while (this.stack.length > 1) {
            const top = this.stack[this.stack.length - 1];

            if (top.type === 'section' && top.level >= newSection.level) {
                this.stack.pop();
            } else {
                break;
            }
        }

        // 3. Add the valid parent and push to stack

        const parent = this.stack[this.stack.length - 1];
        parent.children.push(newSection);
        this.stack.push(newSection);
    }

    // Modified method: handles standard hierarchy (paragraph, blocks) based on indentation

    addToHierarchy(element) {
        // Pop stack until we find the correct parent
        while (this.stack.length > 1) {
            const parent = this.stack[this.stack.length - 1];

            // If a parent is a 'section', we never pop it based on indentation 
            // Sections act as permanent containers until we close them with addSectionToHierarchy 
            if (parent.type === 'section') {
                break;
            }

            // For other blocks (like theorems, lists, etc), we use indentation to define belonging

            if (parent.indent < element.indent) {
                break;
            }

            this.stack.pop()
        }

        // Add to current parent

        const parent = this.stack[this.stack.length -1]
        parent.children.push(element)

        // Push onto the stack if the element can have children
        if (element.children !== undefined) {
            this.stack.push(element)
        }
    }

    createParagraphFromSubLine(subline, indent) {
        const seq = this.handleSubLine(subline)
        if (this.stack[this.stack.length-1].indent <= indent && this.stack[this.stack.length-1].type === 'paragraph') {
            this.stack[this.stack.length-1].children.push(...seq)
        } else {
            this.addToHierarchy({
                type: 'paragraph',
                children: seq,
                indent: indent
            })
        }
    }

    handleSubLine(subline) {
        if (BOLD_PATTERN.test(subline)) {
            const partition = this.parseSequence(subline, BOLD_PATTERN, 'bold')
            return [...this.handleSubLine(partition[0]), partition[1], ...this.handleSubLine(partition[2])]
        } else if (ITALIC_PATTERN.test(subline)) {
            const partition = this.parseSequence(subline, ITALIC_PATTERN, 'italic')
            return [...this.handleSubLine(partition[0]), partition[1], ...this.handleSubLine(partition[2])]
        } else if (BOLD_ITALIC_PATTERN.test(subline)) {
            const partition = this.parseSequence(subline, BOLD_ITALIC_PATTERN, 'bold-italic')
            return [...this.handleSubLine(partition[0]), partition[1], ...this.handleSubLine(partition[2])]
        } else if (MARK_PATTERN.test(subline)) {
            const partition = this.parseSequence(subline, MARK_PATTERN, 'mark')
            return [...this.handleSubLine(partition[0]), partition[1], ...this.handleSubLine(partition[2])]
        } else if (UNDERSCORE_PATTERN.test(subline)) {
            const partition = this.parseSequence(subline, UNDERSCORE_PATTERN, 'underscore')
            return [...this.handleSubLine(partition[0]), partition[1], ...this.handleSubLine(partition[2])]
        } else {
            return [{
                    type: 'text',
                    content: this.handleBackslashes(subline)
                }]
        }
    }

    parseSequence(line, pattern, type) {
        const content = line.split(pattern)
        let head = pattern.source.match(/([^(]*)\(/)[1]
        const escape = new RegExp('\\\\' + head)
        head = head.replace(/\\/g,'')

        return [content[0],{
                    type: type,
                    content: content[1].replace(escape, head)
                },content[2]]
    }

    matchSection(line) {
        return SECTION_PATTERN.test(line)
    }

    matchBlock(line) {
        // Complex block: has colon but NO content after it (content comes on next lines)
        // Examples: "theorem:", "theorem 'title':", "equation id 'eq1':"
        return COMPLEX_BLOCK_PATTERN.test(line)
    }

    matchSimpleBlock(line) {
        // Simple block: has colon AND has content after it (all on same line)  
        // Examples: "equation: x^2=2", "theorem id 'th1': content here"
        return SIMPLE_BLOCK_PATTERN.test(line)
    }

    findUnescapedColons(line) {
        // Return the indices of unescaped colons in the line
        // Ignores colons inside quotes
         
        const indexes = [];
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            // If finds quotes, checks if not escaped
            if (char === '"') {
                let backslashCount = 0;
                let j = i - 1;
                while (j >= 0 && line[j] === '\\') {
                    backslashCount++;
                    j--;
                }
                if (backslashCount % 2 === 0) {
                    inQuotes = !inQuotes;
                }
            }
            
            // If finds colon, checks if not escaped and not in quotes
            if (char === ':' && !inQuotes) {
                let backslashCount = 0;
                let j = i - 1;
                while (j >= 0 && line[j] === '\\') {
                    backslashCount++;
                    j--;
                }
                if (backslashCount % 2 === 0) {
                    indexes.push(i);
                }
            }
        }
        
        return indexes;
    }

    handleBackslashes(str) {
        return str.replace(/\\\\+/g, match => match.slice(1));
    }

    parseSection(line, indent) {
        const escapedLine = this.handleBackslashes(line);

        // Check for '*' before the title starts.
        // Matches beginning like "##*"

        const isUnnumbered = /^#+\*/.test(escapedLine);

        const level = (escapedLine.match(/^#+/) || [''])[0].length;

        // Clean title: remove hashes, optional star, and spaces
        const title = escapedLine.replace(/^#+\*?\s+/, '');
        
        return {
            type: 'section',
            level: level,
            isUnnumbered: isUnnumbered,
            title: title,
            indent: indent,
            children: []
        }
    }

    // Helper to extract type and unnumbered status
    parseBlockType(rawType) {
        const isUnnumbered = rawType.endsWith('*');
        // slice(0, -1) removes the last character ('*')
        const blockType = isUnnumbered ? rawType.slice(0, -1) : rawType;
        return {blockType, isUnnumbered};
    }

    parseBlock(line, indent) {
        // Parse: theorem "Pythagorean Theorem", difficulty "easy": OR theorem:

        const unescapedColons = this.findUnescapedColons(line)

        if (unescapedColons.length === 0) return null
        // if (unescapedColons.length > 1) return null // pensar se vamos fazer isso mesmo

        const colonIndex = unescapedColons[0];
        
        const escapedLine = this.handleBackslashes(line);
        const beforeColon = escapedLine.substring(0, colonIndex).trim();
        const afterColon = escapedLine.substring(colonIndex + 1).trim();
        
        // Parse the part before colon for blockType and attributes
        const spaceIndex = beforeColon.indexOf(' ');

        let rawType, attributeText;
        
        if (spaceIndex === -1) {
            // Simple case: "theorem:"
            rawType = beforeColon;
            attributeText = '';
        } else {
            // Complex case: "theorem 'Pythagorean'"
            rawType = beforeColon.substring(0, spaceIndex);
            attributeText = beforeColon.substring(spaceIndex + 1).trim();
        }

        // Extract the cleanblock format 
        const {blockType, isUnnumbered} = this.parseBlockType(rawType);

        
        let title = null, attributes = {}
        if (attributeText) {
            const parsed = this.parseAttributes(attributeText)
            title = parsed.title
            attributes = parsed.attributes
        }
        
        const block = {
            type: 'block',
            blockType: blockType, // eg. theorem (clean, not theorem*)
            isUnnumbered: isUnnumbered,
            indent: indent,
            children: []
        }
        
        if (title) block.title = title
        if (Object.keys(attributes).length > 0) block.attributes = attributes
        
        // Handle same-line content (though complex blocks shouldn't have any)
        if (afterColon) {
            block.children.push({
                type: 'text',
                content: afterColon
            })
        }
        
        return block
    }

    parseSimpleBlock(line, indent) {
        // Parse: theorem: content OR equation id "eq": content
        const unescapedColons = this.findUnescapedColons(line)

        if (unescapedColons.length === 0) return null
        // if (unescapedColons.length > 1) return null // pensar se vamos fazer isso mesmo

        const colonIndex = unescapedColons[0];

        const escapedLine = this.handleBackslashes(line);
        const beforeColon = escapedLine.substring(0, colonIndex).trim();
        const afterColon = escapedLine.substring(colonIndex + 1).trim();
        
        // Parse the part before colon for blockType and attributes
        const spaceIndex = beforeColon.indexOf(' ');

        let rawType, attributeText;
        
        if (spaceIndex === -1) {
            // Simple case: "theorem:"
            rawType = beforeColon
            attributeText = ''
        } else {
            // Complex case: "equation id 'eq':"
            rawType = beforeColon.substring(0, spaceIndex)
            attributeText = beforeColon.substring(spaceIndex + 1).trim()
        }
        
        // Extract * logic
        const {blockType, isUnnumbered} = this.parseBlockType(rawType);

        const block = {
            type: 'simple-block',
            blockType: blockType,
            isUnnumbered: isUnnumbered,
            indent: indent,
            children: []
        }
        
        // Parse attributes if present
        if (attributeText) {
            const { title, attributes } = this.parseAttributes(attributeText)
            if (title) block.title = title
            if (Object.keys(attributes).length > 0) block.attributes = attributes
        }
        
        return [block, afterColon]
    }

    parseAttributes(text) {
        const attributes = {}
        let title = null
        
        // Match quoted strings with optional keys
        const pattern = ATTRIBUTE_PATTERN;
        let match; pattern.lastIndex = 0;
        
        while ((match = pattern.exec(text)) !== null) {
            const [, key, value] = match
            if (key) {
                attributes[key] = value
            } else if (!title) {
                title = value // First unkeyed string is title
            }
        }
        
        return { title, attributes }
    }

    getIndent(line) {
        return (line.match(INDENTATION_PATTERN) || ['', ''])[1].length
    }
}

if (typeof window !== 'undefined') {
    window.Parser = Parser;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Parser;
}
