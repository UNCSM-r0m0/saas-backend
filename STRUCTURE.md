# Estructura del Proyecto R3Chat Backend

## 📁 Organización de Carpetas (Reorganizado)

```
saas-backend/
├── apps/                           # Microservicios (comunican vía NATS)
│   ├── common/                     # Bootstrap compartido para microservicios
│   ├── ms-auth/                    # Microservicio de Autenticación (puerto 3001)
│   ├── ms-users/                   # Microservicio de Usuarios (puerto 3002)
│   ├── ms-chat/                    # Microservicio de Chat (puerto 3003)
│   ├── ms-billing/                 # Microservicio de Facturación (puerto 3004)
│   └── ms-usage/                   # Microservicio de Uso/Límites (puerto 3005)
│
├── src/                            # Gateway API (puerto 3000)
│   ├── auth/                       # Gateway Auth - HTTP/REST endpoints
│   ├── chat/                       # Gateway Chat - WebSocket gateway
│   ├── models/                     # API de modelos disponibles
│   ├── integrations/               # Integraciones con servicios externos
│   │   └── ai/                     # Proveedores de AI
│   │       ├── deepseek/           # Integración DeepSeek API
│   │       ├── gemini/             # Integración Google Gemini
│   │       ├── ollama/             # Integración Ollama local/proxy
│   │       └── openai/             # Integración OpenAI/LLM Studio
│   ├── stripe/                     # Integración Stripe (pagos)
│   ├── subscriptions/              # Gestión de suscripciones
│   ├── upload/                     # Gestión de archivos (Cloudflare Images)
│   ├── users/                      # Gateway Users - HTTP endpoints
│   ├── common/                     # Utilidades, decorators, guards compartidos
│   ├── prisma/                     # Configuración Prisma ORM
│   ├── app.module.ts               # Módulo raíz del Gateway
│   └── main.ts                     # Punto de entrada Gateway
│
├── libs/                           # Librerías compartidas
│   └── contracts/                  # Contratos NATS (DTOs, patterns)
│       ├── auth/                   # Contratos Auth
│       ├── chat/                   # Contratos Chat
│       ├── billing/                # Contratos Billing
│       └── usage/                  # Contratos Usage
│
├── prisma/
│   └── schema.prisma               # Schema de base de datos
│
└── docker-compose.yml              # Orquestación de servicios
```

## 🎯 Diferencias Clave

### Antes vs Después

| Antes | Después | Razón |
|-------|---------|-------|
| `apps/auth/` | `apps/ms-auth/` | Claridad: indica que es microservicio |
| `apps/chat/` | `apps/ms-chat/` | Claridad: indica que es microservicio |
| `src/deepseek/` | `src/integrations/ai/deepseek/` | Organización: todos los AI juntos |
| `src/gemini/` | `src/integrations/ai/gemini/` | Organización: todos los AI juntos |
| `src/ollama/` | `src/integrations/ai/ollama/` | Organización: todos los AI juntos |
| `src/openai/` | `src/integrations/ai/openai/` | Organización: todos los AI juntos |
| `apps/ms-paypal/` | **Eliminado** | No se implementará por ahora |
| `src/paypal/` | **Eliminado** | No se implementará por ahora |

## 🔧 Convenciones de Nombres

### Microservicios (`apps/`)
- Prefijo `ms-` para identificar microservicios
- Cada uno tiene su propio puerto
- Se comunican entre sí vía NATS (message broker)
- Tienen acceso directo a base de datos

### Gateway (`src/`)
- **No** tiene prefijo (es el punto de entrada)
- Expone HTTP REST y WebSocket
- Recibe requests del frontend
- Delega trabajo a microservicios vía NATS
- Integraciones externas (AI, pagos, etc.)

### Integraciones (`src/integrations/`)
- Adaptadores a APIs externas
- No tienen estado propio
- Pueden ser reutilizados por múltiples módulos

## 🚀 Comandos Útiles

```bash
# Desarrollo local (todos los servicios)
npm run start:dev

# Desarrollo de microservicio específico
npm run start:dev:auth
npm run start:dev:chat

# Producción
npm run build:all
npm run start:prod:gateway
npm run start:prod:auth
npm run start:prod:chat
```

## 📝 Notas

- **PayPal ha sido completamente eliminado** del proyecto
- Stripe permanece como único proveedor de pagos
- Los servicios AI están ahora organizados bajo `integrations/ai/`
- Los microservicios usan prefijo `ms-` para fácil identificación
