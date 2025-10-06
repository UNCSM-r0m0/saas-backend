# 🚀 SaaS Backend - Multi-Tenant AI Chat Platform

Backend para una aplicación SaaS de chat con IA, inspirada en t3.chat. Desarrollada con NestJS, Prisma, PostgreSQL y Ollama para modelos de IA locales.

## 📋 Características

- ✅ **Autenticación Multi-Provider**: Local, Google OAuth2.0, GitHub OAuth2.0
- ✅ **Sistema de Suscripciones**: Free, Registered, Premium
- ✅ **Chat con IA Local**: Integración con Ollama (deepseek-r1)
- ✅ **Rate Limiting por Tier**: Control de uso de mensajes y tokens
- ✅ **Historial de Conversaciones**: Para usuarios registrados y premium
- ✅ **Tracking de Uso**: Monitoreo de mensajes y tokens consumidos
- ✅ **API REST Documentada**: Swagger/OpenAPI
- ✅ **Multi-Tenancy Ready**: Arquitectura preparada para múltiples tenants

## 🛠️ Stack Tecnológico

- **Framework**: NestJS 11
- **Base de Datos**: PostgreSQL + Prisma ORM
- **Autenticación**: Passport.js + JWT
- **IA**: Ollama (modelos locales)
- **Validación**: class-validator + Joi
- **Documentación**: Swagger/OpenAPI
- **Pagos**: Stripe (webhooks configurados)

## 📦 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/UNCSM-r0m0/saas-backend.git
cd saas-backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
# Copiar la plantilla
cp .env.template .env

# Editar .env con tus valores reales
# Asegúrate de configurar:
# - DATABASE_URL
# - JWT_SECRET
# - GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET
# - GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET
# - OLLAMA_URL (si usas Ollama en otro host)
```

### 4. Configurar base de datos

```bash
# Generar cliente de Prisma
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate

# (Opcional) Seed de datos iniciales
npm run prisma:seed
```

### 5. Iniciar Ollama (IA Local)

```bash
# Instalar Ollama: https://ollama.ai
ollama pull deepseek-r1:7b

# Verificar que esté corriendo
ollama list
```

## 🚀 Uso

### Desarrollo

```bash
# Modo watch con hot-reload
npm run start:dev

# Con debugging
npm run start:debug
```

La API estará disponible en:

- **API**: http://localhost:3000/api
- **Swagger**: http://localhost:3000/api/docs

### Producción

#### Opción 1: Build Simple

```bash
# Build completo (incluye prisma:generate)
npm run build:prod

# Iniciar en producción
npm run start:prod
```

#### Opción 2: Deploy Completo (con migraciones)

```bash
# Setup completo: genera Prisma, migra DB y build
npm run deploy:setup

# O todo en uno (setup + start)
npm run deploy:start
```

#### Opción 3: Con PM2 (Recomendado para servidores)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Build de producción
npm run build:prod

# Migrar base de datos en producción
npm run prisma:migrate:deploy

# Iniciar con PM2
pm2 start ecosystem.config.js

# Comandos PM2 útiles
pm2 status          # Ver estado
pm2 logs            # Ver logs
pm2 restart all     # Reiniciar
pm2 stop all        # Detener
pm2 delete all      # Eliminar procesos
```

## 📊 Scripts Disponibles

### Desarrollo

```bash
npm run start:dev       # Desarrollo con hot-reload
npm run start:debug     # Con debugging
```

### Build y Producción

```bash
npm run build           # Build básico
npm run build:prod      # Build con Prisma generate
npm run start:prod      # Iniciar producción
npm run deploy:setup    # Setup completo (Prisma + build)
npm run deploy:start    # Setup + start
```

### Prisma

```bash
npm run prisma:generate        # Generar cliente
npm run prisma:migrate         # Migración (dev)
npm run prisma:migrate:deploy  # Migración (producción)
npm run prisma:studio          # Interfaz visual DB
npm run prisma:seed            # Seed de datos
```

### Testing y Calidad

```bash
npm run test            # Unit tests
npm run test:watch      # Tests en watch mode
npm run test:cov        # Coverage
npm run test:e2e        # Tests E2E
npm run lint            # Linter
npm run format          # Prettier
```

## 🔐 Configuración OAuth

