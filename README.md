# SADL

System Architecture Design Language

## Overview

SADL is a language for describing and designing system architectures. It models systems as entities with connections between them.

## Syntax

SADL files are organized into sections: `#nodeclass`, `#linkclass`, `#instances`, and `#connections`.

### Node Classes

Define entity templates with connectors:

```sadl
#nodeclass
web_server::
    https_listener (443)
    mysql_connector
```

- `name (port)` - Server connector (has a port, listens for connections)
- `name` - Client connector (no port, initiates connections)

The connector type is determined by whether a port is specified.

#### Multiple Ports and Ranges

```sadl
proxy::
    ports (80, 443, 8000-8080)
```

#### UDP Protocol

TCP is the default. Use `UDP()` wrapper for UDP:

```sadl
dns_server::
    dns_listener (UDP(53))
```

### Link Classes

Define valid connection patterns between connector types using arrow syntax:

```sadl
#linkclass
browser_client.https_connector -> web_server.https_listener
web_server.mysql_connector -> mysql_server.mysql_listener
```

### Instances

Create instances of node classes, optionally with IP addresses:

```sadl
#instances
web_server internal_web_server(192.168.1.10), external_web_server(10.0.10.10)
browser_client my_browser
```

### Connections

Connect instances using arrow syntax:

```sadl
#connections
my_browser -> internal_web_server
internal_web_server -> primary_mysql_server
```

### Comments

Lines starting with `#` (other than section headers) are comments.

### Include

Include other SADL files to reuse definitions:

```sadl
include "lib/webstack.sadl"
```

## Complete Example

```sadl
#nodeclass
browser_client::
    https_connector

web_server::
    https_listener (443)
    mysql_connector

mysql_server::
    mysql_listener (3306)

#linkclass
browser_client.https_connector -> web_server.https_listener
web_server.mysql_connector -> mysql_server.mysql_listener

#instances
web_server internal_web_server(192.168.1.10)
browser_client my_browser
mysql_server primary_db(192.168.1.11)

#connections
my_browser -> internal_web_server
internal_web_server -> primary_db
```

## Visualization (sadlmap)

SADL includes an interactive visualizer called sadlmap.

### Run with Docker

```bash
docker run -p 8080:80 riolet/sadlmap
```

Then open http://localhost:8080

### Features

- **Schema view**: Visualize node classes and link classes
- **Instance view**: Visualize deployed instances and connections
- Pan: drag on empty space
- Zoom: mouse wheel
- Drag nodes to reposition

## License

GPL-3.0 - See [LICENSE](LICENSE) for details.
