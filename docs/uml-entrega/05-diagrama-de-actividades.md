# Diagrama de Actividades

## Descripción

Este diagrama resume el proceso interno del backend al recibir un mensaje de chat, distinguiendo los casos de **usuario autenticado** y **usuario anónimo**, la **validación de cuota**, la **restricción de modelos premium** y la diferencia entre **respuesta completa** y **streaming**. También deja explícito que el historial persistente solo aplica de forma consistente a los chats autenticados.

```mermaid
flowchart TD
    A([Inicio\nLlega solicitud REST o WS]) --> B{¿Usuario autenticado?}
    B -->|Sí| C[Obtener userId del request o socket]
    B -->|No| D[Usar anonymousId y asumir tier FREE]

    C --> E[Obtener o crear Subscription]
    E --> F[Calcular límites según tier]
    D --> G[Validar cuota diaria con UsageService]
    F --> G

    G -->|Excedida| H([Fin con error\nLímite diario alcanzado])
    G -->|Disponible| I{¿Usuario autenticado?}

    I -->|Sí| J{¿Chat existente?}
    J -->|No| K[Crear chat con título inicial]
    J -->|Sí| L[Recuperar chat solicitado]
    K --> M[Persistir mensaje del usuario]
    L --> M
    M --> N[Recuperar historial persistido]

    I -->|No| O[Trabajar con conversación efímera\nsin persistir historial]

    N --> P[Seleccionar modelo solicitado]
    O --> P

    P --> Q{¿Modelo premium?}
    Q -->|Sí| R{¿Tier = PREMIUM?}
    R -->|No| S([Fin con error\nModelo restringido por plan])
    R -->|Sí| T[Invocar Gemini, OpenAI o DeepSeek]
    Q -->|No| U[Invocar Ollama\ncon fallback si falta memoria]

    T --> V{¿Modo streaming?}
    U --> V

    V -->|Sí| W[Emitir responseStart y retransmitir responseChunk]
    V -->|No| X[Esperar respuesta completa]
    W --> Y[Construir fullContent final]
    X --> Y

    Y --> Z{¿Usuario autenticado?}
    Z -->|Sí| AA[Persistir mensaje del asistente\ny actualizar título si corresponde]
    Z -->|No| AB[Omitir persistencia de mensajes]

    AA --> AC[Publicar chat.events.message.created\ny chat.events.usage.incremented]
    AB --> AC

    AC --> AD[Consumidores async actualizan\nUsageRecord, UsageConsumedEvent y BillingUsageEvent]
    AD --> AE([Fin\nRespuesta entregada al cliente])
```

## Explicación de decisiones clave

- **Autenticado vs. anónimo:** el backend admite ambos escenarios, pero el usuario anónimo trabaja con `anonymousId` y **no persiste historial del mismo modo** que un chat autenticado.
- **Validación previa de cuota:** el control de uso ocurre antes de llamar al proveedor de IA, evitando gasto innecesario de tokens y garantizando coherencia con el plan del usuario.
- **Restricción de modelos premium:** si el modelo solicitado es `gemini`, `openai` o `deepseek`, el sistema exige `SubscriptionTier.PREMIUM`; de lo contrario, responde con error.
- **Dos modos de respuesta:** el backend soporta respuesta completa y streaming. En streaming, el cliente recibe `responseStart`, varios `responseChunk` y finalmente `responseEnd`.
- **Telemetría desacoplada:** el uso y la auditoría no bloquean la respuesta principal; se registran a través de consumidores asíncronos que actualizan `UsageRecord`, `UsageConsumedEvent` y `BillingUsageEvent`.
