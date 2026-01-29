# SADL

System Architecture Design Language

## Overview

SADL is a language for describing and designing system architectures. It models systems as entities with connections between them.

## Concepts

### Entities

Entities are the building blocks of a system architecture. Each entity has a name and can have connectors.

### Connectors

Connectors define how entities communicate:

- **Server connectors** - Listen for incoming connections from client connectors
- **Client connectors** - Initiate connections to server connectors

### Connections

Connections link client connectors to server connectors, defining the communication pathways between entities.

## License

TBD
