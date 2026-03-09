## Chat microservices roadmap (estado actual)

Este documento resume lo que ya se migró y lo que falta para completar la separación de responsabilidades del dominio chat.

## Completado en esta fase

1. Split de gateway por responsabilidades (base)
   - Se extrajeron servicios de soporte para WS:
     - `src/chat/gateway/chat-gateway-auth.service.ts`
     - `src/chat/gateway/chat-gateway-room.service.ts`
     - `src/chat/gateway/chat-gateway-concurrency.service.ts`
   - `ChatGateway` conserva orquestación de stream, pero auth/rooms/concurrencia ya no están embebidos.

2. Gateway más liviano para operaciones de sesión
   - Eventos WS de sesión (`newChat`, `listChats`, `renameChat`, `deleteChat`, `getHistory`) ahora usan `ChatClient` (NATS) en lugar de acceso directo del gateway.

3. Contratos de chat más fuertes
   - Se tiparon payloads NATS en `libs/contracts/chat/chat.contracts.ts`.
   - Se tipó uso en `src/chat/chat.client.ts` y `apps/chat/src/chat-nats.controller.ts`.

4. Eventos de dominio por NATS
   - Se añadieron eventos en `libs/contracts/chat/chat.patterns.ts` (`CHAT_EVENTS`).
   - Se publica desde `apps/chat/src/chat-events.publisher.ts` en operaciones clave:
     - `chat.events.message.created`
     - `chat.events.stream.finished`
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

## Siguiente fase recomendada

1. Streaming real sobre microservicio chat
   - Definir canal/event bus para chunks (NATS pub/sub o WS bridge dedicado), para sacar también la generación de `ChatGateway`.

2. Aislar `ChatService` por app
   - Crear capa de dominio propia en `apps/chat` y dejar en gateway solo clientes NATS.

3. Consumidores de eventos
   - `usage` y `billing` deben reaccionar a eventos de chat sin acoplamiento directo.

4. Contratos de respuesta versionados
   - Formalizar respuestas NATS (DTOs de respuesta), no solo payloads de request.

5. Suite de validación
   - Tests de contrato para `CHAT_PATTERNS`/`CHAT_EVENTS`.
   - Smoke tests automatizados HTTP + WS para `/api/chat/*`.
