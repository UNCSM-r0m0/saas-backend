# Plan de migracion: monolito a monorepo de microservicios

Objetivo: mover el monolito (gateway en `src/`) hacia microservicios en `apps/`, usando NATS para comunicacion, sin romper el flujo actual.

Contexto actual:

- Monorepo NestJS ya habilitado (`nest-cli.json`, `apps/*`).
- Servicios NATS existentes en `apps/chat`, `apps/users`, `apps/auth`, `apps/billing`, `apps/usage`.
- Gateway HTTP actual vive en `src/`.

Principios (guia, no reglas estrictas):

- Modulos por feature y responsabilidades claras.
- Evitar dependencias circulares.
- Servicios con una sola responsabilidad.
- Contratos explicitos para mensajes NATS.
- Comentarios breves para explicar cambios no obvios.

Fase 0 - Inventario y limites

- Mapear endpoints actuales por modulo del monolito.
- Definir ownership por servicio (auth, users, chat, billing, usage).
- Listar dependencias compartidas (Prisma, Config, Auth utils, DTOs).

Fase 1 - Contratos y comunicacion

- Definir patrones NATS por dominio: `auth.*`, `users.*`, `chat.*`, `billing.*`, `usage.*`.
- Establecer DTOs de mensajes (request/response y eventos).
- Decidir si los contratos van a `libs/contracts` (a crear) o dentro de cada servicio.

Estado actual (en progreso)

- `users` fue seleccionado como primer servicio.
- Contratos NATS y DTOs compartidos ubicados en `libs/contracts/users`.
- Gateway HTTP para `users` ya delega a NATS.

Fase 2 - Extraccion por servicio (iterativa)
Para cada dominio:

- Mover logica desde `src/<modulo>` hacia `apps/<servicio>`.
- Crear controladores NATS en `apps/<servicio>/src`.
- En el gateway, reemplazar llamadas directas a servicios por clientes NATS.
- Mantener endpoints HTTP en el gateway mientras se migra.

Fase 3 - Limpieza del monolito

- Remover modulos ya migrados de `src/app.module.ts`.
- Eliminar controladores/servicios antiguos una vez verificado.
- Actualizar docs y eliminar secciones obsoletas.

Fase 4 - Datos y persistencia

- Corto plazo: mantener una DB compartida via Prisma.
- Mediano plazo: separar schema por servicio o DB por servicio.
- Evitar consultas cruzadas directas entre servicios.

Decision actual

- Se mantiene una DB compartida para reducir costos en Railway.
- Separacion por esquemas: cada servicio sera owner de su schema/tablas.
- No se permiten consultas cruzadas directas entre servicios; solo via NATS.

Estado actual (schema)

- Prisma configurado con `multiSchema` para `users`.
- Modelos `User` y `Tenant` movidos al schema `users`.

Fase 5 - Observabilidad y pruebas

- Logs estructurados y trazas de mensajes NATS.
- Tests por servicio (unit y e2e segun aplique).

Checklist por servicio (usar por cada migracion)

- [ ] Endpoints mapeados y documentados.
- [ ] Contratos NATS definidos.
- [ ] Gateway actualizado a NATS.
- [ ] Logica removida del monolito.
- [ ] Docs actualizadas en `docs/`.

Notas de eliminacion gradual

- El gateway permanece como fachada HTTP hasta completar la migracion.
- Las secciones antiguas se eliminan solo cuando el servicio nuevo esta estable.
