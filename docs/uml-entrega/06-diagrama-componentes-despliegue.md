# Diagrama de Componentes y Despliegue

## Diagrama de Componentes

### Descripción
Este diagrama muestra la organización de los componentes de software de alto nivel. Se distingue el cliente (frontend y móvil), el API Gateway que centraliza el acceso, los microservicios especializados, la infraestructura interna (base de datos, caché, bus de mensajes) y los servicios externos (Stripe y proveedores de IA).

```mermaid
flowchart TB
    subgraph Cliente
        WEB[Web App<br/>React / Vite]
        MOB[App Móvil]
    end

    subgraph "API Gateway (NestJS)"
        GW_HTTP[REST Controllers<br/>Auth / Chat / Stripe]
        GW_WS[WebSocket Gateway<br/>ChatGateway]
        NATS_CLIENT[NATS Client]
    end

    subgraph "Microservicios (NestJS + NATS)"
        AUTH_MS[Auth Service]
        USERS_MS[Users Service]
        CHAT_MS[Chat Service]
        BILL_MS[Billing Service]
        USAGE_MS[Usage Service]
    end

    subgraph Infraestructura
        DB[(PostgreSQL 16<br/>multi-schema)]
        CACHE[(Redis)]
        BUS[NATS Server<br/>+ JetStream]
    end

    subgraph "Servicios Externos"
        STRIPE[Stripe API]
        OLLAMA[Ollama Local]
        GEMINI[Google Gemini]
        OPENAI[OpenAI API]
        DEEPSEEK[DeepSeek API]
    end

    WEB -->|HTTPS / WSS| GW_HTTP
    WEB -->|WSS| GW_WS
    MOB -->|HTTPS| GW_HTTP
    GW_HTTP --> NATS_CLIENT
    GW_WS --> NATS_CLIENT
    NATS_CLIENT --> BUS
    BUS --> AUTH_MS
    BUS --> USERS_MS
    BUS --> CHAT_MS
    BUS --> BILL_MS
    BUS --> USAGE_MS
    AUTH_MS --> DB
    USERS_MS --> DB
    CHAT_MS --> DB
    CHAT_MS --> OLLAMA
    CHAT_MS --> GEMINI
    CHAT_MS --> OPENAI
    CHAT_MS --> DEEPSEEK
    BILL_MS --> DB
    USAGE_MS --> DB
    BILL_MS -->|Webhooks| STRIPE
    GW_HTTP -->|Checkout| STRIPE
```

---

## Diagrama de Despliegue

### Descripción
El diagrama de despliegue refleja la topología de infraestructura en un entorno productivo (VPS o Railway). Cada servicio corre en su propio contenedor Docker, orquestados con Docker Compose. El API Gateway es el único punto de entrada expuesto públicamente; los microservicios y la base de datos residen en una red interna.

```mermaid
flowchart TB
    subgraph "VPS / Plataforma Cloud (Railway)"
        subgraph "Container: API Gateway"
            C_GW[Gateway NestJS<br/>Puerto 3000]
        end

        subgraph "Container: Auth Service"
            C_AUTH[Auth Microservice]
        end

        subgraph "Container: Users Service"
            C_USERS[Users Microservice]
        end

        subgraph "Container: Chat Service"
            C_CHAT[Chat Microservice]
        end

        subgraph "Container: Billing Service"
            C_BILL[Billing Microservice]
        end

        subgraph "Container: Usage Service"
            C_USAGE[Usage Microservice]
        end

        subgraph "Container: Mensajería"
            C_NATS[NATS Server v2.10<br/>Puerto 4222]
        end

        subgraph "Container: Base de Datos"
            C_DB[PostgreSQL 16]
        end

        subgraph "Container: Caché"
            C_REDIS[Redis]
        end
    end

    C_GW <-->|NATS TCP| C_NATS
    C_AUTH <-->|NATS TCP| C_NATS
    C_CHAT <-->|NATS TCP| C_NATS
    C_BILL <-->|NATS TCP| C_NATS
    C_USAGE <-->|NATS TCP| C_NATS
    C_USERS <-->|NATS TCP| C_NATS

    C_AUTH -->|SQL| C_DB
    C_CHAT -->|SQL| C_DB
    C_BILL -->|SQL| C_DB
    C_USAGE -->|SQL| C_DB
    C_USERS -->|SQL| C_DB
```

## Notas de arquitectura
- **API Gateway como fachada:** centraliza autenticación, enrutamiento y documentación Swagger. Expone REST API en `/api` y WebSockets en `/chat`.
- **Comunicación asíncrona:** todos los microservicios se comunican a través de NATS, desacoplando el frontend de la lógica interna y permitiendo escalar servicios de forma independiente.
- **Persistencia compartida:** aunque los microservicios son independientes, comparten una misma instancia de PostgreSQL separada lógicamente por schemas (`users`, `chat`, `billing`, `usage`). Esta es una decisión de transición del monolito hacia arquitectura distribuida.
- **Despliegue uniforme:** todos los contenedores se construyen desde la misma imagen base de NestJS, cambiando únicamente el entrypoint (`node dist/apps/<service>/main.js`).
