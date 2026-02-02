export { Lexer } from './lexer.js';
export type { Token, TokenType } from './lexer.js';
export { Parser } from './parser.js';
export type { FileResolver } from './parser.js';
export { Visualizer } from './visualizer.js';
export type { VisualizerOptions, RenderedInstance, NodePosition, ViewMode } from './visualizer.js';
export { toMermaid } from './mermaid.js';
export type { MermaidViewMode, MermaidOptions } from './mermaid.js';
export type { AST, ASTNode, NodeClass, LinkClass, Instance, InstanceEntry, Connection, Connector, PortSpec, Position, Include, } from './types.js';
import { FileResolver } from './parser.js';
import { AST } from './types.js';
export interface ParseOptions {
    fileResolver?: FileResolver;
    filePath?: string;
}
/**
 * Parse SADL source code into an AST
 */
export declare function parse(input: string, options?: ParseOptions): AST;
