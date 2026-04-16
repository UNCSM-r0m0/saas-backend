# Diagrama de Casos de Uso del Backend

## Descripción

Este diagrama identifica los **actores externos** que interactúan con el backend de R3Chat y los **casos de uso respaldados por endpoints o flujos reales** de la implementación actual. Se priorizan los procesos de autenticación, chat, sesiones, uso, suscripciones y administración; por eso se excluyen como foco principal funciones que hoy no tienen un flujo público completo, como la gestión de tenants o el manejo formal de adjuntos.

```mermaid
usecaseDiagram
    actor "Usuario anónimo" as UA
    actor "Usuario registrado" as UR
    actor "Usuario premium" as UP
    actor "Administrador" as ADM
    actor "Stripe" as ST

    UR <|-- UP
    UR <|-- ADM

    rectangle "R3Chat Backend" {
        usecase "Registrar cuenta" as UC1
        usecase "Iniciar sesión local" as UC2
        usecase "Autenticarse con\nGoogle / GitHub" as UC3
        usecase "Gestionar sesión autenticada\n(profile, refresh, logout)" as UC4
        usecase "Enviar mensaje al chat" as UC5
        usecase "Usar modelo premium\ndurante el envío" as UC6
        usecase "Gestionar sesiones de chat\n(crear, listar, ver, renombrar, eliminar)" as UC7
        usecase "Consultar estadísticas de uso" as UC8
        usecase "Gestionar suscripción premium\n(checkout, confirmación, portal)" as UC9
        usecase "Consultar estado de suscripción" as UC10
        usecase "Administrar usuarios" as UC11
        usecase "Validar cuota diaria\ny permisos del plan" as UC12
    }

    UA --> UC1
    UA --> UC2
    UA --> UC3
    UA --> UC5

    UR --> UC4
    UR --> UC5
    UR --> UC7
    UR --> UC8
    UR --> UC9
    UR --> UC10

    UP --> UC6

    ADM --> UC11

    ST --> UC9

    UC5 ..> UC12 : <<include>>
    UC6 ..> UC5 : <<extend>>
```

## Explicación de las relaciones

- **Especialización de actores:** `Usuario premium` hereda los casos de uso de `Usuario registrado` y agrega el uso de **modelos premium** (`gemini`, `openai`, `deepseek`) durante el envío de mensajes. `Administrador` también hereda la base de autenticación y suma la administración de usuarios.
- **Inclusión obligatoria:** `Enviar mensaje al chat` incluye `Validar cuota diaria y permisos del plan`, porque en el código el backend siempre consulta límites de uso y nivel de suscripción antes de invocar al proveedor de IA.
- **Integración externa con Stripe:** `Gestionar suscripción premium` resume los flujos reales de `create-checkout-session`, `confirm-session`, `create-portal-session` y el procesamiento del webhook que actualiza la suscripción.
- **Alcance controlado:** no se modelan como casos principales la administración de tenants ni el upload formal de adjuntos, porque no están expuestos hoy como flujo público principal en esta rama del backend.
