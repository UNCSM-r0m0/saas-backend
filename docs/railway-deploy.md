# Railway deploy guide (microservices)

Objetivo: despliegue estable de monorepo con microservicios, una DB compartida y migraciones automáticas.

## Arquitectura recomendada

- 1 servicio PostgreSQL (compartido por costo).
- 1 servicio NATS.
- 1 servicio Redis.
- Servicios app:
  - gateway
  - auth
  - users
  - chat
  - billing
  - usage
- 1 servicio `migrations` para ejecutar Prisma deploy en cada release.

## Comandos por servicio

### migrations (job)

```bash
npx prisma migrate deploy
```

### gateway

```bash
npm run start:prod:gateway
```

### auth

```bash
npm run start:prod:auth
```

### users

```bash
npm run start:prod:users
```

### chat

```bash
npm run start:prod:chat
```

### billing

```bash
npm run start:prod:billing
```

### usage

```bash
npm run start:prod:usage
```

## Variables de entorno mínimas

Compartidas (según servicio):

- `DATABASE_URL`
- `NATS_URL`
- `JWT_SECRET`
- `JWT_ACCESS_EXPIRES=15m`
- `JWT_REFRESH_EXPIRES=30d`
- `PUBLIC_MODELS=qwen2.5-coder:7b`
- `PRO_MODELS=deepseek-v3.1:671b-cloud`

Específicas por dominio:

- OAuth: `GOOGLE_*`, `GITHUB_*`
- Billing: `STRIPE_*`
- Modelos/proxy: `OLLAMA_PROXY_URL`, `OLLAMA_PROXY_API_KEY`

## Orden recomendado de despliegue

1. Levantar PostgreSQL, NATS y Redis.
2. Ejecutar servicio `migrations` y validar éxito.
3. Desplegar `auth`, `users`, `chat`, `billing`, `usage`.
4. Desplegar `gateway`.

## Validaciones post-deploy

- `GET /api/health`
- `GET /api/docs`
- `POST /api/auth/refresh`
- `GET /api/models/public`

## Notas operativas

- No correr `prisma migrate dev` en producción.
- Usar siempre `prisma migrate deploy` en Railway.
- Si un deploy falla por tablas faltantes, ejecutar primero el servicio `migrations` y redeploy del servicio afectado.
