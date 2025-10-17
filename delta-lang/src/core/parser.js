class Parser {
    constructor() {
        this.lines = []
        this.currentIndex = 0
        this.stack = []
        this.buffer = []
        this.bufferIndent = null
    }

    parse(text) {
        this.lines = text.split('\n')
        this.currentIndex = 0
        this.buffer = []
        this.bufferIndent = null
        
        // Initialize with root
        const root = { type: 'document', children: [], indent: -1 }
        this.stack = [root]
        
        while(this.currentIndex < this.lines.length) {
            const line = this.lines[this.currentIndex]
            this.handleLine(line)
            this.currentIndex++
        }
        
        this.flushBuffer()
        return root
    }

    handleLine(line) {
        let trimmed = line.trim()
        const indent = this.getIndent(line)
        
        // Handle escaped colons: convert \: back to : and treat as regular text
        if (trimmed.includes('\\:')) {
            const unescaped = trimmed.replace(/\\:/g, ':')
            this.addToBuffer(line.replace(trimmed, unescaped), indent)
            return
        }
        
        if (this.matchSection(trimmed)) {
            this.flushBuffer()
            const section = this.parseSection(trimmed, indent)
            this.addToHierarchy(section)
            
        } else if (this.matchSimpleBlock(trimmed)) {
            this.flushBuffer()
            const simpleBlock = this.parseSimpleBlock(trimmed, indent)
            this.addToHierarchy(simpleBlock)
            
        } else if (this.matchBlock(trimmed)) {
            this.flushBuffer()
            const block = this.parseBlock(trimmed, indent)
            this.addToHierarchy(block)
            
        } else {
            this.addToBuffer(line, indent)
        }
    }

    matchSection(line) {
        return /^#{1,6}\s/.test(line)
    }

    matchBlock(line) {
        // Complex block: has colon but NO content after it (content comes on next lines)
        // Examples: "theorem:", "theorem 'title':", "equation id 'eq1':"
        return /^[a-z]+.*:\s*$/.test(line)
    }

    matchSimpleBlock(line) {
        // Simple block: has colon AND has content after it (all on same line)  
        // Examples: "equation: x^2=2", "theorem id 'th1': content here"
        return /^[a-z]+.*:\s*.+/.test(line)
    }

    addToBuffer(line, indent) {
        const trimmed = line.trim()
        
        if (trimmed === '') {
            this.flushBuffer()
        } else {
            // Check if indentation changed
            if (this.buffer.length > 0 && this.bufferIndent !== indent) {
                this.flushBuffer()
            }
            
            this.buffer.push(trimmed)
            this.bufferIndent = indent
        }
    }

    flushBuffer() {
        if (this.buffer.length > 0) {
            const paragraph = {
                type: 'paragraph',
                content: this.buffer.join('\n'),
                indent: this.bufferIndent
            }
            
            this.addToHierarchy(paragraph)
            this.buffer = []
            this.bufferIndent = null
        }
    }

    parseSection(line, indent) {
        const level = (line.match(/^#+/) || [''])[0].length
        const title = line.replace(/^#+\s+/, '')
        
        return {
            type: 'section',
            level: level,
            title: title,
            indent: indent,
            children: []
        }
    }

    parseBlock(line, indent) {
        // Parse: theorem "Pythagorean Theorem", difficulty "easy": OR theorem:
        const colonIndex = line.lastIndexOf(':')
        if (colonIndex === -1) return null
        
        const beforeColon = line.substring(0, colonIndex).trim()
        const afterColon = line.substring(colonIndex + 1).trim()
        
        // Parse the part before colon for blockType and attributes
        const spaceIndex = beforeColon.indexOf(' ')
        let blockType, attributeText
        
        if (spaceIndex === -1) {
            // Simple case: "theorem:"
            blockType = beforeColon
            attributeText = ''
        } else {
            // Complex case: "theorem 'Pythagorean'"
            blockType = beforeColon.substring(0, spaceIndex)
            attributeText = beforeColon.substring(spaceIndex + 1).trim()
        }
        
        let title = null, attributes = {}
        if (attributeText) {
            const parsed = this.parseAttributes(attributeText)
            title = parsed.title
            attributes = parsed.attributes
        }
        
        const block = {
            type: 'block',
            blockType: blockType,
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
        const colonIndex = line.lastIndexOf(':')
        if (colonIndex === -1) return null
        
        const beforeColon = line.substring(0, colonIndex).trim()
        const afterColon = line.substring(colonIndex + 1).trim()
        
        // Parse the part before colon for blockType and attributes
        const spaceIndex = beforeColon.indexOf(' ')
        let blockType, attributeText
        
        if (spaceIndex === -1) {
            // Simple case: "theorem:"
            blockType = beforeColon
            attributeText = ''
        } else {
            // Complex case: "equation id 'eq':"
            blockType = beforeColon.substring(0, spaceIndex)
            attributeText = beforeColon.substring(spaceIndex + 1).trim()
        }
        
        const block = {
            type: 'simple-block',
            blockType: blockType,
            indent: indent,
            children: []
        }
        
        // Parse attributes if present
        if (attributeText) {
            const { title, attributes } = this.parseAttributes(attributeText)
            if (title) block.title = title
            if (Object.keys(attributes).length > 0) block.attributes = attributes
        }
        
        // Handle inline content
        if (afterColon) {
            block.children.push({
                type: 'text',
                content: afterColon
            })
        }
        
        return block
    }

    parseAttributes(text) {
        const attributes = {}
        let title = null
        
        // Match quoted strings with optional keys
        const pattern = /(?:(\w+)\s+)?"([^"]+)"/g
        let match
        
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

    addToHierarchy(element) {
        // Pop stack until we find correct parent
        while (this.stack.length > 1 && 
               this.stack[this.stack.length - 1].indent >= element.indent) {
            this.stack.pop()
        }
        
        // Add to current parent
        const parent = this.stack[this.stack.length - 1]
        parent.children.push(element)
        
        // Push onto stack if this element can have children
        if (element.children !== undefined) {
            this.stack.push(element)
        }
    }

    getIndent(line) {
        return (line.match(/^(\s*)/) || ['', ''])[1].length
    }
}

if (typeof window !== 'undefined') {
    window.Parser = Parser;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Parser;
}
