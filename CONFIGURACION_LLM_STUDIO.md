# Configuración de LLM Studio Local con Sistema de Colas

## 📋 Resumen

Se ha configurado LLM Studio local (`http://192.168.1.13:1234`) con el modelo `openai/gpt-oss-20b` como **modelo PREMIUM** con un sistema de colas para evitar saturar tu laptop cuando múltiples usuarios hacen peticiones.

## 🔧 Configuración del .env

Agrega estas líneas a tu archivo `.env`:

```bash
# LLM Studio Local (Puerto 1234)
LLM_STUDIO_BASE_URL=http://192.168.1.13:1234
LLM_STUDIO_MODEL=openai/gpt-oss-20b
LLM_STUDIO_MAX_CONCURRENT=2
LLM_STUDIO_QUEUE_TIMEOUT=30000
```

### Parámetros:

- `LLM_STUDIO_BASE_URL`: URL de tu servidor LLM Studio
- `LLM_STUDIO_MODEL`: Modelo a usar (openai/gpt-oss-20b)
- `LLM_STUDIO_MAX_CONCURRENT`: Máximo de peticiones simultáneas (default: 2)
- `LLM_STUDIO_QUEUE_TIMEOUT`: Timeout para peticiones en cola en ms (default: 30000)

## 🎯 Cómo Funciona

### Sistema de Colas

1. **Límite de Concurrencia**: Solo `LLM_STUDIO_MAX_CONCURRENT` peticiones pueden ejecutarse simultáneamente
2. **Cola de Espera**: Las peticiones adicionales se encolan automáticamente
3. **Timeout**: Si una petición está en cola más de `LLM_STUDIO_QUEUE_TIMEOUT` ms, se rechaza
4. **Protección de Hardware**: Evita saturar tu laptop con múltiples peticiones pesadas

### Modelo Premium

El modelo está configurado como **PREMIUM**, lo que significa:

- Solo usuarios con suscripción PREMIUM pueden usarlo
- Se verifica automáticamente en `chat.service.ts` (líneas 129-132)
- Los usuarios FREE/REGISTERED recibirán un error de `PREMIUM_REQUIRED`

## 📊 Monitoreo

### 1. Endpoint de Lista de Modelos (Dinámico)

```bash
GET /api/models/public
```

Respuesta cuando LLM Studio está configurado:

```json
{
  "models": [
    {
      "id": "openai",
      "name": "GPT OSS 20B (LLM Studio)",
      "provider": "LLM Studio Local",
      "available": true,
      "isPremium": true,
      "features": ["text-generation", "streaming", "chat-completions"],
      "description": "Modelo local GPT OSS 20B ejecutándose en LLM Studio con sistema de colas",
      "defaultModel": "openai/gpt-oss-20b",
      "queueStats": {
        "activeRequests": 1,
        "queuedRequests": 2,
        "maxConcurrent": 2,
        "utilization": 50
      }
    }
  ]
}
```

### 2. Endpoint de Estadísticas Detalladas

```bash
GET /api/chat/models/openai/info
```

Respuesta:

```json
{
  "success": true,
  "data": {
    "name": "openai/gpt-oss-20b",
    "provider": "LLM Studio Local",
    "available": true,
    "features": ["text-generation", "streaming", "chat-completions"],
    "queueStats": {
      "activeRequests": 1,
      "queuedRequests": 2,
      "maxConcurrent": 2,
      "utilization": 50
    }
  }
}
```

### Logs

El sistema genera logs detallados:

```
🎯 Usando LLM Studio con cola de concurrencia
▶️ Ejecutando inmediatamente (1/2 activos)
⏳ Encolando petición (2 en cola, 2/2 activos)
📊 Queue stats: 2/2 activos, 1 en cola (100% uso)
✅ Respuesta generada, tokens: 512, modelo: openai/gpt-oss-20b
```

## 🚀 Uso desde el Cliente

### REST API (HTTP)

```typescript
// Streaming SSE
fetch('/api/chat/message/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer YOUR_JWT',
  },
  body: JSON.stringify({
    content: '¿Cuál es la capital de Francia?',
    model: 'openai', // 👈 Usa el modelo LLM Studio
    conversationId: 'chat-id-123',
  }),
});
```

### WebSocket (Streaming en Tiempo Real)

```typescript
socket.emit('sendMessage', {
  message: '¿Cuál es la capital de Francia?',
  model: 'openai', // 👈 Usa el modelo LLM Studio
  chatId: 'chat-id-123',
});
```

## 🔄 Flujo de Peticiones

```
Usuario 1 → [openai] → OpenAIService → LocalModelQueueService → LLM Studio
Usuario 2 → [openai] → OpenAIService → LocalModelQueueService → LLM Studio
Usuario 3 → [openai] → OpenAIService → [Cola de espera...] → LLM Studio
```

## ⚠️ Manejo de Errores

### Servidor Ocupado

