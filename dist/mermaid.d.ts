import { AST } from './types.js';
export type MermaidViewMode = 'instances' | 'schema';
export interface MermaidOptions {
    direction?: 'LR' | 'TB' | 'RL' | 'BT';
}
/**
 * Export SADL AST to Mermaid flowchart syntax
 */
export declare function toMermaid(ast: AST, mode: MermaidViewMode, options?: MermaidOptions): string;
