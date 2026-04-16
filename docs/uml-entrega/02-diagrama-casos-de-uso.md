# Diagrama de Casos de Uso

## Descripción
Este diagrama representa los actores principales del sistema y las funcionalidades a las que pueden acceder. Se distinguen cuatro actores humanos y un actor sistema (Stripe). El núcleo del producto es el envío de mensajes a modelos de IA, con funcionalidades diferenciadas según el nivel de suscripción del usuario.

```mermaid
usecaseDiagram
    actor "Usuario Anónimo" as UA
    actor "Usuario Registrado" as UR
    actor "Usuario Premium" as UP
    actor "Administrador" as ADM
    actor "Stripe" as Stripe

    package "SaaS Platform - Chat con IA" {
        usecase "Enviar mensaje de chat\n(modelo gratuito)" as UC1
        usecase "Gestionar conversaciones\n(CRUD)" as UC2
        usecase "Autenticarse\n(local / OAuth)" as UC3
        usecase "Registrar cuenta" as UC4
        usecase "Enviar mensaje con modelos\nPremium (Gemini, OpenAI, DeepSeek)" as UC5
        usecase "Subir archivos adjuntos" as UC6
        usecase "Gestionar suscripción\n(Stripe Checkout)" as UC7
        usecase "Ver estadísticas de uso" as UC8
        usecase "Gestionar usuarios y tenants" as UC9
        usecase "Auditar eventos de uso" as UC10
        usecase "Aplicar rate limiting" as UC11
    }

    UA --> UC1

    UR --> UC1
    UR --> UC2
    UR --> UC3
    UR --> UC4
    UR --> UC8

    UP --> UC5
    UP --> UC6
    UP --> UC7

    ADM --> UC9

    Stripe --> UC7
    Stripe --> UC10

    UC11 ..> UC1 : <<include>>
```

## Explicación de relaciones
- **Generalización de usuario:** el `Usuario Premium` hereda los casos de uso del `Usuario Registrado` y añade funcionalidades exclusivas (modelos avanzados y adjuntos).
- **Inclusión (`<<include>>`):** cada vez que se envía un mensaje (UC1), el sistema debe aplicar rate limiting (UC11) como paso obligatorio.
- **Actor externo `Stripe`:** gestiona el procesamiento de pagos (UC7) y la recepción de webhooks para auditoría (UC10).
