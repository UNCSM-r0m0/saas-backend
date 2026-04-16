# Proyecto Final — Diagramas UML

**Asignatura:** Ingeniería de Software II  
**Carrera:** Ingeniería en Sistemas de Información  
**Universidad:** Universidad Nacional Casimiro Sotelo Montenegro  
**Docente:** [Nombre del docente]  
**Fecha límite de entrega:** 16/04/2026

---

## Sistema: SaaS Platform — Chat Inteligente con IA

### Integrantes del equipo
- [Integrante 1]
- [Integrante 2]
- [Integrante 3]
- [Integrante 4]

---

## Descripción general del sistema

La **SaaS Platform** es una aplicación de chat inteligente basada en arquitectura de **microservicios** que permite a usuarios interactuar con múltiples proveedores de Inteligencia Artificial (Ollama, Google Gemini, OpenAI y DeepSeek). El sistema está diseñado como un **monorepo NestJS** en transición de monolito a microservicios, utilizando **NATS** como bus de mensajes para la comunicación interna.

### Funcionalidades principales
- **Autenticación y autorización:** Registro e inicio de sesión local, OAuth con Google y GitHub, JWT con refresh tokens rotativos.
- **Chat con IA:** Envío de mensajes vía REST, SSE y WebSockets con soporte de streaming en tiempo real.
- **Gestión de conversaciones:** CRUD de sesiones de chat (crear, listar, renombrar, eliminar) con persistencia histórica.
- **Suscripciones y pagos:** Integración con Stripe para checkout de suscripciones (Free, Registered, Premium).
- **Rate limiting y uso:** Control de cuotas diarias por tier, contabilización de mensajes/tokens y auditoría de eventos de billing.
- **Multi-tenancy:** Soporte de tenants para aislamiento organizacional.

### Stack tecnológico
- **Backend:** NestJS v11, TypeScript, Prisma ORM
- **Base de datos:** PostgreSQL 16 (multi-schema: `users`, `chat`, `billing`, `usage`)
- **Mensajería:** NATS Server v2.10 (+ JetStream)
- **WebSockets:** Socket.io v4.8
- **Pagos:** Stripe (Checkout + Webhooks)
- **IA/LLMs:** Ollama (local), Google Gemini, OpenAI, DeepSeek
- **Infraestructura:** Docker + Docker Compose, despliegue en Railway

---

## Índice de diagramas
1. [Diagrama de Casos de Uso](./02-diagrama-casos-de-uso.md)
2. [Diagrama de Clases](./03-diagrama-de-clases.md)
3. [Diagrama de Secuencia](./04-diagrama-de-secuencia.md)
4. [Diagrama de Actividades](./05-diagrama-de-actividades.md)
5. [Diagrama de Componentes y Despliegue](./06-diagrama-componentes-despliegue.md)
