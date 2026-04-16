# Diagrama de Actividades

## Descripción
Este diagrama describe el flujo de procesos internos que ocurren cuando un usuario envía un mensaje a través del chat. Cubre desde la recepción del mensaje hasta la entrega de la respuesta del asistente de IA, incluyendo validaciones de autenticación, límites de uso, selección de modelo y persistencia de datos.

```mermaid
flowchart TD
    A([Inicio<br/>Usuario envía mensaje]) --> B{¿Usuario<br/>autenticado?}
    B -->|Sí| C[Obtener userId del JWT]
    B -->|No| D[Usar anonymousId]

    C --> E[Verificar límite de uso<br/>con UsageService]
    D --> E

    E -->|Excedido| F([Error<br/>Límite diario alcanzado])
    E -->|Permitido| G[Obtener o crear<br/>Suscripción]
    G --> H[Obtener o crear<br/>Chat/Conversación]
    H --> I[Guardar mensaje del usuario<br/>en base de datos]
    I --> J[Recuperar historial<br/>del chat]
    J --> K{Seleccionar modelo<br/>de IA}

    K -->|Gemini / OpenAI /<br/>DeepSeek| L{¿Tier = PREMIUM?}
    L -->|No| M([Error<br/>Modelo requiere Premium])
    L -->|Sí| N[Invocar API del modelo seleccionado]
    K -->|Ollama (gratuito)| N

    N --> O{¿Modo streaming?}
    O -->|Sí| P[Recibir chunks del proveedor]
    P --> Q[Retransmitir chunks<br/>vía WebSocket]
    Q --> R[Concatenar respuesta completa]
    O -->|No| S[Recibir respuesta completa]

    R --> T[Guardar mensaje del asistente<br/>en base de datos]
    S --> T
    T --> U[Publicar eventos de dominio<br/>usage.incremented / message.created]
    U --> V[Consumidores async actualizan<br/>UsageRecord y BillingUsageEvent]
    V --> W([Fin<br/>Respuesta entregada al usuario])
```

## Explicación de decisiones clave
- **Nodo de decisión "¿Usuario autenticado?"**: el sistema permite interacciones anónimas con un límite reducido (3 mensajes) y usuarios autenticados con límites mayores según su tier.
- **Verificación de límite de uso**: antes de cualquier procesamiento costoso (llamada a IA), se valida la cuota diaria. Esto protege tanto los recursos del sistema como el cumplimiento de los planes de suscripción.
- **Selección de modelo y validación Premium**: los modelos avanzados (Gemini, OpenAI, DeepSeek) están restringidos exclusivamente a usuarios con suscripción PREMIUM.
- **Streaming vs. respuesta completa**: el flujo de streaming añade los pasos de retransmisión de chunks en tiempo real, mientras que el modo REST simplemente espera la respuesta completa.
- **Eventos de dominio**: la publicación de eventos desacoplada permite que `Usage` y `Billing` actúen de forma asíncrona sin bloquear la respuesta al usuario.
