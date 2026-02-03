// Recursive descent parser for SADL
import { Lexer } from './lexer.js';
export class Parser {
    constructor() {
        this.tokens = [];
        this.pos = 0;
        this.includedPaths = new Set();
        this.currentSection = null;
    }
    parse(input, options) {
        this.fileResolver = options?.fileResolver;
        this.currentPath = options?.filePath;
        this.includedPaths = new Set();
        if (this.currentPath) {
            this.includedPaths.add(this.currentPath);
        }
        return this.parseContent(input);
    }
    parseContent(input) {
        const lexer = new Lexer(input);
        this.tokens = lexer.tokenize();
        this.pos = 0;
        this.currentSection = null;
        const ast = {
            includes: [],
            nodeClasses: [],
            linkClasses: [],
            instances: [],
            nats: [],
            connections: [],
        };
        while (!this.isAtEnd()) {
            const node = this.parseTopLevel();
            if (node) {
                if (node.kind === 'Include') {
                    ast.includes.push(node);
                    this.processInclude(node, ast);
                }
                else if (node.kind === 'NodeClass') {
                    ast.nodeClasses.push(node);
                }
                else if (node.kind === 'LinkClass') {
                    ast.linkClasses.push(node);
                }
                else if (node.kind === 'Instance') {
                    ast.instances.push(node);
                }
                else if (node.kind === 'NAT') {
                    ast.nats.push(node);
                }
                else if (node.kind === 'Connection') {
                    ast.connections.push(node);
                }
            }
        }
        return ast;
    }
    processInclude(include, ast) {
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
    peek() {
        return this.tokens[this.pos];
    }
    isAtEnd() {
        return this.peek().type === 'EOF';
    }
    advance() {
        if (!this.isAtEnd()) {
            this.pos++;
        }
        return this.tokens[this.pos - 1];
    }
    check(type) {
        return this.peek().type === type;
    }
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    expect(type, message) {
        if (this.check(type)) {
            return this.advance();
        }
        const token = this.peek();
        throw new Error(`${message} at line ${token.line}, column ${token.column}. Got ${token.type}`);
    }
    parseTopLevel() {
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
        if (this.check('SECTION_NATS')) {
            this.advance();
            this.currentSection = 'nats';
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
        if (this.currentSection === 'nodeclass' && this.check('IDENTIFIER')) {
            return this.parseNodeClass();
        }
        else if (this.currentSection === 'linkclass' && this.check('IDENTIFIER')) {
            return this.parseLinkClass();
        }
        else if (this.currentSection === 'instances' && this.check('IDENTIFIER')) {
            return this.parseInstance();
        }
        else if (this.currentSection === 'nats' && this.check('AT')) {
            return this.parseNAT();
        }
        else if (this.currentSection === 'connections' && this.check('IDENTIFIER')) {
            return this.parseConnection();
        }
        return null;
    }
    parseInclude() {
        const startToken = this.expect('INCLUDE', 'Expected include');
        const pathToken = this.expect('STRING', 'Expected file path string');
        return {
            kind: 'Include',
            path: pathToken.value,
            position: { line: startToken.line, column: startToken.column },
        };
    }
    parseNodeClass() {
        const nameToken = this.expect('IDENTIFIER', 'Expected node class name');
        const startToken = nameToken;
        this.expect('DOUBLE_COLON', 'Expected :: after node class name');
        const connectors = [];
        // Parse connectors until we hit a section header or another node class definition
        // Connectors can start with * (client) or identifier (server)
        while ((this.check('IDENTIFIER') || this.check('STAR')) && !this.isNodeClassStart()) {
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
    isNodeClassStart() {
        if (!this.check('IDENTIFIER'))
            return false;
        // Look ahead to see if there's a :: after the identifier
        const nextPos = this.pos + 1;
        if (nextPos < this.tokens.length) {
            return this.tokens[nextPos].type === 'DOUBLE_COLON';
        }
        return false;
    }
    // Check if current position is at a connector (not a node class start)
    isConnectorStart() {
        if (this.check('STAR'))
            return true;
        if (this.check('IDENTIFIER') && !this.isNodeClassStart())
            return true;
        return false;
    }
    parseConnector() {
        const startToken = this.peek();
        // Check for * prefix (client connector)
        const isClient = this.match('STAR');
        const nameToken = this.expect('IDENTIFIER', 'Expected connector name');
        const ports = [];
        // Port specs are optional for server connectors
        if (this.match('LPAREN')) {
            // Parse port specifications
            do {
                ports.push(this.parsePortSpec());
            } while (this.match('COMMA'));
            this.expect('RPAREN', 'Expected closing parenthesis');
        }
        // * prefix means client connector, otherwise server connector
        const type = isClient ? 'clicon' : 'sercon';
        return {
            type,
            name: nameToken.value,
            ports,
            position: { line: startToken.line, column: startToken.column },
        };
    }
    parsePortSpec() {
        let protocol = 'TCP';
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
    parsePortOrRange() {
        const startPort = this.expect('NUMBER', 'Expected port number');
        const port = parseInt(startPort.value, 10);
        // Check for range (e.g., 8000-8080)
        if (this.match('DASH')) {
            const endPort = this.expect('NUMBER', 'Expected end port number');
            return { portRange: { start: port, end: parseInt(endPort.value, 10) } };
        }
        return { port };
    }
    parseLinkClass() {
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
    parseInstance() {
        const nodeClassToken = this.expect('IDENTIFIER', 'Expected node class name');
        const instances = [];
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
    parseInstanceEntry() {
        const nameToken = this.expect('IDENTIFIER', 'Expected instance name');
        let ip;
        // Check for optional IP address: name(192.168.1.10)
        if (this.match('LPAREN')) {
            ip = this.parseIPAddress();
            this.expect('RPAREN', 'Expected closing parenthesis after IP address');
        }
        return { name: nameToken.value, ip };
    }
    parseIPAddress() {
        // Parse IP address: number.number.number.number
        const parts = [];
        const first = this.expect('NUMBER', 'Expected IP address octet');
        parts.push(first.value);
        while (this.match('DOT')) {
            const octet = this.expect('NUMBER', 'Expected IP address octet');
            parts.push(octet.value);
        }
        return parts.join('.');
    }
    parseNAT() {
        const startToken = this.expect('AT', 'Expected @ for NAT');
        const nameToken = this.expect('IDENTIFIER', 'Expected NAT name');
        this.expect('LPAREN', 'Expected opening parenthesis');
        const externalIp = this.parseIPAddress();
        this.expect('COMMA', 'Expected comma between IPs');
        const internalIp = this.parseIPAddress();
        this.expect('RPAREN', 'Expected closing parenthesis');
        return {
            kind: 'NAT',
            name: nameToken.value,
            externalIp,
            internalIp,
            position: { line: startToken.line, column: startToken.column },
        };
    }
    parseConnection() {
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
