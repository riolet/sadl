# SADL

System Architecture Design Language

## Overview

SADL is a language for describing and designing system architectures. It models systems as entities with connections between them.

## Syntax

### Node Classes

Define entity templates with connectors:

```sadl
nodeclass web_server:
    *https_listener (443)
    mysql_connector
```

- `*name (port)` - Server connector (listens for connections)
- `name` or `name (port)` - Client connector (initiates connections)

Port is optional for client connectors (ephemeral ports).

#### Multiple Ports and Ranges

```sadl
nodeclass proxy:
    *ports (80, 443, 8000-8080)
```

#### UDP Protocol

TCP is the default. Use `UDP()` wrapper for UDP:

```sadl
nodeclass dns_server:
    *dns_listener (UDP(53))
```

### Link Classes

Define valid connection patterns between connector types:

```sadl
linkclass (browser_client.https_connector, web_server.https_listener)
```

### Instantiation

Create instances of node classes, optionally with IP addresses:

```sadl
web_server internal_web_server(192.168.1.10), external_web_server(10.0.10.10)
browser_client my_browser
```

### Connections

Connect instances:

```sadl
connect (my_browser, internal_web_server)
```

### Comments

Lines starting with `#` are comments.

## Visualization (sadlmap)

SADL includes an interactive visualizer called sadlmap.

### Run with Docker

```bash
docker run -p 8080:80 riolet/sadlmap
```

Then open http://localhost:8080

### Features

- Pan: drag on empty space
- Zoom: mouse wheel
- Drag nodes to reposition

## License

GPL-3.0 - See [LICENSE](LICENSE) for details.
