## Frontend chat integration (post Step 2 split)

Este documento define lo que el frontend (`r3-chat`) debe implementar para mantenerse alineado con el backend despues del split de controladores de chat.

## Estado actual del backend

- Se separaron rutas REST en controladores dedicados:
  - `chat-sessions.controller.ts`: sesiones y detalle de chat.
  - `chat-messages.controller.ts`: envio de mensajes no streaming.
  - `chat.controller.ts`: endpoints de stream SSE y metadata de modelo OpenAI.
- No hay breaking changes de rutas en este paso: se mantienen los endpoints existentes.

## Contratos HTTP a usar

### Sesiones

- `GET /api/chat/sessions`
  - respuesta esperada: `{ success: true, data: Chat[] }`
- `POST /api/chat`
  - body: `{ title?: string }`
  - respuesta: `{ success: true, data: Chat, message: string }`
- `PATCH /api/chat/sessions/:id`
  - body: `{ title: string }`
- `DELETE /api/chat/sessions/:id`
- `GET /api/chat/:id`
  - respuesta: `{ success: true, data: Chat, message: string }`

### Mensajes

- `POST /api/chat/message`
  - body: `{ content, model, conversationId?, anonymousId? }`
  - uso recomendado: flujo principal con respuesta completa (no stream)
- `POST /api/chat/message/authenticated`
  - requiere JWT/cookie

### Streaming SSE

- `POST /api/chat/message/stream`
  - Content-Type de respuesta: `text/event-stream`
  - eventos esperados en `data:`:
    - `{ content: string }` (chunks)
    - `{ finished: true, conversationId: string }` (fin)
    - `{ error: 'LIMIT_EXCEEDED' | 'PREMIUM_REQUIRED' | 'STREAM_ERROR', message: string }`

## Cambios recomendados en frontend

1. Unificar configuracion de URLs
   - Evitar hardcode de `http://localhost:3000` en sockets.
   - Reutilizar una sola fuente (`API_BASE_URL`) para HTTP + WS/SSE.

2. Estandarizar manejo de errores de negocio
   - Mapear en UI:
     - `LIMIT_EXCEEDED`: mostrar limite diario y accion de upgrade/login.
     - `PREMIUM_REQUIRED`: mostrar bloqueo de modelo premium.
     - `STREAM_ERROR`: fallback automatico a `POST /api/chat/message`.

3. Sincronizacion de estado de chats
   - Al crear chat: refrescar lista con `GET /api/chat/sessions`.
   - Al terminar stream: si llega `conversationId`, rehidratar chat activo con `GET /api/chat/:id`.
   - Al renombrar/eliminar: actualizar store local y luego refrescar en background.

4. Manejo consistente de `conversationId`
   - Si es UUID valido, enviarlo en `conversationId`.
   - Si no existe chat activo, permitir que backend lo cree y devolver el nuevo id al finalizar.

5. Observabilidad frontend
   - Agregar logs de desarrollo por endpoint (request id, status, latencia).
   - No mostrar mensajes tecnicos al usuario final.

## Checklist de validacion QA

- Usuario anonimo envia mensaje no-stream y stream sin romper UX.
- Usuario autenticado mantiene historial en `sessions`.
- Cambio de titulo y borrado de chat reflejan estado correcto.
- Errores `LIMIT_EXCEEDED` y `PREMIUM_REQUIRED` se muestran bien.
- Reconexion de socket/stream no duplica mensajes.

## Nota de arquitectura

El split de controladores no cambia rutas publicas en este paso, pero prepara el terreno para mover mas logica de chat a NATS y reducir acoplamiento con el gateway.
