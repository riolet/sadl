// Recursive descent parser for SADL

import { Lexer, Token, TokenType } from './lexer.js';
import { AST, NodeClass, LinkClass, Instance, Connection, Connector, PortSpec, InstanceEntry, Include } from './types.js';

export type FileResolver = (path: string, fromPath?: string) => string;

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private fileResolver?: FileResolver;
  private currentPath?: string;
  private includedPaths: Set<string> = new Set();

  parse(input: string, options?: { fileResolver?: FileResolver; filePath?: string }): AST {
    this.fileResolver = options?.fileResolver;
    this.currentPath = options?.filePath;
    this.includedPaths = new Set();
    if (this.currentPath) {
      this.includedPaths.add(this.currentPath);
    }

    return this.parseContent(input);
  }

  private parseContent(input: string): AST {
    const lexer = new Lexer(input);
    this.tokens = lexer.tokenize();
    this.pos = 0;

    const ast: AST = {
      includes: [],
      nodeClasses: [],
      linkClasses: [],
      instances: [],
      connections: [],
    };

    while (!this.isAtEnd()) {
      const node = this.parseTopLevel();
      if (node) {
        if (node.kind === 'Include') {
          ast.includes.push(node);
          this.processInclude(node, ast);
        } else if (node.kind === 'NodeClass') {
          ast.nodeClasses.push(node);
        } else if (node.kind === 'LinkClass') {
          ast.linkClasses.push(node);
        } else if (node.kind === 'Instance') {
          ast.instances.push(node);
        } else if (node.kind === 'Connection') {
          ast.connections.push(node);
        }
      }
    }

    return ast;
  }

  private processInclude(include: Include, ast: AST): void {
    if (!this.fileResolver) {
      return; // No resolver, includes tracked but not processed
    }

    const resolvedPath = include.path;
    if (this.includedPaths.has(resolvedPath)) {
      return; // Already included, skip to avoid cycles
    }
    this.includedPaths.add(resolvedPath);

    const content = this.fileResolver(resolvedPath, this.currentPath);
    const savedTokens = this.tokens;
    const savedPos = this.pos;
    const savedPath = this.currentPath;

    this.currentPath = resolvedPath;
    const includedAst = this.parseContent(content);

    // Merge included AST (only nodeClasses and linkClasses from libraries)
    ast.nodeClasses.push(...includedAst.nodeClasses);
    ast.linkClasses.push(...includedAst.linkClasses);

    // Restore parser state
    this.tokens = savedTokens;
    this.pos = savedPos;
    this.currentPath = savedPath;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.pos++;
    }
    return this.tokens[this.pos - 1];
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const token = this.peek();
    throw new Error(`${message} at line ${token.line}, column ${token.column}. Got ${token.type}`);
  }

  private parseTopLevel(): NodeClass | LinkClass | Instance | Connection | Include | null {
    if (this.check('INCLUDE')) {
      return this.parseInclude();
    } else if (this.check('NODECLASS')) {
      return this.parseNodeClass();
    } else if (this.check('LINKCLASS')) {
      return this.parseLinkClass();
    } else if (this.check('CONNECT')) {
      return this.parseConnection();
    } else if (this.check('IDENTIFIER')) {
      return this.parseInstance();
    }
    return null;
  }

  private parseInclude(): Include {
    const startToken = this.expect('INCLUDE', 'Expected include');
    const pathToken = this.expect('STRING', 'Expected file path string');

    return {
      kind: 'Include',
      path: pathToken.value,
      position: { line: startToken.line, column: startToken.column },
    };
  }

  private parseNodeClass(): NodeClass {
    const startToken = this.expect('NODECLASS', 'Expected nodeclass');
    const nameToken = this.expect('IDENTIFIER', 'Expected node class name');
    this.expect('COLON', 'Expected colon after node class name');

    const connectors: Connector[] = [];

    // Parse connectors: *name for server, name for client
    while (this.check('STAR') || this.isConnectorStart()) {
      connectors.push(this.parseConnector());
    }

    return {
      kind: 'NodeClass',
      name: nameToken.value,
      connectors,
      position: { line: startToken.line, column: startToken.column },
    };
  }

  // Check if current position looks like a connector start
  private isConnectorStart(): boolean {
    return this.check('IDENTIFIER');
  }

  private parseConnector(): Connector {
    let type: 'sercon' | 'clicon' = 'clicon';
    let startToken: Token;

    // Check for * prefix (server connector)
    if (this.match('STAR')) {
      type = 'sercon';
      startToken = this.tokens[this.pos - 1];
    } else {
      startToken = this.peek();
    }

    const nameToken = this.expect('IDENTIFIER', 'Expected connector name');
    const ports: PortSpec[] = [];

    // Port specs are optional (client connectors can have no ports)
    if (this.match('LPAREN')) {
      // Parse port specifications
      do {
        ports.push(this.parsePortSpec());
      } while (this.match('COMMA'));

      this.expect('RPAREN', 'Expected closing parenthesis');
    }

    return {
      type,
      name: nameToken.value,
      ports,
      position: { line: startToken.line, column: startToken.column },
    };
  }

  private parsePortSpec(): PortSpec {
    let protocol: 'TCP' | 'UDP' = 'TCP';

    // Check for UDP wrapper
    if (this.match('UDP')) {
      protocol = 'UDP';
      this.expect('LPAREN', 'Expected opening parenthesis after UDP');
      const innerSpec = this.parsePortOrRange();
      this.expect('RPAREN', 'Expected closing parenthesis after UDP port');
      return { protocol, ...innerSpec };
    }

    // Default TCP
    const spec = this.parsePortOrRange();
    return { protocol, ...spec };
  }

  private parsePortOrRange(): { port?: number; portRange?: { start: number; end: number } } {
    const startPort = this.expect('NUMBER', 'Expected port number');
    const port = parseInt(startPort.value, 10);

    // Check for range (e.g., 8000-8080)
    if (this.match('DASH')) {
      const endPort = this.expect('NUMBER', 'Expected end port number');
      return { portRange: { start: port, end: parseInt(endPort.value, 10) } };
    }

    return { port };
  }

  private parseLinkClass(): LinkClass {
    const startToken = this.expect('LINKCLASS', 'Expected linkclass');
    this.expect('LPAREN', 'Expected opening parenthesis');

    // Parse from: nodeClass.connector
    const fromNodeClass = this.expect('IDENTIFIER', 'Expected from node class');
    this.expect('DOT', 'Expected dot');
    const fromConnector = this.expect('IDENTIFIER', 'Expected from connector');

    this.expect('COMMA', 'Expected comma');

    // Parse to: nodeClass.connector
    const toNodeClass = this.expect('IDENTIFIER', 'Expected to node class');
    this.expect('DOT', 'Expected dot');
    const toConnector = this.expect('IDENTIFIER', 'Expected to connector');

    this.expect('RPAREN', 'Expected closing parenthesis');

    return {
      kind: 'LinkClass',
      from: {
        nodeClass: fromNodeClass.value,
        connector: fromConnector.value,
      },
      to: {
        nodeClass: toNodeClass.value,
        connector: toConnector.value,
      },
      position: { line: startToken.line, column: startToken.column },
    };
  }

  private parseInstance(): Instance {
    const nodeClassToken = this.expect('IDENTIFIER', 'Expected node class name');
    const instances: InstanceEntry[] = [];

    // Parse comma-separated instance entries: name or name(ip)
    instances.push(this.parseInstanceEntry());

    while (this.match('COMMA')) {
      instances.push(this.parseInstanceEntry());
    }

    return {
      kind: 'Instance',
      nodeClass: nodeClassToken.value,
      instances,
      position: { line: nodeClassToken.line, column: nodeClassToken.column },
    };
  }

  private parseInstanceEntry(): InstanceEntry {
    const nameToken = this.expect('IDENTIFIER', 'Expected instance name');
    let ip: string | undefined;

    // Check for optional IP address: name(192.168.1.10)
    if (this.match('LPAREN')) {
      ip = this.parseIPAddress();
      this.expect('RPAREN', 'Expected closing parenthesis after IP address');
    }

    return { name: nameToken.value, ip };
  }

  private parseIPAddress(): string {
    // Parse IP address: number.number.number.number
    const parts: string[] = [];

    const first = this.expect('NUMBER', 'Expected IP address octet');
    parts.push(first.value);

    while (this.match('DOT')) {
      const octet = this.expect('NUMBER', 'Expected IP address octet');
      parts.push(octet.value);
    }

    return parts.join('.');
  }

  private parseConnection(): Connection {
    const startToken = this.expect('CONNECT', 'Expected connect');
    this.expect('LPAREN', 'Expected opening parenthesis');

    const fromToken = this.expect('IDENTIFIER', 'Expected from instance');
    this.expect('COMMA', 'Expected comma');
    const toToken = this.expect('IDENTIFIER', 'Expected to instance');

    this.expect('RPAREN', 'Expected closing parenthesis');

    return {
      kind: 'Connection',
      from: fromToken.value,
      to: toToken.value,
      position: { line: startToken.line, column: startToken.column },
    };
  }
}
