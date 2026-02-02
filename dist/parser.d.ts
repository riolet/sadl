import { AST } from './types.js';
export type FileResolver = (path: string, fromPath?: string) => string;
export declare class Parser {
    private tokens;
    private pos;
    private fileResolver?;
    private currentPath?;
    private includedPaths;
    private currentSection;
    parse(input: string, options?: {
        fileResolver?: FileResolver;
        filePath?: string;
    }): AST;
    private parseContent;
    private processInclude;
    private peek;
    private isAtEnd;
    private advance;
    private check;
    private match;
    private expect;
    private parseTopLevel;
    private parseInclude;
    private parseNodeClass;
    private isNodeClassStart;
    private isConnectorStart;
    private parseConnector;
    private parsePortSpec;
    private parsePortOrRange;
    private parseLinkClass;
    private parseInstance;
    private parseInstanceEntry;
    private parseIPAddress;
    private parseConnection;
}
