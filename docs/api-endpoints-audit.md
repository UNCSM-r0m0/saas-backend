# Auditoria de endpoints y plan de migracion

Objetivo: validar endpoints en Swagger, detectar hardcode y migrar dominios a microservicios.

## Inventario actual (gateway monolito)

Controladores HTTP en `src/`:

- `src/app.controller.ts`
- `src/auth/auth.controller.ts`
- `src/users/users.controller.ts`
- `src/chat/chat.controller.ts`
- `src/models/models.controller.ts`
- `src/stripe/stripe.controller.ts`

## Hallazgos de hardcode

### `/api/models/public`

Archivo: `src/models/models.controller.ts`

- Los modelos de Ollama se “decoran” con nombres y features hardcodeados.
- `openai` y `gemini` se describen con texto fijo.

Necesidad del negocio:

- `deepseek-v3.1:671b-cloud` = modelo PRO (suscripcion).
- `qwen2.5-coder:7b` = modelo PUBLICO (5 prompts/dia).

## Plan de trabajo (faseado)

### Fase 1 - Auditoria de Swagger

- Levantar gateway y exportar la lista real de endpoints.
- Clasificar endpoints: activos, duplicados, obsoletos.
- Anotar dependencias (DB directa vs NATS).

### Fase 2 - Modelos (sin hardcode)

- Cambiar `/api/models/public` para leer modelos desde `OLLAMA_PROXY_URL/v1/models`.
- Definir configuracion por tiers (sin hardcode en codigo):
  - `PUBLIC_MODELS=qwen2.5-coder:7b`
  - `PRO_MODELS=deepseek-v3.1:671b-cloud`
- Responder al frontend con:
  - `isPremium: true|false`
  - `defaultModel` basado en la lista real del proxy.

### Fase 3 - Users (completado)

- Gateway users -> NATS (listo).
- Usuarios en schema `users` (listo).

### Fase 4 - Chat

- Mover flujos restantes a microservicio `apps/chat`.
- Contratos NATS para chat: `chat.sendMessage`, `chat.sessions.*`, `chat.history.*`.
- Gateway solo orquesta auth y delega a NATS.

### Fase 5 - Auth

- Migrar auth a `apps/auth`.
- Contratos NATS para login/registro/token refresh.

### Fase 6 - Billing/Stripe

- Migrar `stripe.controller` a `apps/billing`.
- Separar webhook en servicio dedicado.

### Fase 7 - Usage

- Mover `usage` a `apps/usage`.
- Evitar consultas cruzadas entre servicios.

## Checklist por endpoint

- [ ] `GET /api/models/public` -> dinamico via proxy
- [ ] `POST /api/chat/message` -> NATS (parcial)
- [ ] `POST /api/auth/login` -> NATS
- [ ] `POST /api/stripe/create-checkout-session` -> NATS
- [ ] `GET /api/users` -> NATS (listo)
