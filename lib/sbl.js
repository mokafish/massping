/** 
 * @file lib/sbl.js
 * @description SBL core
 */

import helper from "./helper.js";
import * as builtin from './sbl.builtin.js'

export class Token {
    /**
     * 
     * @param {'text' | 'tag' } type 
     * @param {string} content 
     * @param {number} j 
     */
    constructor(type, content, pos) {
        this.type = type;
        this.content = content;
        this.pos = pos;
    }
}

export class Lexer {
    constructor(begin = '{', end = '}') {
        this.begin = begin;
        this.end = end;
    }

    tokenize(input) {
        const tokens = [];
        let currentState = 'text'; // 'text' or 'tag'
        let i = 0; // Start position of current token
        let j = 0;   // Current position in input
        let inEscape = false; // In escape sequence (for tag block)
        let inQuote = null;   // Current quote type: null, '"', or "'" (for tag block)

        while (j < input.length) {
            if (currentState === 'text') {
                // Check if we have a begin sequence at current position
                if (input.substr(j, this.begin.length) === this.begin) {
                    // Push any preceding text
                    if (j > i) {
                        // tokens.push(new Token('text', [input.substring(i, j)], i));
                        tokens.push(new Token('text', input.substring(i, j), i));
                    }
                    // Enter tag state
                    currentState = 'tag';
                    // Move past begin sequence
                    j += this.begin.length;
                    i = j; // Start of tag content
                    // Reset tag parsing state
                    inEscape = false;
                    inQuote = null;
                } else {
                    j++;
                }
            } else { // tag state
                if (inEscape) {
                    // Current char is escaped, treat as normal
                    inEscape = false;
                    j++;
                } else {
                    const char = input[j];
                    if (char === '\\') {
                        // Start escape sequence
                        inEscape = true;
                        j++;
                    } else if (char === '"' || char === "'") {
                        // Handle quotes
                        if (inQuote === char) {
                            // Close matching quote
                            inQuote = null;
                        } else if (inQuote === null) {
                            // Open new quote
                            inQuote = char;
                        }
                        j++;
                    } else if (inQuote === null && input.substr(j, this.end.length) === this.end) {
                        // Found end sequence outside quotes
                        const content = input.substring(i, j);
                        // tokens.push(new Token('tag', this.split(content), i));
                        tokens.push(new Token('tag', content, i));
                        // Move past end sequence
                        j += this.end.length;
                        i = j;
                        currentState = 'text';
                    } else {
                        j++;
                    }
                }
            }
        }

        // Handle any remaining content after loop
        if (currentState === 'text') {
            if (i < j) {
                // tokens.push(new Token('text', [input.substring(i, j)], i));
                tokens.push(new Token('text', input.substring(i, j), i));
            }
        } else {
            // Unclosed tag block
            const content = input.substring(i, j);
            // tokens.push(new Token('tag', this.split(content), i));
            tokens.push(new Token('tag', content, i));
        }

        return tokens;
    }

}

export class ASTNode {
    /**
     * 
     * @param {string} opcode 
     * @param {any[]} data 
     * @param {object} attr 
     */
    constructor(opcode, data = [], attr = {}) {
        this.opcode = opcode;
        this.data = data;
        this.attr = attr;
    }
}

export class Parser {
    constructor(syntaxs, attrMacros, lexer = new Lexer()) {
        this.syntaxs = syntaxs || builtin.syntaxs
        this.attrMacros = attrMacros || builtin.attrMacros
        this.lexer = lexer;
    }
    /**
     * 
     * @param {Token[]|string} tokens 
     * @param {string} scope 
     * @returns {ASTNode[]}
     */
    parse(tokens, scope = 'main') {
        if (typeof tokens === 'string') {
            tokens = this.lexer.tokenize(tokens);
        }
        let autoId = 0;
        const ast = []
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            let opcode, data, attr;
            if (token.type === 'text') {
                opcode = 'echo';
                data = [token.content];
                attr = {};
            } else /*if (token.type === 'tag')*/ {
                const parts = helper.shlexSplit(token.content);
                [opcode, ...data] = this.parseSyntax(parts[0], scope);

                if (opcode === '') {
                    // If no opcode matched, treat as a text node
                    // TODO: emit warning 
                    opcode = 'echo';
                    data = [this.lexer.begin + token.content + this.lexer.end];
                }

                attr = this.parseAttrs(parts.slice(1), scope);
            }

            if (opcode !== 'echo' && !attr.id) {
                attr.id = `${scope}:${autoId++}`;
            }

            ast.push(new ASTNode(opcode, data, attr));
        }
        return ast;
    }

    /**
     * 
     * @param {string} source 
     * @param {string} scope 
     * @returns {string[]}
     */
    parseSyntax(source, scope = 'main') {
        for (const syntax of this.syntaxs) {
            const match = syntax.match.exec(source);
            if (match) {
                return syntax.handler({ match, scope }, ...match.slice(1));
            }
        }
        // If no syntax matched, return the source as a single element array
        return ['', source];
    }
    /**
     * 
     * @param {string[]} sources 
     * @param {string} scope 
     * @returns {object}
     */
    parseAttrs(sources, scope = 'main') {
        const attr = {};
        for (const source of sources) {
            // let matched = false;
            for (const macro of this.attrMacros) {
                const match = macro.match.exec(source);
                if (match) {
                    // matched = true;
                    const [name, value] = macro.handler({ match, scope }, ...match.slice(1));
                    attr[name] = value;
                    break; // Stop after the first match
                }
            }
            // if (!matched) {
            //     // If no macro matched, treat as a normal attribute
            //     const [name, value] = this.attrMacros[0].handler(null, source);
            //     attrs[name] = value;
            // }
        }
        return attr;
    }
}

