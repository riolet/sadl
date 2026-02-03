// Lexer for SADL
const KEYWORDS = {
    include: 'INCLUDE',
    udp: 'UDP',
};
const SECTION_KEYWORDS = {
    nodeclass: 'SECTION_NODECLASS',
    linkclass: 'SECTION_LINKCLASS',
    instances: 'SECTION_INSTANCES',
    connections: 'SECTION_CONNECTIONS',
    nats: 'SECTION_NATS',
};
export class Lexer {
    constructor(input) {
        this.pos = 0;
        this.line = 1;
        this.column = 1;
        this.input = input;
    }
    peek(offset = 0) {
        return this.input[this.pos + offset] || '';
    }
    advance() {
        const char = this.input[this.pos++] || '';
        if (char === '\n') {
            this.line++;
            this.column = 1;
        }
        else {
            this.column++;
        }
        return char;
    }
    skipWhitespace() {
        while (this.pos < this.input.length) {
            const char = this.peek();
            if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
                this.advance();
            }
            else {
                break;
            }
        }
    }
    skipComment() {
        // Skip until end of line
        while (this.pos < this.input.length && this.peek() !== '\n') {
            this.advance();
        }
    }
    readIdentifier() {
        let result = '';
        while (this.pos < this.input.length) {
            const char = this.peek();
            if (/[a-zA-Z0-9_]/.test(char)) {
                result += this.advance();
            }
            else {
                break;
            }
        }
        return result;
    }
    readNumber() {
        let result = '';
        while (this.pos < this.input.length) {
            const char = this.peek();
            if (/[0-9]/.test(char)) {
                result += this.advance();
            }
            else {
                break;
            }
        }
        return result;
    }
    tokenize() {
        const tokens = [];
        while (this.pos < this.input.length) {
            this.skipWhitespace();
            if (this.pos >= this.input.length) {
                break;
            }
            const line = this.line;
            const column = this.column;
            const char = this.peek();
            if (char === '#') {
                this.advance(); // consume #
                const identifier = this.readIdentifier();
                const sectionType = SECTION_KEYWORDS[identifier.toLowerCase()];
                if (sectionType) {
                    tokens.push({ type: sectionType, value: identifier, line, column });
                }
                else {
                    // It's a comment, skip to end of line
                    this.skipComment();
                }
            }
            else if (/[a-zA-Z_]/.test(char)) {
                const identifier = this.readIdentifier();
                const keyword = KEYWORDS[identifier.toLowerCase()];
                tokens.push({
                    type: keyword || 'IDENTIFIER',
                    value: identifier,
                    line,
                    column,
                });
            }
            else if (/[0-9]/.test(char)) {
                const number = this.readNumber();
                tokens.push({
                    type: 'NUMBER',
                    value: number,
                    line,
                    column,
                });
            }
            else if (char === '"') {
                this.advance(); // consume opening quote
                let str = '';
                while (this.pos < this.input.length && this.peek() !== '"') {
                    str += this.advance();
                }
                if (this.peek() !== '"') {
                    throw new Error(`Unterminated string at line ${line}, column ${column}`);
                }
                this.advance(); // consume closing quote
                tokens.push({ type: 'STRING', value: str, line, column });
            }
            else if (char === '(') {
                this.advance();
                tokens.push({ type: 'LPAREN', value: '(', line, column });
            }
            else if (char === ')') {
                this.advance();
                tokens.push({ type: 'RPAREN', value: ')', line, column });
            }
            else if (char === ',') {
                this.advance();
                tokens.push({ type: 'COMMA', value: ',', line, column });
            }
            else if (char === ':' && this.peek(1) === ':') {
                this.advance();
                this.advance();
                tokens.push({ type: 'DOUBLE_COLON', value: '::', line, column });
            }
            else if (char === '.') {
                this.advance();
                tokens.push({ type: 'DOT', value: '.', line, column });
            }
            else if (char === '-' && this.peek(1) === '>') {
                this.advance();
                this.advance();
                tokens.push({ type: 'ARROW', value: '->', line, column });
            }
            else if (char === '-') {
                this.advance();
                tokens.push({ type: 'DASH', value: '-', line, column });
            }
            else if (char === '*') {
                this.advance();
                tokens.push({ type: 'STAR', value: '*', line, column });
            }
            else if (char === '@') {
                this.advance();
                tokens.push({ type: 'AT', value: '@', line, column });
            }
            else {
                throw new Error(`Unexpected character '${char}' at line ${line}, column ${column}`);
            }
        }
        tokens.push({ type: 'EOF', value: '', line: this.line, column: this.column });
        return tokens;
    }
}
