## Operations runbook (microservices backend)

Guia operativa para diagnostico rapido durante demo o entorno productivo ligero.

## 1) Sintoma: el chat no responde

- Verificar gateway: `GET /api/health`.
- Verificar NATS:
  - `node scripts/nats-users-health.js`
  - `node scripts/nats-chat-health.js`
- Verificar WebSocket:
  - `node scripts/ws-chat-smoke.js`

## 2) Sintoma: stream incompleto o errores intermitentes

- Revisar logs por `correlationId` (si frontend/gateway lo envia).
- Ajustar batching de stream:
  - `CHAT_STREAM_BATCH_MS`
  - `CHAT_STREAM_BATCH_TARGET_CHARS`
  - `CHAT_STREAM_BATCH_MIN_CHARS`
- Confirmar que `OLLAMA_PROXY_URL` y `OLLAMA_PROXY_API_KEY` siguen validos.

## 3) Sintoma: errores de DB o tablas faltantes

- Ejecutar migraciones:
  - local: `npx prisma migrate deploy`
  - compose: `docker compose -f docker-compose.prod.yml --profile tools run --rm migrate`

## 4) Sintoma: auth/token fallando

- Validar `JWT_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`.
- Revisar servicio `auth` y almacenamiento de `refresh_tokens`.

## 5) Reinicio controlado (compose)

- Reiniciar core:
  - `docker compose -f docker-compose.prod.yml up -d --build gateway chat auth users usage billing`
- Infra:
  - `docker compose -f docker-compose.prod.yml up -d postgres redis nats`

## 6) Checklist pre-demo

- Migraciones aplicadas.
- `/api/health` respondiendo.
- `ws-chat-smoke` en verde.
- Proxy IA disponible (o fallback cloud activo).
- Frontend apuntando al `PUBLIC_URL` correcto.
