# Diagramas UML del Backend de R3Chat Asistente IA

**Asignatura:** Ingeniería de Software II  
**Carrera:** Ingeniería en Sistemas de Información  
**Facultad:** Facultad de Ciencias y Tecnología  
**Universidad:** Universidad Nacional Casimiro Sotelo Montenegro  
**Docente / Facilitador:** Msc. Marcos Hernández Zamora  
**Fecha de entrega:** 16/04/2026

---

## Integrantes del equipo

| Integrante | N.° de carnet |
| --- | --- |
| Lenin Gilberto Osorio Martínez | 24056861 |
| Vidal Antonio Alvarado Martínez | 24056891 |
| Heidi Melissa Corea Ramos | 24049241 |
| Walter Anselmo Ortega Goussen | 24050661 |
| Moisés David Espinoza Espinoza | 24055171 |
| Guadalupe Dariana Zúniga Vicente | 24057001 |

---

## Sistema documentado

**Nombre del sistema:** R3Chat Asistente IA  
**Alcance de esta entrega:** Backend productivo del sistema

## Introducción

El backend de **R3Chat Asistente IA** implementa una arquitectura basada en **NestJS**, con un **API Gateway** que expone endpoints HTTP y WebSocket, y un conjunto de microservicios especializados (`auth`, `users`, `chat`, `billing` y `usage`) que se comunican mediante **NATS**. La persistencia se resuelve con **PostgreSQL 16** y **Prisma ORM**, separando los dominios en los esquemas `users`, `chat`, `billing` y `usage`.

Desde la perspectiva funcional, el backend permite **registro e inicio de sesión local**, **OAuth con Google y GitHub**, **gestión de sesiones de chat**, **envío de mensajes con streaming en tiempo real**, **control de cuotas por plan**, **suscripciones premium con Stripe** y **auditoría asíncrona de uso**. Además, el microservicio de chat puede orquestar respuestas con **Ollama**, **Google Gemini**, **OpenAI** y **DeepSeek**, según el modelo solicitado y el nivel de suscripción del usuario.

Este documento se concentra **solo en el backend real de esta rama**, evitando incluir como capacidades principales elementos que no están expuestos hoy como flujo público del sistema. Por esa razón, los diagramas muestran a los clientes web o móvil únicamente como **consumidores externos**, y priorizan la coherencia entre código, esquema de datos, eventos NATS y topología de despliegue.

## Alcance técnico documentado

- API Gateway NestJS para **HTTP** y **WebSocket**.
- Microservicios `auth`, `users`, `chat`, `billing` y `usage`.
- Comunicación interna y publicación de eventos mediante **NATS**.
- Persistencia con **PostgreSQL** y **Prisma ORM**.
- Integración de suscripciones con **Stripe Checkout**, portal y webhooks.
- Orquestación de modelos de IA con **Ollama**, **Gemini**, **OpenAI** y **DeepSeek**.
- Consumo externo desde clientes web/móvil sin incorporarlos como parte del backend documentado.

## Criterios aplicados en esta versión

- Fidelidad estricta al código actual de la rama.
- Consistencia entre diagramas, controllers, services y `prisma/schema.prisma`.
- Eliminación de funcionalidades infladas o no verificadas como flujo principal.
- Redacción formal para exportación posterior a PDF académico.

## Índice de diagramas

1. [Diagrama de Casos de Uso](./02-diagrama-casos-de-uso.md)
2. [Diagrama de Clases](./03-diagrama-de-clases.md)
3. [Diagrama de Secuencia](./04-diagrama-de-secuencia.md)
4. [Diagrama de Actividades](./05-diagrama-de-actividades.md)
5. [Diagrama de Componentes y Despliegue](./06-diagrama-componentes-despliegue.md)
