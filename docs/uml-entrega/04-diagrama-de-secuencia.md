# Diagrama de Secuencia

## Descripción
Este diagrama ilustra el escenario clave del sistema: **el envío de un mensaje de chat con streaming en tiempo real**. Se representa la interacción completa entre el frontend, el API Gateway (WebSocket), el microservicio de chat, los servicios de dominio (uso y suscripciones), Prisma, el proveedor de IA, y los consumidores de eventos.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant F as Frontend (r3-chat)
    participant GW as ChatGateway<br/>(API Gateway)
    participant NC as ChatNatsController<br/>(Microservicio Chat)
    participant CDS as ChatDomainService
    participant US as UsageService
    participant SS as SubscriptionsService
    participant PS as PrismaService
    participant AI as Proveedor IA<br/>(Ollama / Gemini / OpenAI)
    participant EP as ChatEventsPublisher
    participant EV as ChatStreamEventsController<br/>(Gateway Events)
    participant UM as UsageMicroservice

    U->>F: Escribe mensaje y presiona enviar
    F->>GW: WS: sendMessage(dto)
    GW->>NC: NATS: chat.sendMessage
    NC->>CDS: sendMessageStreaming(dto, userId)

    CDS->>US: canSendMessage(userId, anonymousId)
    US-->>CDS: { allowed: true, remaining, limit }

    CDS->>SS: getOrCreateSubscription(userId)
    SS-->>CDS: Subscription { tier }
    CDS->>SS: getUserLimits(tier)
    SS-->>CDS: limits { messagesPerDay, maxTokens }

    alt chatId no proporcionado
        CDS->>PS: create Chat(ownerId, title)
        PS-->>CDS: Chat { id }
    else chatId proporcionado
        CDS->>PS: findUnique Chat(chatId)
        PS-->>CDS: Chat
    end

    CDS->>PS: create Message(USER, content, chatId)
    PS-->>CDS: Message creada
    CDS->>PS: getChatHistory(chatId)
    PS-->>CDS: history[]

    CDS->>AI: generateStream() / generateStreamingResponse()

    loop Streaming de chunks en tiempo real
        AI-->>CDS: chunk de texto
        CDS->>EP: publica stream.chunk vía NATS
        EP-->>EV: NATS evento stream.chunk
        EV->>F: WS: responseChunk(chunk)
        F->>U: Muestra texto progresivamente
    end

    CDS->>PS: create Message(ASSISTANT, fullContent, tokensUsed)
    PS-->>CDS: Message guardada

    CDS->>EP: publica chat.events.usage.incremented
    EP-->>UM: consume evento (async)
    UM->>PS: verificar idempotencia (UsageConsumedEvent)
    UM->>PS: incrementar UsageRecord

    CDS-->>NC: resultado final { conversationId, message, remaining }
    NC-->>GW: respuesta NATS
    GW->>F: WS: responseEnd
    F->>U: Finaliza respuesta del asistente
```

## Explicación del flujo
1. **Autenticación inicial:** el `ChatGateway` valida al usuario antes de aceptar la conexión WebSocket.
2. **Rate limiting:** `ChatDomainService` consulta `UsageService` para verificar que el usuario no haya excedido su cuota diaria según su `SubscriptionTier` (FREE, REGISTERED o PREMIUM).
3. **Gestión de sesiones:** si no existe un `chatId`, se crea una nueva conversación con título autogenerado.
4. **Persistencia histórica:** el mensaje del usuario se guarda en la base de datos antes de llamar a la IA.
5. **Streaming:** los chunks generados por el proveedor de IA se publican como eventos NATS y se retransmiten al frontend vía WebSocket, logrando una experiencia de escritura en tiempo real.
6. **Eventos de dominio:** al finalizar, se publica `chat.events.usage.incremented`, que es consumido asíncronamente por el microservicio `usage` para actualizar estadísticas y por `billing` para auditoría.
