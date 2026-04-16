# Diagrama de Secuencia

## Descripción

Este diagrama representa el **escenario clave del backend**: un **usuario autenticado** envía un mensaje por **WebSocket** y recibe una respuesta en **streaming**. El flujo sigue exactamente la cadena real de la implementación: `ChatGateway` recibe el evento, delega el envío al microservicio de chat mediante **NATS**, el microservicio procesa la lógica de dominio, publica eventos `chat.events.stream.*` y el gateway retransmite los eventos de vuelta al cliente como `responseStart`, `responseChunk` y `responseEnd`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario autenticado
    participant FE as Cliente web/móvil
    participant GW as ChatGateway\n(API Gateway WS)
    participant CC as ChatClient
    participant CNC as ChatNatsController\n(Chat MS)
    participant CDS as ChatDomainService
    participant US as UsageService
    participant SS as SubscriptionsService
    participant PS as PrismaService
    participant AI as Proveedor IA
    participant CEP as ChatEventsPublisher
    participant CSEC as ChatStreamEventsController\n(Gateway)
    participant UMS as UsageServiceController\n(Usage MS)
    participant BMS as BillingServiceController\n(Billing MS)

    U->>FE: Escribe mensaje y presiona enviar
    FE->>GW: WS sendMessage({content, chatId, model})
    GW->>GW: Genera correlationId, streamId y messageId
    GW->>CC: sendMessage(dto, userId, streamId, messageId, correlationId)
    CC->>CNC: NATS chat.sendMessage

    CNC->>CEP: Emitir chat.events.stream.started
    CEP-->>CSEC: Evento NATS stream.started
    CSEC-->>FE: WS responseStart

    CNC->>CDS: sendMessageStreaming(dto, userId, onChunk)
    CDS->>US: canSendMessage(userId, anonymousId)
    US-->>CDS: allowed, remaining, limit
    CDS->>SS: getOrCreateSubscription(userId)
    SS-->>CDS: subscription(tier)
    CDS->>SS: getUserLimits(tier)
    SS-->>CDS: messagesPerDay, maxTokensPerMessage

    alt chatId no provisto
        CDS->>PS: create Chat(ownerId, title)
        PS-->>CDS: chatId
    else chatId provisto
        CDS->>PS: findUnique Chat(chatId)
        PS-->>CDS: chat
    end

    CDS->>PS: create Message(USER, content, chatId)
    PS-->>CDS: mensaje persistido
    CDS->>PS: findMany Message(chatId)
    PS-->>CDS: history[]

    CDS->>AI: generateStreamingResponse(...)

    loop Mientras llegan fragmentos
        AI-->>CDS: chunk de texto
        CDS-->>CNC: onChunk(chunk)
        CNC->>CEP: Emitir chat.events.stream.chunk
        CEP-->>CSEC: Evento NATS stream.chunk
        CSEC-->>FE: WS responseChunk
    end

    CDS->>PS: create Message(ASSISTANT, fullContent, tokensUsed, model)
    PS-->>CDS: assistantMessage
    CDS-->>CNC: result(conversationId, message, remaining)

    CNC->>CEP: Emitir chat.events.stream.finished
    CEP-->>CSEC: Evento NATS stream.finished
    CSEC-->>FE: WS responseEnd(fullContent)

    par Auditoría del mensaje
        CNC->>CEP: Emitir chat.events.message.created
        CEP-->>BMS: Evento NATS message.created
        BMS->>PS: create BillingUsageEvent
    and Actualización de uso
        CNC->>CEP: Emitir chat.events.usage.incremented
        CEP-->>UMS: Evento NATS usage.incremented
        UMS->>PS: find/create UsageConsumedEvent
        UMS->>PS: upsert UsageRecord
    and Auditoría del uso
        CEP-->>BMS: Evento NATS usage.incremented
        BMS->>PS: create BillingUsageEvent
    end

    CNC-->>CC: ChatSendMessageResponseV1
    CC-->>GW: Operación completada
    FE-->>U: Respuesta final mostrada en pantalla
```

## Explicación del flujo

1. **Entrada en tiempo real:** el usuario entra por `sendMessage` en `ChatGateway`, que registra identificadores de correlación y delega el procesamiento al microservicio de chat.
2. **Validación sincrónica:** antes de invocar la IA, `ChatDomainService` consulta `UsageService` y `SubscriptionsService` para validar la cuota diaria y el plan del usuario.
3. **Persistencia del contexto:** si la conversación es autenticada, el backend crea o recupera el chat, guarda el mensaje del usuario y carga el historial desde PostgreSQL.
4. **Streaming desacoplado:** el microservicio de chat no escribe directo al socket; publica `chat.events.stream.started`, `chat.events.stream.chunk` y `chat.events.stream.finished`, y luego `ChatStreamEventsController` los convierte en `responseStart`, `responseChunk` y `responseEnd` para el cliente.
5. **Postprocesamiento asíncrono:** al finalizar, el sistema publica `chat.events.message.created` y `chat.events.usage.incremented`; `usage` actualiza métricas e idempotencia, mientras `billing` registra trazabilidad de auditoría.
6. **Variante anónima:** el flujo de usuario anónimo usa `anonymousId` para el control de cuota, pero no persiste historial del mismo modo que una conversación autenticada.
