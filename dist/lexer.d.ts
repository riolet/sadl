export type TokenType = 'SECTION_NODECLASS' | 'SECTION_LINKCLASS' | 'SECTION_INSTANCES' | 'SECTION_CONNECTIONS' | 'SECTION_NATS' | 'INCLUDE' | 'AT' | 'UDP' | 'IDENTIFIER' | 'NUMBER' | 'STRING' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'DOUBLE_COLON' | 'DOT' | 'ARROW' | 'DASH' | 'STAR' | 'EOF';
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}
export declare class Lexer {
    private input;
    private pos;
    private line;
    private column;
    constructor(input: string);
    private peek;
    private advance;
    private skipWhitespace;
    private skipComment;
    private readIdentifier;
    private readNumber;
    tokenize(): Token[];
}
