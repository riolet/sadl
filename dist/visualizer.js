// Canvas-based visualizer for SADL AST
const DEFAULT_OPTIONS = {
    width: 1200,
    height: 800,
    nodeWidth: 200,
    nodeHeight: 100,
    padding: 40,
    fontSize: 12,
    fontFamily: 'Arial, sans-serif',
    colors: {
        background: '#1a1a2e',
        node: '#16213e',
        nodeBorder: '#0f3460',
        nodeText: '#e8e8e8',
        sercon: '#4ecca3',
        clicon: '#ff6b6b',
        connection: '#7f8c8d',
        connectionText: '#bdc3c7',
    },
};
export class Visualizer {
    constructor(canvas, options = {}) {
        this.instances = [];
        this.connections = [];
        this.linkClasses = [];
        this.draggedNode = null;
        this.dragOffset = { x: 0, y: 0 };
        this.ast = null;
        this.viewMode = 'instances';
        // Viewport state for pan and zoom
        this.viewport = { x: 0, y: 0, scale: 1 };
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = ctx;
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            colors: { ...DEFAULT_OPTIONS.colors, ...options.colors },
        };
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.setupEventListeners();
    }
    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.viewport.x) / this.viewport.scale,
            y: (screenY - this.viewport.y) / this.viewport.scale,
        };
    }
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    }
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x, y } = this.screenToWorld(screenX, screenY);
        // Check if clicking on a node
        for (const instance of this.instances) {
            const pos = instance.position;
            if (x >= pos.x && x <= pos.x + pos.width && y >= pos.y && y <= pos.y + pos.height) {
                this.draggedNode = instance;
                this.dragOffset = { x: x - pos.x, y: y - pos.y };
                this.canvas.style.cursor = 'grabbing';
                return;
            }
        }
        // Start panning if not clicking on a node
        this.isPanning = true;
        this.panStart = { x: screenX - this.viewport.x, y: screenY - this.viewport.y };
        this.canvas.style.cursor = 'grabbing';
    }
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        if (this.draggedNode) {
            const { x, y } = this.screenToWorld(screenX, screenY);
            this.draggedNode.position.x = x - this.dragOffset.x;
            this.draggedNode.position.y = y - this.dragOffset.y;
            this.render();
        }
        else if (this.isPanning) {
            this.viewport.x = screenX - this.panStart.x;
            this.viewport.y = screenY - this.panStart.y;
            this.render();
        }
        else {
            // Update cursor on hover
            const { x, y } = this.screenToWorld(screenX, screenY);
            let hovering = false;
            for (const instance of this.instances) {
                const pos = instance.position;
                if (x >= pos.x && x <= pos.x + pos.width && y >= pos.y && y <= pos.y + pos.height) {
                    hovering = true;
                    break;
                }
            }
            this.canvas.style.cursor = hovering ? 'grab' : 'move';
        }
    }
    onMouseUp() {
        this.draggedNode = null;
        this.isPanning = false;
        this.canvas.style.cursor = 'move';
    }
    onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        // Zoom factor
        const zoomIntensity = 0.1;
        const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
        const newScale = Math.min(Math.max(0.1, this.viewport.scale + delta), 5);
        // Zoom toward mouse position
        const worldX = (screenX - this.viewport.x) / this.viewport.scale;
        const worldY = (screenY - this.viewport.y) / this.viewport.scale;
        this.viewport.scale = newScale;
        this.viewport.x = screenX - worldX * newScale;
        this.viewport.y = screenY - worldY * newScale;
        this.render();
    }
    render(ast, mode) {
        if (ast) {
            this.ast = ast;
            this.viewMode = mode || (ast.instances.length > 0 ? 'instances' : 'schema');
            if (this.viewMode === 'schema') {
                this.layoutSchema(ast);
                this.linkClasses = ast.linkClasses;
            }
            else {
                this.layoutInstances(ast);
                this.connections = ast.connections;
            }
            this.autoSizeCanvas();
        }
        const { ctx, options } = this;
        const { colors } = options;
        // Clear canvas (in screen space, before transform)
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Apply viewport transform
        ctx.save();
        ctx.translate(this.viewport.x, this.viewport.y);
        ctx.scale(this.viewport.scale, this.viewport.scale);
        // Draw connections/links first (behind nodes)
        if (this.viewMode === 'schema') {
            this.drawLinkClasses();
        }
        else {
            this.drawConnections();
        }
        // Draw instances/node classes
        for (const instance of this.instances) {
            this.drawInstance(instance);
        }
        // Restore context
        ctx.restore();
    }
    layoutSchema(ast) {
        this.instances = [];
        // Build adjacency info from link classes
        const outgoing = new Map(); // from nodeClass -> [to nodeClass]
        const incoming = new Map(); // to nodeClass -> [from nodeClass]
        for (const nc of ast.nodeClasses) {
            outgoing.set(nc.name, []);
            incoming.set(nc.name, []);
        }
        for (const link of ast.linkClasses) {
            outgoing.get(link.from.nodeClass)?.push(link.to.nodeClass);
            incoming.get(link.to.nodeClass)?.push(link.from.nodeClass);
        }
        // Assign layers using longest path from sources
        const layers = new Map();
        const visited = new Set();
        const assignLayer = (name) => {
            if (layers.has(name))
                return layers.get(name);
            if (visited.has(name))
                return 0;
            visited.add(name);
            const incomingNodes = incoming.get(name) || [];
            if (incomingNodes.length === 0) {
                layers.set(name, 0);
                return 0;
            }
            const maxParentLayer = Math.max(...incomingNodes.map(assignLayer));
            const layer = maxParentLayer + 1;
            layers.set(name, layer);
            return layer;
        };
        for (const nc of ast.nodeClasses) {
            assignLayer(nc.name);
        }
        // Group by layer
        const layerGroups = new Map();
        for (const nc of ast.nodeClasses) {
            const layer = layers.get(nc.name) || 0;
            if (!layerGroups.has(layer)) {
                layerGroups.set(layer, []);
            }
            layerGroups.get(layer).push(nc);
        }
        // Sort within layers to minimize crossings
        const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);
        const rowPositions = new Map();
        for (const layerIdx of sortedLayers) {
            const layerNodes = layerGroups.get(layerIdx);
            if (layerIdx === 0) {
                layerNodes.sort((a, b) => a.name.localeCompare(b.name));
                layerNodes.forEach((nc, i) => rowPositions.set(nc.name, i));
            }
            else {
                layerNodes.sort((a, b) => {
                    const aIncoming = incoming.get(a.name) || [];
                    const bIncoming = incoming.get(b.name) || [];
                    const aAvg = aIncoming.length > 0
                        ? aIncoming.reduce((sum, n) => sum + (rowPositions.get(n) || 0), 0) / aIncoming.length
                        : 0;
                    const bAvg = bIncoming.length > 0
                        ? bIncoming.reduce((sum, n) => sum + (rowPositions.get(n) || 0), 0) / bIncoming.length
                        : 0;
                    return aAvg - bAvg;
                });
                layerNodes.forEach((nc, i) => rowPositions.set(nc.name, i));
            }
        }
        // Calculate positions
        const { nodeWidth, nodeHeight, padding } = this.options;
        const columnSpacing = nodeWidth + padding * 3;
        const rowSpacing = nodeHeight + padding * 2;
        for (const nodeClass of ast.nodeClasses) {
            const layer = layers.get(nodeClass.name) || 0;
            const row = rowPositions.get(nodeClass.name) || 0;
            const connectorSpacing = 24;
            const contentStart = 40;
            const sercons = nodeClass.connectors.filter((c) => c.type === 'sercon');
            const clicons = nodeClass.connectors.filter((c) => c.type === 'clicon');
            const maxConnectors = Math.max(sercons.length, clicons.length);
            const height = Math.max(nodeHeight, contentStart + maxConnectors * connectorSpacing + 15);
            const connectors = [
                ...sercons.map((c, ci) => ({
                    name: c.name,
                    type: c.type,
                    y: contentStart + ci * connectorSpacing,
                })),
                ...clicons.map((c, ci) => ({
                    name: c.name,
                    type: c.type,
                    y: contentStart + ci * connectorSpacing,
                })),
            ];
            this.instances.push({
                name: nodeClass.name,
                nodeClass,
                position: {
                    x: padding + layer * columnSpacing,
                    y: padding + row * rowSpacing,
                    width: nodeWidth,
                    height,
                },
                connectors,
            });
        }
    }
    drawLinkClasses() {
        const { ctx, options } = this;
        const { colors } = options;
        for (const link of this.linkClasses) {
            const fromInstance = this.instances.find((i) => i.name === link.from.nodeClass);
            const toInstance = this.instances.find((i) => i.name === link.to.nodeClass);
            if (!fromInstance || !toInstance)
                continue;
            // Find the specific connectors
            const fromConnector = fromInstance.connectors.find((c) => c.name === link.from.connector);
            const toConnector = toInstance.connectors.find((c) => c.name === link.to.connector);
            if (!fromConnector || !toConnector)
                continue;
            const connectorRadius = 6;
            const fromX = fromInstance.position.x + fromInstance.position.width + connectorRadius;
            const fromY = fromInstance.position.y + fromConnector.y;
            const toX = toInstance.position.x - connectorRadius;
            const toY = toInstance.position.y + toConnector.y;
            // Draw curved connection line
            ctx.strokeStyle = colors.connection;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            const midX = (fromX + toX) / 2;
            ctx.bezierCurveTo(midX, fromY, midX, toY, toX, toY);
            ctx.stroke();
            // Draw arrow at end
            const arrowSize = 8;
            ctx.fillStyle = colors.connection;
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - arrowSize, toY - arrowSize / 2);
            ctx.lineTo(toX - arrowSize, toY + arrowSize / 2);
            ctx.closePath();
            ctx.fill();
        }
    }
    autoSizeCanvas() {
        const { padding } = this.options;
        let maxX = 0;
        let maxY = 0;
        for (const instance of this.instances) {
            const rightEdge = instance.position.x + instance.position.width;
            const bottomEdge = instance.position.y + instance.position.height;
            maxX = Math.max(maxX, rightEdge);
            maxY = Math.max(maxY, bottomEdge);
        }
        const requiredWidth = maxX + padding;
        const requiredHeight = maxY + padding;
        // Only resize if content exceeds current size
        const newWidth = Math.max(this.options.width, requiredWidth);
        const newHeight = Math.max(this.options.height, requiredHeight);
        if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
        }
    }
    layoutInstances(ast) {
        this.instances = [];
        // Create a map of node classes
        const nodeClassMap = new Map();
        for (const nc of ast.nodeClasses) {
            nodeClassMap.set(nc.name, nc);
        }
        // Flatten all instances
        const allInstances = [];
        for (const inst of ast.instances) {
            for (const entry of inst.instances) {
                allInstances.push({ name: entry.name, nodeClass: inst.nodeClass, ip: entry.ip });
            }
        }
        // Build adjacency info for layered layout
        const outgoing = new Map(); // from -> [to]
        const incoming = new Map(); // to -> [from]
        for (const inst of allInstances) {
            outgoing.set(inst.name, []);
            incoming.set(inst.name, []);
        }
        for (const conn of ast.connections) {
            outgoing.get(conn.from)?.push(conn.to);
            incoming.get(conn.to)?.push(conn.from);
        }
        // Assign layers using longest path from sources
        const layers = new Map();
        const visited = new Set();
        const assignLayer = (name) => {
            if (layers.has(name))
                return layers.get(name);
            if (visited.has(name))
                return 0; // cycle detection
            visited.add(name);
            const incomingNodes = incoming.get(name) || [];
            if (incomingNodes.length === 0) {
                layers.set(name, 0);
                return 0;
            }
            const maxParentLayer = Math.max(...incomingNodes.map(assignLayer));
            const layer = maxParentLayer + 1;
            layers.set(name, layer);
            return layer;
        };
        for (const inst of allInstances) {
            assignLayer(inst.name);
        }
        // Group instances by layer
        const layerGroups = new Map();
        for (const inst of allInstances) {
            const layer = layers.get(inst.name) || 0;
            if (!layerGroups.has(layer)) {
                layerGroups.set(layer, []);
            }
            layerGroups.get(layer).push(inst);
        }
        // Sort instances within each layer to minimize edge crossings
        // Use the average position of connected nodes in the previous layer
        const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);
        const rowPositions = new Map();
        for (const layerIdx of sortedLayers) {
            const layerInsts = layerGroups.get(layerIdx);
            if (layerIdx === 0) {
                // First layer: sort by name for consistency
                layerInsts.sort((a, b) => a.name.localeCompare(b.name));
                layerInsts.forEach((inst, i) => rowPositions.set(inst.name, i));
            }
            else {
                // Sort by average row position of incoming connections
                layerInsts.sort((a, b) => {
                    const aIncoming = incoming.get(a.name) || [];
                    const bIncoming = incoming.get(b.name) || [];
                    const aAvg = aIncoming.length > 0
                        ? aIncoming.reduce((sum, n) => sum + (rowPositions.get(n) || 0), 0) / aIncoming.length
                        : 0;
                    const bAvg = bIncoming.length > 0
                        ? bIncoming.reduce((sum, n) => sum + (rowPositions.get(n) || 0), 0) / bIncoming.length
                        : 0;
                    return aAvg - bAvg;
                });
                layerInsts.forEach((inst, i) => rowPositions.set(inst.name, i));
            }
        }
        // Calculate positions
        const { nodeWidth, nodeHeight, padding } = this.options;
        const columnSpacing = nodeWidth + padding * 3;
        const rowSpacing = nodeHeight + padding * 2;
        for (const inst of allInstances) {
            const nodeClass = nodeClassMap.get(inst.nodeClass);
            if (!nodeClass)
                continue;
            const layer = layers.get(inst.name) || 0;
            const row = rowPositions.get(inst.name) || 0;
            const connectorSpacing = 24;
            const contentStart = 55;
            const sercons = nodeClass.connectors.filter((c) => c.type === 'sercon');
            const clicons = nodeClass.connectors.filter((c) => c.type === 'clicon');
            const maxConnectors = Math.max(sercons.length, clicons.length);
            const height = Math.max(nodeHeight, contentStart + maxConnectors * connectorSpacing + 15);
            const connectors = [
                ...sercons.map((c, ci) => ({
                    name: c.name,
                    type: c.type,
                    y: contentStart + ci * connectorSpacing,
                })),
                ...clicons.map((c, ci) => ({
                    name: c.name,
                    type: c.type,
                    y: contentStart + ci * connectorSpacing,
                })),
            ];
            this.instances.push({
                name: inst.name,
                ip: inst.ip,
                nodeClass,
                position: {
                    x: padding + layer * columnSpacing,
                    y: padding + row * rowSpacing,
                    width: nodeWidth,
                    height,
                },
                connectors,
            });
        }
    }
    drawInstance(instance) {
        const { ctx, options } = this;
        const { colors, fontSize, fontFamily } = options;
        const { position, name, nodeClass, connectors } = instance;
        // Draw node background
        ctx.fillStyle = colors.node;
        ctx.strokeStyle = colors.nodeBorder;
        ctx.lineWidth = 2;
        this.roundRect(position.x, position.y, position.width, position.height, 8);
        ctx.fill();
        ctx.stroke();
        // Draw header
        ctx.fillStyle = colors.nodeBorder;
        ctx.beginPath();
        ctx.moveTo(position.x + 8, position.y);
        ctx.lineTo(position.x + position.width - 8, position.y);
        ctx.quadraticCurveTo(position.x + position.width, position.y, position.x + position.width, position.y + 8);
        ctx.lineTo(position.x + position.width, position.y + 28);
        ctx.lineTo(position.x, position.y + 28);
        ctx.lineTo(position.x, position.y + 8);
        ctx.quadraticCurveTo(position.x, position.y, position.x + 8, position.y);
        ctx.fill();
        // Draw instance/class name
        ctx.fillStyle = colors.nodeText;
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText(name, position.x + position.width / 2, position.y + 18, position.width - 10);
        // Draw subtitle (node class name and optional IP) - only in instance mode
        if (this.viewMode === 'instances') {
            ctx.font = `${fontSize - 2}px ${fontFamily}`;
            ctx.fillStyle = colors.connectionText;
            const subtitle = instance.ip ? `(${nodeClass.name}) ${instance.ip}` : `(${nodeClass.name})`;
            ctx.fillText(subtitle, position.x + position.width / 2, position.y + 45, position.width - 10);
        }
        // Draw connectors on the edge
        ctx.font = `${fontSize - 2}px ${fontFamily}`;
        const connectorRadius = 6;
        for (const connector of connectors) {
            const cy = position.y + connector.y;
            const isServer = connector.type === 'sercon';
            // Position: sercon on left edge, clicon on right edge
            const cx = isServer ? position.x : position.x + position.width;
            // Connector circle on edge
            ctx.fillStyle = colors.node;
            ctx.strokeStyle = isServer ? colors.sercon : colors.clicon;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, connectorRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Connector label
            ctx.fillStyle = colors.nodeText;
            if (isServer) {
                ctx.textAlign = 'left';
                ctx.fillText(connector.name, position.x + 12, cy + 4, position.width / 2 - 15);
            }
            else {
                ctx.textAlign = 'right';
                ctx.fillText(connector.name, position.x + position.width - 12, cy + 4, position.width / 2 - 15);
            }
        }
    }
    drawConnections() {
        const { ctx, options } = this;
        const { colors } = options;
        for (const conn of this.connections) {
            const fromInstance = this.instances.find((i) => i.name === conn.from);
            const toInstance = this.instances.find((i) => i.name === conn.to);
            if (!fromInstance || !toInstance)
                continue;
            // Find client connector on from instance
            const fromConnector = fromInstance.connectors.find((c) => c.type === 'clicon');
            // Find server connector on to instance
            const toConnector = toInstance.connectors.find((c) => c.type === 'sercon');
            if (!fromConnector || !toConnector)
                continue;
            const connectorRadius = 6;
            // clicon is on right edge, sercon is on left edge
            const fromX = fromInstance.position.x + fromInstance.position.width + connectorRadius;
            const fromY = fromInstance.position.y + fromConnector.y;
            const toX = toInstance.position.x - connectorRadius;
            const toY = toInstance.position.y + toConnector.y;
            // Draw curved connection line
            ctx.strokeStyle = colors.connection;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            const midX = (fromX + toX) / 2;
            ctx.bezierCurveTo(midX, fromY, midX, toY, toX, toY);
            ctx.stroke();
            // Draw arrow at end
            const arrowSize = 8;
            ctx.fillStyle = colors.connection;
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - arrowSize, toY - arrowSize / 2);
            ctx.lineTo(toX - arrowSize, toY + arrowSize / 2);
            ctx.closePath();
            ctx.fill();
        }
    }
    roundRect(x, y, w, h, r) {
        const { ctx } = this;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}