### Google OAuth2.0

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea un nuevo proyecto
3. Habilita "Google+ API"
4. Crea credenciales OAuth 2.0
5. Configura "Authorized redirect URIs": `http://localhost:3000/api/auth/google/callback`
6. Copia `CLIENT_ID` y `CLIENT_SECRET` a tu `.env`

### GitHub OAuth

1. Ve a [GitHub Developer Settings](https://github.com/settings/developers)
2. Crea una nueva OAuth App
3. Configura "Authorization callback URL": `http://localhost:3000/api/auth/github/callback`
4. Copia `CLIENT_ID` y `CLIENT_SECRET` a tu `.env`

## 📚 Documentación API

Accede a la documentación interactiva de Swagger:

```
http://localhost:3000/api/docs
```

### Endpoints Principales

#### Autenticación

- `POST /api/auth/register` - Registro local
- `POST /api/auth/login` - Login local
- `GET /api/auth/google` - Iniciar OAuth Google
- `GET /api/auth/github` - Iniciar OAuth GitHub
- `GET /api/auth/profile` - Obtener perfil (requiere JWT)

#### Chat

- `POST /api/chat/message` - Mensaje anónimo
- `POST /api/chat/message/authenticated` - Mensaje autenticado
- `GET /api/chat/conversations` - Listar conversaciones
- `GET /api/chat/conversations/:id` - Ver conversación
- `GET /api/chat/usage/stats` - Estadísticas de uso

#### Usuarios

- `GET /api/users` - Listar usuarios (Admin)
- `GET /api/users/:id` - Ver usuario
- `PATCH /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario

## 💎 Tiers y Límites

| Tier               | Mensajes/día | Max Tokens | Imágenes | Historial |
| ------------------ | ------------ | ---------- | -------- | --------- |
| **Free** (Anónimo) | 3            | 512        | ❌       | ❌        |
| **Registered**     | 10           | 2,048      | ❌       | ✅        |
| **Premium**        | 1,000        | 8,192      | ✅       | ✅        |

Puedes modificar estos límites en el archivo `.env`:

```bash
FREE_USER_MESSAGE_LIMIT=3
REGISTERED_USER_MESSAGE_LIMIT=10
PREMIUM_USER_MESSAGE_LIMIT=1000
```

## 🌐 Variables de Entorno

Ver `.env.template` para la lista completa. Las más importantes:

| Variable            | Descripción         | Ejemplo                                    |
| ------------------- | ------------------- | ------------------------------------------ |
| `DATABASE_URL`      | Conexión PostgreSQL | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET`        | Secreto para JWT    | `tu_secreto_seguro`                        |
| `OLLAMA_URL`        | URL de Ollama       | `http://localhost:11434`                   |
| `OLLAMA_MODEL`      | Modelo a usar       | `deepseek-r1:7b`                           |
| `GOOGLE_CLIENT_ID`  | OAuth Google        | `xxx.apps.googleusercontent.com`           |
| `STRIPE_SECRET_KEY` | Clave Stripe        | `sk_test_xxx`                              |

## 🐳 Docker (Opcional)

```dockerfile
# Dockerfile básico
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build:prod
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

## 📝 Estructura del Proyecto

```
src/
├── auth/              # Autenticación y estrategias
├── chat/              # Lógica de chat e IA
├── ollama/            # Servicio de Ollama
├── prisma/            # Servicio de Prisma
├── subscriptions/     # Gestión de suscripciones
├── usage/             # Tracking de uso
├── users/             # Gestión de usuarios
├── app.module.ts      # Módulo principal
└── main.ts            # Entry point

prisma/
├── schema.prisma      # Esquema de base de datos
├── migrations/        # Migraciones
└── seed.ts           # Datos iniciales
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y no tiene licencia pública.

## 👤 Autor

**r0lm0**

- GitHub: [@UNCSM-r0m0](https://github.com/UNCSM-r0m0)
- Email: rolmo92@gmail.com

## 🙏 Agradecimientos

- Inspirado en [t3.chat](https://t3.chat)
- Construido con [NestJS](https://nestjs.com)
- IA local con [Ollama](https://ollama.ai)

---

⭐ Si te gusta este proyecto, dale una estrella en GitHub!

#########
🚀 COMANDOS DISPONIBLES:
Para usar el script, ejecuta en WSL:
Comandos principales:
Iniciar la aplicación:
Detener la aplicación:
Reiniciar la aplicación:
Ver estado:
Ver logs en tiempo real:
Actualizar código y reiniciar:
Solo reconstruir:
Probar endpoints:
