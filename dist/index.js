// SADL Parser - Main Entry Point
export { Lexer } from './lexer.js';
export { Parser } from './parser.js';
export { Visualizer } from './visualizer.js';
export { toMermaid } from './mermaid.js';
import { Parser } from './parser.js';
/**
 * Parse SADL source code into an AST
 */
export function parse(input, options) {
    const parser = new Parser();
    return parser.parse(input, options);
}