export class Runtime {
    constructor(processor = builtin.processor, encoder = builtin.encoder) {
        this.processor = processor;
        this.encoder = encoder
        this.heap = new Map();
    }

    /**
     * 
     * @param {ASTNode} node 
     * @param {string} scope 
     * @returns 
     */
    register(node, scope = 'main') {
        let id = node.attr.id
        let pow = node.attr.pow || null
        let direction = node.opcode === 'ref' ? node.data[0] : pow
        let op = this.processor[node.opcode]

        if (!op) {
            throw new Error(`Unknown opcode: ${node.opcode}`);
        }

        let encoding = ['str']
        if (node.attr.encoding) {
            encoding = node.attr.encoding.split(',')
                .map(s => s.trim()).filter(Boolean)
            for (let ec of encoding) {
                if (!Object.hasOwn(this.encoder, ec)) {
                    throw new Error(`Unknown encoder: ${ec}`);
                }
            }
        }

        this.heap.set(id, {
            tick: op(...node.data),
            value: undefined,
            pow,
            encoding,
            overflow: true,
            // scope: scope,
            // id: id,
        });
        return { id, direction }
    }

    evaluate(id) {
        const item = this.heap.get(id);
        let updated = false
        // check "pow" exists and is not first evaluate
        if (item.pow && item.value !== undefined) {
            let powItem = this.heap.get(item.pow);
            if (powItem.overflow) {
                let res = item.tick(this);
                item.value = res.value;
                item.overflow = res.overflow;  // follow pow overflow
                updated = true
            } else {
                item.overflow = false; // reset current item overflow if pow is not overflowing
            }
        } else {
            let res = item.tick(this);
            item.value = res.value;
            item.overflow = res.overflow;
            updated = true

        }

        if (updated) {
            for (let enc of item.encoding) {
                item.value = this.encoder[enc](item.value)
            }
        }

        return item.value
    }

    heapSet(id, record) {
        this.heap.set(id, record);
    }

    heapGet(id) {
        return this.heap.get(id);
    }
}

export class SBL {
    static InterpreterError = class extends Error {
        constructor(message) {
            super(message);
            this.name = 'InterpreterError';
            this.code = 'INTERPRETER_FIALED';
        }
    }

    static baseProcessor = {
        ref: (target) => {
            return (runtime) => {
                return { value: runtime.heapGet(target).value, overflow: true }
            }
        },
        echo: (value) => {
            return () => ({ value, overflow: true })
        }
    }

    constructor(
        bracket = ['{', '}'],
        syntaxs = builtin.syntaxs,
        processor = builtin.processor,
        attrMacros = builtin.attrMacros
    ) {
        this.lexer = new Lexer(...bracket);
        this.parser = new Parser(syntaxs, attrMacros, this.lexer);
        this.runtime = new Runtime({ ...SBL.baseProcessor, ...processor });
        this.context = {};
        this.graph = []
    }

    load(input, scope = 'main') {
        if (this.parser === undefined) {
            throw new SBL.InterpreterError('Interpreter is readied. Stop load inputs.');
        }
        if (this.context[scope]) {
            throw new SBL.InterpreterError(`scope "${scope}" existed.`);
        }

        const tokens = this.lexer.tokenize(input);
        const ast = this.parser.parse(tokens, scope);
        this.context[scope] = ast

        for (const node of ast) {
            if (node.opcode !== 'echo') {
                let topoItem = this.runtime.register(node, scope);
                this.graph.push(topoItem)
            }
        }
    }

    ready() {
        try {
            this.graph = helper.topologicalSort(this.graph);
        } catch (e) {
            if (e.code === 'CYCLE_DETECTED') {
                throw new SBL.InterpreterError('Circular references exist between tags.');
            }
            throw e
        }

        this.parser = undefined; // Clear parser to free memory
        this.lexer = undefined; // Clear lexer to free memory
    }

    /**
     * 
     * @returns {Object<string,string>}
     */
    execute() {
        // Evaluate all nodes in topological order
        for (let item of this.graph) {
            this.runtime.evaluate(item.id);
        }

        // Collect output 
        let output = {}
        for (let scope in this.context) {
            const ast = this.context[scope];
            let parts = Array(ast.length)
            for (let i = 0; i < parts.length; i++) {
                const node = ast[i];
                if (node.opcode === 'echo') {
                    parts[i] = node.data[0];
                } else {
                    parts[i] = this.runtime.heapGet(node.attr.id).value;
                }
            }
            output[scope] = parts.join('');
        }

        return output;
    }
}

export default SBL;
