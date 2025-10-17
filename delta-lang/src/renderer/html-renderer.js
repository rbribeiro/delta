/**
 * Delta Language HTML Renderer
 * 
 * Standalone module for rendering Delta AST to HTML.
 * 
 * Usage:
 *   const renderer = new DeltaRenderer();
 *   const html = renderer.render(ast);
 */

class DeltaRenderer {
    /**
     * Render a Delta AST node to HTML string
     * @param {Object} node - The AST node to render
     * @returns {string} HTML string
     */
    render(node) {
        if (!node || !node.type) return '';
        
        switch (node.type) {
            case 'document':
                return this.renderChildren(node.children);
                
            case 'section':
                return this.renderSection(node);
                
            case 'paragraph':
                return this.renderParagraph(node);
                
            case 'block':
                return this.renderBlock(node);
                
            case 'simple-block':
                return this.renderSimpleBlock(node);
                
            case 'text':
                return this.renderText(node);
                
            default:
                return '';
        }
    }
    
    /**
     * Render a section node (# ## ### headers)
     * @param {Object} node - Section AST node
     * @returns {string} HTML string
     */
    renderSection(node) {
        const level = Math.min(node.level, 6);
        const sectionHTML = `<h${level}>${this.escapeHtml(node.title)}</h${level}>`;
        const childrenHTML = this.renderChildren(node.children);
        return sectionHTML + childrenHTML;
    }
    
    /**
     * Render a paragraph node
     * @param {Object} node - Paragraph AST node
     * @returns {string} HTML string
     */
    renderParagraph(node) {
        return `<p>${this.escapeHtml(node.content)}</p>`;
    }
    
    /**
     * Render a block node (theorem, definition, etc. with attributes)
     * @param {Object} node - Block AST node
     * @returns {string} HTML string
     */
    renderBlock(node) {
        const blockType = node.blockType || 'block';
        const tagName = `delta-${blockType}`; // e.g., delta-theorem, delta-definition
        
        // Build attributes string
        let attributesStr = '';
        if (node.title) {
            attributesStr += ` data-title="${this.escapeHtml(node.title)}"`;
        }
        
        if (node.attributes && Object.keys(node.attributes).length > 0) {
            for (const [key, value] of Object.entries(node.attributes)) {
                attributesStr += ` ${key}="${this.escapeHtml(value)}"`;
            }
        }
        
        const childrenHTML = this.renderChildren(node.children);
        
        return `<${tagName}${attributesStr}>${childrenHTML}</${tagName}>`;
    }
    
    /**
     * Render a simple block node (block: without attributes)
     * @param {Object} node - Simple block AST node
     * @returns {string} HTML string
     */
    renderSimpleBlock(node) {
        const blockType = node.blockType || 'note';
        const tagName = `delta-${blockType}`;
        const childrenHTML = this.renderChildren(node.children);
        
        return `<${tagName} simple>${childrenHTML}</${tagName}>`;
    }
    
    /**
     * Render a text node
     * @param {Object} node - Text AST node
     * @returns {string} HTML string
     */
    renderText(node) {
        return this.escapeHtml(node.content);
    }
    
    /**
     * Render all children of a node
     * @param {Array} children - Array of child AST nodes
     * @returns {string} HTML string
     */
    renderChildren(children) {
        if (!children || !Array.isArray(children)) return '';
        return children.map(child => this.render(child)).join('');
    }
    
    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML string
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        
        // Use a simple character map for escaping to avoid DOM dependency
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

// Support both module export and global usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeltaRenderer;
} else if (typeof window !== 'undefined') {
    window.DeltaRenderer = DeltaRenderer;
}
