// Recursive descent parser for SADL

import { Lexer, Token, TokenType } from './lexer.js';
import { AST, NodeClass, LinkClass, Instance, Connection, Connector, PortSpec, InstanceEntry, Include } from './types.js';

export type FileResolver = (path: string, fromPath?: string) => string;

type Section = 'nodeclass' | 'linkclass' | 'instances' | 'connections' | null;

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private fileResolver?: FileResolver;
  private currentPath?: string;
  private includedPaths: Set<string> = new Set();
  private currentSection: Section = null;

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
    this.currentSection = null;

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
    const savedSection = this.currentSection;

    this.currentPath = resolvedPath;
    const includedAst = this.parseContent(content);

    // Merge included AST (only nodeClasses and linkClasses from libraries)
    ast.nodeClasses.push(...includedAst.nodeClasses);
    ast.linkClasses.push(...includedAst.linkClasses);

    // Restore parser state
    this.tokens = savedTokens;
    this.pos = savedPos;
    this.currentPath = savedPath;
    this.currentSection = savedSection;
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
    // Handle section headers
    if (this.check('SECTION_NODECLASS')) {
      this.advance();
      this.currentSection = 'nodeclass';
      return null;
    }
    if (this.check('SECTION_LINKCLASS')) {
      this.advance();
      this.currentSection = 'linkclass';
      return null;
    }
    if (this.check('SECTION_INSTANCES')) {
      this.advance();
      this.currentSection = 'instances';
      return null;
    }
    if (this.check('SECTION_CONNECTIONS')) {
      this.advance();
      this.currentSection = 'connections';
      return null;
    }

    // Handle include (can appear anywhere)
    if (this.check('INCLUDE')) {
      return this.parseInclude();
    }

    // Parse based on current section
    if (this.check('IDENTIFIER')) {
      if (this.currentSection === 'nodeclass') {
        return this.parseNodeClass();
      } else if (this.currentSection === 'linkclass') {
        return this.parseLinkClass();
      } else if (this.currentSection === 'instances') {
        return this.parseInstance();
      } else if (this.currentSection === 'connections') {
        return this.parseConnection();
      }
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
    const nameToken = this.expect('IDENTIFIER', 'Expected node class name');
    const startToken = nameToken;
    this.expect('DOUBLE_COLON', 'Expected :: after node class name');

    const connectors: Connector[] = [];

    // Parse connectors until we hit a section header or another node class definition
    while (this.check('IDENTIFIER') && !this.isNodeClassStart()) {
      connectors.push(this.parseConnector());
    }

    return {
      kind: 'NodeClass',
      name: nameToken.value,
      connectors,
      position: { line: startToken.line, column: startToken.column },
    };
  }

  // Check if we're at the start of a new node class definition (identifier followed by ::)
  private isNodeClassStart(): boolean {
    if (!this.check('IDENTIFIER')) return false;
    // Look ahead to see if there's a :: after the identifier
    const nextPos = this.pos + 1;
    if (nextPos < this.tokens.length) {
      return this.tokens[nextPos].type === 'DOUBLE_COLON';
    }
    return false;
  }

  private parseConnector(): Connector {
    const startToken = this.peek();
    const nameToken = this.expect('IDENTIFIER', 'Expected connector name');
    const ports: PortSpec[] = [];

    // Port specs are optional - presence of port determines sercon vs clicon
    if (this.match('LPAREN')) {
      // Parse port specifications
      do {
        ports.push(this.parsePortSpec());
      } while (this.match('COMMA'));

      this.expect('RPAREN', 'Expected closing parenthesis');
    }

    // Determine type based on presence of ports
    const type: 'sercon' | 'clicon' = ports.length > 0 ? 'sercon' : 'clicon';

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
    const startToken = this.peek();

    // Parse from: nodeClass.connector
    const fromNodeClass = this.expect('IDENTIFIER', 'Expected from node class');
    this.expect('DOT', 'Expected dot');
    const fromConnector = this.expect('IDENTIFIER', 'Expected from connector');

    // Arrow
    this.expect('ARROW', 'Expected -> arrow');

    // Parse to: nodeClass.connector
    const toNodeClass = this.expect('IDENTIFIER', 'Expected to node class');
    this.expect('DOT', 'Expected dot');
    const toConnector = this.expect('IDENTIFIER', 'Expected to connector');

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
    const startToken = this.peek();

    // Parse: from -> to
    const fromToken = this.expect('IDENTIFIER', 'Expected from instance');
    this.expect('ARROW', 'Expected -> arrow');
    const toToken = this.expect('IDENTIFIER', 'Expected to instance');

    return {
      kind: 'Connection',
      from: fromToken.value,
      to: toToken.value,
      position: { line: startToken.line, column: startToken.column },
    };
  }
}
