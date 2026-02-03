// Mermaid diagram exporter for SADL
/**
 * Export SADL AST to Mermaid flowchart syntax
 */
export function toMermaid(ast, mode, options) {
    const direction = options?.direction || 'LR';
    if (mode === 'schema') {
        return toMermaidSchema(ast, direction);
    }
    else {
        return toMermaidInstances(ast, direction);
    }
}
function toMermaidSchema(ast, direction) {
    const lines = [`flowchart ${direction}`];
    // Create subgraphs for each node class with their connectors
    for (const nodeClass of ast.nodeClasses) {
        const nodeId = sanitizeId(nodeClass.name);
        lines.push(`    subgraph ${nodeId}["${escapeLabel(nodeClass.name)}"]`);
        for (const connector of nodeClass.connectors) {
            const connId = `${nodeId}_${sanitizeId(connector.name)}`;
            const portInfo = connector.ports.length > 0
                ? ` :${connector.ports.map(p => p.port || `${p.portRange?.start}-${p.portRange?.end}`).join(', ')}`
                : '';
            const prefix = connector.type === 'clicon' ? '* ' : '';
            lines.push(`        ${connId}["${escapeLabel(prefix + connector.name + portInfo)}"]`);
        }
        lines.push(`    end`);
    }
    // Add link classes as connections between connectors
    for (const linkClass of ast.linkClasses) {
        const fromId = `${sanitizeId(linkClass.from.nodeClass)}_${sanitizeId(linkClass.from.connector)}`;
        const toId = `${sanitizeId(linkClass.to.nodeClass)}_${sanitizeId(linkClass.to.connector)}`;
        lines.push(`    ${fromId} --> ${toId}`);
    }
    return lines.join('\n');
}
function toMermaidInstances(ast, direction) {
    const lines = [`flowchart ${direction}`];
    // Build a map of instance name to node class
    const instanceToClass = new Map();
    for (const inst of ast.instances) {
        for (const entry of inst.instances) {
            instanceToClass.set(entry.name, inst.nodeClass);
        }
    }
    // Build a map of NAT name to NAT info
    const natMap = new Map();
    for (const nat of ast.nats) {
        natMap.set(nat.name, { externalIp: nat.externalIp, internalIp: nat.internalIp });
    }
    // Create nodes for each instance
    for (const inst of ast.instances) {
        for (const entry of inst.instances) {
            const nodeId = sanitizeId(entry.name);
            const label = entry.ip
                ? `${entry.name}<br/>${entry.ip}`
                : entry.name;
            lines.push(`    ${nodeId}["${escapeLabel(label)}"]`);
        }
    }
    // Create nodes for NATs (shown as hexagons)
    for (const nat of ast.nats) {
        const nodeId = sanitizeId(nat.name);
        const label = `NAT<br/>${nat.externalIp}`;
        lines.push(`    ${nodeId}{{{"${escapeLabel(label)}"}}}`);
        ;
    }
    // Add connections
    for (const conn of ast.connections) {
        const fromId = sanitizeId(conn.from);
        const toId = sanitizeId(conn.to);
        lines.push(`    ${fromId} --> ${toId}`);
    }
    return lines.join('\n');
}
/**
 * Sanitize a string to be a valid Mermaid node ID
 */
function sanitizeId(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
}
/**
 * Escape special characters in Mermaid labels
 */
function escapeLabel(label) {
    // Escape quotes and other problematic characters
    return label.replace(/"/g, '&quot;');
}
