// SADL Parser - Main Entry Point

export { Lexer } from './lexer.js';
export type { Token, TokenType } from './lexer.js';

export { Parser } from './parser.js';

export { Visualizer } from './visualizer.js';
export type { VisualizerOptions, RenderedInstance, NodePosition } from './visualizer.js';

export type {
  AST,
  ASTNode,
  NodeClass,
  LinkClass,
  Instance,
  Connection,
  Connector,
  PortSpec,
  Position,
} from './types.js';

import { Parser } from './parser.js';
import { AST } from './types.js';

/**
 * Parse SADL source code into an AST
 */
export function parse(input: string): AST {
  const parser = new Parser();
  return parser.parse(input);
}
