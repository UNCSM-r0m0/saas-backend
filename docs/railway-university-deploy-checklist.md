## Railway deploy checklist (demo universidad)

Escenario: desplegar solo backend del monorepo de microservicios. La inferencia IA (Ollama proxy) corre en tu PC actual.

## 1) Crear proyecto y servicios

- Crear proyecto en Railway y conectar el repo `saas-backend`.
- Crear servicios:
  - `gateway` (publico)
  - `auth` (privado)
  - `users` (privado)
  - `chat` (privado)
  - `billing` (privado)
  - `usage` (privado)
  - `postgres` (plugin)
  - `redis` (plugin)
  - `nats` (servicio con imagen oficial o equivalente)

## 2) Variables de entorno base (compartidas)

- `NODE_ENV=production`
- `NATS_URL=nats://<nats-service>:4222`
- `DATABASE_URL=<postgres-url-railway>`
- `REDIS_URL=<redis-url-railway>`
- `JWT_SECRET=<valor-fuerte>`
- `PUBLIC_URL=https://<dominio-gateway-railway>`
- `FRONTEND_URL=https://<frontend-real>`
- `OLLAMA_PROXY_URL=https://ia.r0lm0.dev`
- `OLLAMA_PROXY_API_KEY=<tu-key>`
- `OLLAMA_FALLBACK_MODEL=gpt-oss:20b-cloud`
- `CHAT_STREAM_BATCH_MS=120`
- `CHAT_STREAM_BATCH_TARGET_CHARS=220`
- `CHAT_STREAM_BATCH_MIN_CHARS=32`

## 3) Comandos de arranque por servicio

- `gateway`: `npm run start:prod:gateway`
- `auth`: `npm run start:prod:auth`
- `users`: `npm run start:prod:users`
- `chat`: `npm run start:prod:chat`
- `billing`: `npm run start:prod:billing`
- `usage`: `npm run start:prod:usage`

## 4) Migraciones (obligatorio)

- Crear un servicio/job de migraciones y ejecutar:
  - `npx prisma migrate deploy`
- Correr este job en cada release antes de validar la demo.

## 5) Health checks y prueba minima

- Gateway: `GET /api/health`
- Verificar arranque de `users`, `auth`, `chat`, `billing`, `usage` en logs.
- Prueba funcional minima:
  - login/refresh
  - `POST /api/chat/message`
  - flujo WS (`responseStart`, `responseChunk`, `responseEnd`)

## 6) Riesgo principal del demo

- Si tu PC o tunel del proxy se cae, la IA se cae aunque Railway siga arriba.
- Mitigacion:
  - mantener fallback de modelo cloud activo (`OLLAMA_FALLBACK_MODEL`)
  - tener demo alternativa con endpoint non-stream.

## 7) Sizing recomendado (coste bajo)

- Minimo: `2 vCPU / 4 GB RAM / 20-30 GB`.
- Recomendado para demo estable: `4 vCPU / 8 GB RAM`.

## 8) Seguridad minima

- No usar secrets por defecto.
- Limitar CORS al frontend real.
- Exponer publicamente solo `gateway`.
