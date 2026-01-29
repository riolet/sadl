// Recursive descent parser for SADL

import { Lexer, Token, TokenType } from './lexer.js';
import { AST, NodeClass, LinkClass, Instance, Connection, Connector, PortSpec } from './types.js';

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;

  parse(input: string): AST {
    const lexer = new Lexer(input);
    this.tokens = lexer.tokenize();
    this.pos = 0;

    const ast: AST = {
      nodeClasses: [],
      linkClasses: [],
      instances: [],
      connections: [],
    };

    while (!this.isAtEnd()) {
      const node = this.parseTopLevel();
      if (node) {
        if (node.kind === 'NodeClass') {
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

  private parseTopLevel(): NodeClass | LinkClass | Instance | Connection | null {
    if (this.check('NODECLASS')) {
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
    const names: string[] = [];

    // Parse comma-separated instance names
    const firstNameToken = this.expect('IDENTIFIER', 'Expected instance name');
    names.push(firstNameToken.value);

    while (this.match('COMMA')) {
      const nameToken = this.expect('IDENTIFIER', 'Expected instance name');
      names.push(nameToken.value);
    }

    return {
      kind: 'Instance',
      nodeClass: nodeClassToken.value,
      names,
      position: { line: nodeClassToken.line, column: nodeClassToken.column },
    };
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
