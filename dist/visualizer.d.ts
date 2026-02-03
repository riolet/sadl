import { AST, NodeClass } from './types.js';
export type ViewMode = 'instances' | 'schema';
export interface NodePosition {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface RenderedInstance {
    name: string;
    ip?: string;
    nodeClass: NodeClass;
    position: NodePosition;
    connectors: {
        name: string;
        type: 'sercon' | 'clicon';
        y: number;
    }[];
}
export interface RenderedNAT {
    name: string;
    externalIp: string;
    internalIp: string;
    position: NodePosition;
}
interface Colors {
    background: string;
    node: string;
    nodeBorder: string;
    nodeText: string;
    sercon: string;
    clicon: string;
    nat: string;
    connection: string;
    connectionText: string;
}
export interface VisualizerOptions {
    width?: number;
    height?: number;
    nodeWidth?: number;
    nodeHeight?: number;
    padding?: number;
    fontSize?: number;
    fontFamily?: string;
    colors?: Partial<Colors>;
}
export declare class Visualizer {
    private canvas;
    private ctx;
    private options;
    private instances;
    private nats;
    private connections;
    private linkClasses;
    private draggedNode;
    private dragOffset;
    private ast;
    private viewMode;
    private viewport;
    private isPanning;
    private panStart;
    constructor(canvas: HTMLCanvasElement, options?: VisualizerOptions);
    private screenToWorld;
    private setupEventListeners;
    private onMouseDown;
    private onMouseMove;
    private onMouseUp;
    private onWheel;
    render(ast?: AST, mode?: ViewMode): void;
    private layoutSchema;
    private drawLinkClasses;
    private autoSizeCanvas;
    private layoutInstances;
    private drawInstance;
    private drawNAT;
    private drawConnections;
    private roundRect;
}
export {};
