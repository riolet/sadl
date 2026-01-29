# SADL

System Architecture Design Language

## Overview

SADL is a language for describing and designing system architectures. It models systems as entities with connections between them.

## Syntax

### Node Classes

Define entity templates with connectors:

```sadl
nodeclass web_server:
    sercon https_listener (443, TCP)
    clicon mysql_connector (3306, TCP)
```

- `sercon` - Server connector (port, protocol) - listens for connections
- `clicon` - Client connector (port, protocol) - initiates connections

### Link Classes

Define valid connection patterns between connector types:

```sadl
linkclass (browser_client.https_connector, web_server.https_listener)
```

### Instantiation

Create instances of node classes:

```sadl
web_server internal_web_server, external_web_server
```

### Connections

Connect instances:

```sadl
connect (internal_browser_client, internal_web_server)
```

### Comments

Lines starting with `#` are comments.

## License

GPL-3.0 - See [LICENSE](LICENSE) for details.
