# Diagramas de Componentes y Despliegue

## Diagrama de Componentes

### Descripción

Este diagrama presenta la arquitectura **backend-only** de R3Chat. Los clientes web o móvil se representan únicamente como **consumidores externos** del backend, mientras que el centro del sistema está formado por el **API Gateway**, los **microservicios NestJS**, la **infraestructura compartida** y los **servicios externos** de pagos e IA.

```mermaid
flowchart LR
    CLIENTE["Clientes web / móvil\n(consumidores externos)"]
    STRIPE["Stripe"]

    subgraph GATEWAY["API Gateway (NestJS)"]
        HTTP["Controllers HTTP\nAuth, Chat, Stripe, Users"]
        WS["ChatGateway +\nChatStreamEventsController"]
        NATS_GW["Cliente / transporte NATS"]
    end

    subgraph MICROS["Microservicios NestJS"]
        AUTH["Auth Service"]
        USERS["Users Service"]
        CHAT["Chat Service"]
        BILL["Billing Service"]
        USAGE["Usage Service"]
    end

    subgraph INFRA["Infraestructura compartida"]
        NATS["NATS Server"]
        DB[("PostgreSQL 16\nschemas: users, chat, billing, usage")]
        REDIS[("Redis\n(soporte de despliegue)")]
    end

    subgraph IA["Proveedores de IA"]
        OLLAMA["Ollama\n(host.docker.internal)"]
        GEMINI["Google Gemini"]
        OPENAI["OpenAI"]
        DEEPSEEK["DeepSeek"]
    end

    CLIENTE -->|HTTPS| HTTP
    CLIENTE -->|WSS| WS

    HTTP --> NATS_GW
    WS --> NATS_GW
    NATS_GW <--> NATS

    NATS <--> AUTH
    NATS <--> USERS
    NATS <--> CHAT
    NATS --> BILL
    NATS --> USAGE

    AUTH --> DB
    USERS --> DB
    CHAT --> DB
    BILL --> DB
    USAGE --> DB

    CHAT --> OLLAMA
    CHAT --> GEMINI
    CHAT --> OPENAI
    CHAT --> DEEPSEEK

    HTTP -->|Checkout / Portal| STRIPE
    STRIPE -->|Webhook| HTTP
```

### Explicación

- El **API Gateway** concentra los endpoints HTTP, el namespace WebSocket `/chat` y la recepción de eventos de streaming que luego retransmite al cliente.
- Los microservicios `auth`, `users`, `chat`, `billing` y `usage` se coordinan mediante **NATS**, lo que desacopla el procesamiento de la interfaz pública.
- **PostgreSQL** es la persistencia compartida del backend, separada lógicamente por esquemas para cada dominio.
- **Redis** figura como infraestructura de despliegue porque está presente en `docker-compose.prod.yml`, aunque no es el eje de los flujos principales documentados aquí.
- **Stripe** y los proveedores de IA aparecen fuera del backend porque son dependencias externas integradas por HTTP/API.

---

## Diagrama de Despliegue

### Descripción

Este diagrama refleja la topología real de despliegue definida en `docker-compose.prod.yml`. El backend se distribuye en varios contenedores conectados a una red interna `backend`. El **gateway** es el único punto de entrada público; el resto de servicios se comunican internamente por **NATS** y persisten en **PostgreSQL**.

```mermaid
flowchart TB
    CLIENTES["Clientes externos"]
    STRIPE_EXT["Stripe"]
    OLLAMA_EXT["Ollama en host\nhost.docker.internal:11434"]
    IA_CLOUD["Gemini / OpenAI / DeepSeek"]

    subgraph CLOUD["Entorno Docker Compose (red backend)"]
        GATEWAY["Container: gateway\nNestJS API Gateway\nPuerto interno 3000\nPuerto host 3001"]
        AUTH_C["Container: auth\nMicroservicio NATS"]
        USERS_C["Container: users\nMicroservicio NATS"]
        CHAT_C["Container: chat\nMicroservicio NATS"]
        BILL_C["Container: billing\nMicroservicio NATS"]
        USAGE_C["Container: usage\nMicroservicio NATS"]
        NATS_C["Container: nats\nPuerto interno 4222"]
        DB_C[("Container: postgres\nPostgreSQL 16")]
        REDIS_C[("Container: redis\nRedis 7")]
    end

    CLIENTES -->|HTTPS / WSS| GATEWAY
    GATEWAY -->|Checkout / Portal| STRIPE_EXT
    STRIPE_EXT -->|POST /api/stripe/webhook| GATEWAY

    GATEWAY <--> NATS_C
    AUTH_C <--> NATS_C
    USERS_C <--> NATS_C
    CHAT_C <--> NATS_C
    BILL_C <--> NATS_C
    USAGE_C <--> NATS_C

    AUTH_C --> DB_C
    USERS_C --> DB_C
    CHAT_C --> DB_C
    BILL_C --> DB_C
    USAGE_C --> DB_C

    CHAT_C --> OLLAMA_EXT
    CHAT_C --> IA_CLOUD
```

### Notas de despliegue

- El contenedor `gateway` es el **único componente expuesto** hacia clientes externos; los demás servicios permanecen en la red interna.
- El contenedor `chat` consume modelos locales a través de `host.docker.internal` para Ollama y también puede invocar proveedores cloud.
- `billing` y `usage` no atienden tráfico público: reaccionan a eventos publicados por el microservicio `chat`.
- El servicio `migrate` definido en el compose se omite del diagrama porque corresponde a una tarea operativa puntual de migración, no a un nodo de ejecución permanente.
- `Redis` se mantiene en el despliegue real y por eso aparece en el diagrama, aunque su participación no sea central en los flujos UML principales de esta entrega.