Si la cola está llena o el timeout se alcanza:

```json
{
  "error": "SERVER_BUSY",
  "message": "Servidor ocupado, intenta en unos segundos."
}
```

### Modelo Premium Requerido

Si un usuario FREE/REGISTERED intenta usar el modelo:

```json
{
  "error": "PREMIUM_REQUIRED",
  "message": "Este modelo es Premium. Actualiza tu suscripción para usarlo."
}
```

## 📁 Archivos Modificados

1. **`src/common/services/local-model-queue.service.ts`** (NUEVO)
   - Servicio de cola con control de concurrencia

2. **`src/openai/openai.service.ts`** (MODIFICADO)
   - Soporte para LLM Studio local
   - Integración con sistema de colas
   - Detección automática de LLM_STUDIO_BASE_URL
   - Método `getModelInfo()` ahora retorna info dinámica

3. **`src/openai/openai.module.ts`** (MODIFICADO)
   - Registra LocalModelQueueService como provider

4. **`src/chat/chat.controller.ts`** (MODIFICADO)
   - Nuevo endpoint `/api/chat/models/openai/info` para monitoreo

5. **`src/models/models.controller.ts`** (MODIFICADO)
   - Endpoint `/api/models/public` ahora detecta dinámicamente LLM Studio
   - Muestra información real del modelo configurado
   - Incluye estadísticas de cola en tiempo real

## 🎨 Características

✅ **Sin Hard-Coding**: El sistema es completamente dinámico
✅ **Modelo Premium**: Solo accesible para usuarios PREMIUM
✅ **Sistema de Colas**: Protege tu hardware de saturación
✅ **Streaming**: Soporta respuestas en tiempo real (SSE y WebSocket)
✅ **Monitoreo**: Endpoint de estadísticas en tiempo real
✅ **Fallback**: Si no se configura LLM Studio, usa OpenAI Cloud
✅ **Compatible**: API compatible con OpenAI (LLM Studio)

## 🧪 Pruebas

### 1. Verifica que LLM Studio esté corriendo

```bash
curl http://192.168.1.13:1234/v1/models
```

### 2. Verifica que el modelo aparezca en la lista pública (¡DINÁMICO!)

```bash
curl https://api.r0lm0.dev/api/models/public
```

Deberías ver algo como:

```json
{
  "models": [
    {
      "id": "openai",
      "name": "GPT OSS 20B (LLM Studio)",
      "provider": "LLM Studio Local",
      "available": true,
      "isPremium": true,
      "queueStats": {
        "activeRequests": 0,
        "queuedRequests": 0,
        "maxConcurrent": 2,
        "utilization": 0
      }
    }
  ]
}
```

### 3. Prueba el endpoint de estadísticas detalladas

```bash
curl http://localhost:3000/api/chat/models/openai/info
```

### 4. Envía un mensaje de prueba (requiere token PREMIUM)

```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "content": "Hola, ¿cómo estás?",
    "model": "openai"
  }'
```

## 🔧 Ajuste de Rendimiento

Si tu laptop está lenta, reduce la concurrencia:

```bash
LLM_STUDIO_MAX_CONCURRENT=1  # Solo 1 petición a la vez
```

Si tienes un buen hardware, aumenta:

```bash
LLM_STUDIO_MAX_CONCURRENT=4  # Hasta 4 peticiones simultáneas
```

## 🔄 Detección Automática: LLM Studio vs OpenAI Cloud

El sistema ahora es **100% dinámico** y detecta automáticamente qué backend usar:

### Con LLM Studio (cuando `LLM_STUDIO_BASE_URL` está configurado):

```json
{
  "id": "openai",
  "name": "GPT OSS 20B (LLM Studio)",
  "provider": "LLM Studio Local",
  "available": true,
  "isPremium": true,
  "description": "Modelo local GPT OSS 20B ejecutándose en LLM Studio con sistema de colas",
  "defaultModel": "openai/gpt-oss-20b",
  "queueStats": { ... }  // ← Incluye estadísticas de cola
}
```

### Sin LLM Studio (fallback a OpenAI Cloud):

```json
{
  "id": "openai",
  "name": "gpt-4o-mini",
  "provider": "OpenAI",
  "available": true,
  "isPremium": true,
  "description": "Modelo de OpenAI optimizado para chat y conversaciones",
  "defaultModel": "gpt-4o-mini"
  // Sin queueStats (OpenAI Cloud no necesita cola)
}
```

## 📝 Notas

- El sistema detecta automáticamente si `LLM_STUDIO_BASE_URL` está configurado
- Si está configurado, se usa LLM Studio; si no, se usa OpenAI Cloud
- Las estadísticas de cola se actualizan en tiempo real
- El timeout de cola previene bloqueos indefinidos
- Los logs son muy verbosos para facilitar el debugging
- **El frontend NO necesita cambios**: solo usa `model: 'openai'` y el backend decide
