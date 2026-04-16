# Diagrama de Casos de Uso del Backend

## Descripción

Este diagrama identifica los **actores externos** que interactúan con el backend de R3Chat y los **casos de uso respaldados por endpoints o flujos reales** de la implementación actual. Se priorizan los procesos de autenticación, chat, sesiones, uso, suscripciones y administración; por eso se excluyen como foco principal funciones que hoy no tienen un flujo público completo, como la gestión de tenants o el manejo formal de adjuntos.

```mermaid
flowchart LR
    UA["Usuario anónimo"]
    UR["Usuario registrado"]
    UP["Usuario premium"]
    ADM["Administrador"]
    ST["Stripe"]

    UP -. "especialización" .-> UR
    ADM -. "especialización" .-> UR

    subgraph SYS["R3Chat Backend"]
        UC1("Registrar cuenta")
        UC2("Iniciar sesión local")
        UC3("Autenticarse con Google / GitHub")
        UC4("Gestionar sesión autenticada (profile, refresh, logout)")
        UC5("Enviar mensaje al chat")
        UC6("Usar modelo premium durante el envío")
        UC7("Gestionar sesiones de chat (crear, listar, ver, renombrar, eliminar)")
        UC8("Consultar estadísticas de uso")
        UC9("Gestionar suscripción premium (checkout, confirmación, portal)")
        UC10("Consultar estado de suscripción")
        UC11("Administrar usuarios")
        UC12("Validar cuota diaria y permisos del plan")
    end

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

    UC5 -. "<<include>>" .-> UC12
    UC6 -. "<<extend>>" .-> UC5
```

## Explicación de las relaciones

- **Especialización de actores:** `Usuario premium` hereda los casos de uso de `Usuario registrado` y agrega el uso de **modelos premium** (`gemini`, `openai`, `deepseek`) durante el envío de mensajes. `Administrador` también hereda la base de autenticación y suma la administración de usuarios.
- **Inclusión obligatoria:** `Enviar mensaje al chat` incluye `Validar cuota diaria y permisos del plan`, porque en el código el backend siempre consulta límites de uso y nivel de suscripción antes de invocar al proveedor de IA.
- **Integración externa con Stripe:** `Gestionar suscripción premium` resume los flujos reales de `create-checkout-session`, `confirm-session`, `create-portal-session` y el procesamiento del webhook que actualiza la suscripción.
- **Alcance controlado:** no se modelan como casos principales la administración de tenants ni el upload formal de adjuntos, porque no están expuestos hoy como flujo público principal en esta rama del backend.
