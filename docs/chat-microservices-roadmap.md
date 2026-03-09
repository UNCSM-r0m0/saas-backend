## Chat microservices roadmap (estado actual)

Este documento resume lo que ya se migró y lo que falta para completar la separación de responsabilidades del dominio chat.

## Completado en esta fase

1. Split de gateway por responsabilidades (base)
   - Se extrajeron servicios de soporte para WS:
     - `src/chat/gateway/chat-gateway-auth.service.ts`
     - `src/chat/gateway/chat-gateway-room.service.ts`
   - `ChatGateway` conserva el borde WS y delega a NATS.

2. Gateway más liviano para operaciones de sesión
   - Eventos WS de sesión (`newChat`, `listChats`, `renameChat`, `deleteChat`, `getHistory`) ahora usan `ChatClient` (NATS) en lugar de acceso directo del gateway.

3. Contratos de chat más fuertes
   - Se tiparon payloads NATS en `libs/contracts/chat/chat.contracts.ts`.
   - Se tipó uso en `src/chat/chat.client.ts` y `apps/chat/src/chat-nats.controller.ts`.

4. Streaming por eventos NATS + eventos de dominio
   - Se añadieron eventos en `libs/contracts/chat/chat.patterns.ts` (`CHAT_EVENTS`).
   - Streaming WS ahora se relaya desde eventos NATS (`stream.started`, `stream.chunk`, `stream.finished`, `stream.error`).
   - Se publica desde `apps/chat/src/chat-events.publisher.ts` en operaciones clave:
     - `chat.events.message.created`
     - `chat.events.stream.started`
     - `chat.events.stream.chunk`
     - `chat.events.stream.finished`
     - `chat.events.stream.error`
     - `chat.events.usage.incremented`
     - `chat.events.session.created`
     - `chat.events.session.deleted`

5. Separación de datos por schema
   - `chat`: ya separado (previo).
   - `billing`: `Subscription`, `SubscriptionTier`, `SubscriptionStatus`.
   - `usage`: `UsageRecord`.
   - Migración: `prisma/migrations/20260309002000_move_billing_usage_to_own_schemas/migration.sql`.

6. Calidad mínima operativa
   - Nuevo health script NATS de chat: `scripts/nats-chat-health.js`.
   - `manage-all.ps1` ahora expone `chat.health` y refleja schemas `users/chat/billing/usage`.

7. Consumidores reales de eventos
   - `usage` consume `chat.events.usage.incremented` y actualiza `usage.usage_records`.
   - `billing` consume `chat.events.usage.incremented` y `chat.events.message.created`.
   - Nuevo modelo de auditoría: `billing.billing_usage_events`.

## Siguiente fase recomendada

1. Aislar `ChatService` por app
   - Crear capa de dominio propia en `apps/chat` y dejar en gateway solo clientes NATS.

2. Contratos de respuesta versionados
   - Formalizar respuestas NATS (DTOs de respuesta), no solo payloads de request.

3. Suite de validación
   - Tests de contrato para `CHAT_PATTERNS`/`CHAT_EVENTS`.
   - Smoke tests automatizados HTTP + WS para `/api/chat/*`.
