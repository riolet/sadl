// AST Node Types for SADL

export interface Position {
  line: number;
  column: number;
}

export interface BaseNode {
  position?: Position;
}

export interface PortSpec {
  protocol: 'TCP' | 'UDP';
  port?: number;
  portRange?: { start: number; end: number };
}

export interface Connector extends BaseNode {
  type: 'sercon' | 'clicon';
  name: string;
  ports: PortSpec[];  // Empty for ephemeral client connectors
}

export interface NodeClass extends BaseNode {
  kind: 'NodeClass';
  name: string;
  connectors: Connector[];
}

export interface LinkClass extends BaseNode {
  kind: 'LinkClass';
  from: {
    nodeClass: string;
    connector: string;
  };
  to: {
    nodeClass: string;
    connector: string;
  };
}

export interface InstanceEntry {
  name: string;
  ip?: string;
}

export interface Instance extends BaseNode {
  kind: 'Instance';
  nodeClass: string;
  instances: InstanceEntry[];
}

export interface Connection extends BaseNode {
  kind: 'Connection';
  from: string;
  to: string;
}

export interface NAT extends BaseNode {
  kind: 'NAT';
  name: string;
  externalIp: string;
  internalIp: string;
}

export type ASTNode = NodeClass | LinkClass | Instance | Connection | NAT;

export interface Include extends BaseNode {
  kind: 'Include';
  path: string;
}

export interface AST {
  includes: Include[];
  nodeClasses: NodeClass[];
  linkClasses: LinkClass[];
  instances: Instance[];
  nats: NAT[];
  connections: Connection[];
}
