# 🔒 Análisis de Seguridad - R3Chat Backend

**Fecha:** 21/03/2026  
**Autor:** Kimi Code CLI  
**Propósito:** Identificar endpoints sensibles y proponer mejoras de seguridad

---

## 📋 Endpoints por Nivel de Sensibilidad

### 🔴 CRÍTICO (Requiere máxima protección)

| Endpoint | Método | Datos Sensibles | Riesgos | Protección Actual |
|----------|--------|-----------------|---------|-------------------|
| `/auth/login` | POST | Email, Password | Fuerza bruta, Sniffing | Rate limiting ✅, HTTPS ✅ |
| `/auth/register` | POST | Email, Password, Datos personales | Spam, Data breach | Rate limiting ✅ |
| `/auth/refresh` | POST | Refresh Token | Token replay | HTTP-only cookie ✅ |
| `/stripe/webhook` | POST | Datos de pago | Webhook spoofing | Stripe signature |
| `/upload/image` | POST | Archivos binarios | Malware upload, DoS | File type check, Size limit |

### 🟠 ALTO (Información personal)

| Endpoint | Método | Datos Sensibles | Riesgos |
|----------|--------|-----------------|---------|
| `/users` | GET/POST | Perfiles, emails | Data enumeration |
| `/users/:id` | GET/PATCH | Datos personales | IDOR (acceso a otros usuarios) |
| `/chat/sessions` | GET/POST | Historial de conversaciones | Privacy leak |
| `/chat/sessions/:id/messages` | GET | Contenido de chats | Data breach |
| `/stripe/subscription` | GET | Datos de suscripción, precios | Info financiera |

### 🟡 MEDIO (Funcionalidades)

| Endpoint | Método | Uso |
|----------|--------|-----|
| `/chat/message/stream` | POST | Streaming de AI |
| `/models/public` | GET | Listado de modelos |
| `/upload/image/:id` | GET | Acceso a imágenes |
| `/health` | GET | Health check |

### 🟢 BAJO (Públicos)

| Endpoint | Método | Notas |
|----------|--------|-------|
| `/auth/google` | GET | OAuth redirect |
| `/auth/google/callback` | GET | OAuth callback (tokens en URL en dev) |
| `/models/public` | GET | Sin auth requerida |

---

## 🚨 Vulnerabilidades Identificadas

### 1. **Callback OAuth expone token en URL (Desarrollo)**
**Ubicación:** `auth.controller.ts` - Google/GitHub callback

```typescript
// ❌ PROBLEMA: Token en URL
return res.redirect(`${frontendUrl}/auth/callback?token=${access_token}`);
```

**Riesgo:**
- Token queda en historial del navegador
- Token queda en logs del servidor
- Fuga de credenciales

**Solución propuesta:**
- Desarrollo: Usar postMessage o proxy
- Producción: Cookies HTTP-only (ya implementado)

---

### 2. **IDOR (Insecure Direct Object Reference)**
**Ubicación:** `/users/:id`, `/chat/sessions/:id`

**Riesgo:** Usuario A puede acceder a datos del usuario B cambiando el ID.

**Ejemplo:**
```bash
curl https://api.r0lm0.dev/users/123  # Token del usuario 456
```

**Solución:** Verificar ownership:
```typescript
@Get(':id')
async getUser(@Param('id') id: string, @CurrentUser() user) {
  if (id !== user.id && user.role !== 'admin') {
    throw new ForbiddenException('Access denied');
  }
  return this.usersService.findById(id);
}
```

---

### 3. **Falta de Sanitización en Logs**
**Riesgo:** Datos sensibles pueden quedar en logs.

**Encontrado en:**
- Payloads completos logueados
- Tokens en logs de debug

**Solución:** Implementar sanitizador de logs.

---

### 4. **WebSocket sin Autenticación Estricta**
**Ubicación:** `chat.gateway.ts`

**Riesgo:** Conexiones persistentes pueden ser explotadas.

**Solución:**
- Validar token en cada mensaje
- Heartbeat con validación
- Límite de conexiones por usuario

---

### 5. **Headers de Seguridad Incompletos**
**Estado:** Parcialmente implementado con Helmet

**Faltante:**
- CSP report-uri para violaciones
- Feature-Policy / Permissions-Policy
- Cross-Origin-Resource-Policy

---

## 🛡️ Mejoras Propuestas

### A. Cifrado End-to-End (E2EE)

**Para:** Mensajes de chat altamente sensibles

**Opción 1: Client-Side Encryption**
```typescript
// Frontend cifra antes de enviar
const encryptedMessage = await encrypt(message, publicKey);
socket.emit('message', encryptedMessage);

// Backend solo almacena blob cifrado
// Solo el cliente puede descifrar
```

**Opción 2: Field-Level Encryption en DB**
```typescript
// En Prisma schema
model Message {
  id String @id
  contentEncrypted Bytes  // Cifrado con AES-256
  contentHash String      // Para búsqueda sin descifrar
}
```

**Complejidad:** Alta  
**Prioridad:** Baja (a menos que sea requisito regulatorio)

---

### B. Auditoría y Logging Seguro

**Implementar:**
```typescript
@Injectable()
export class AuditService {
  async log(action: string, userId: string, resource: string, success: boolean) {
    await this.prisma.auditLog.create({
      data: {
        action,
        userId,
        resource,
        ip: this.request.ip,
        userAgent: this.request.headers['user-agent'],
        timestamp: new Date(),
        success,
      },
    });
  }
}
```

**Eventos a auditar:**
- Login/Logout exitosos y fallidos
- Cambios de contraseña
- Acceso a datos sensibles
- Modificación de suscripciones
- Subida/eliminación de archivos

---

### C. Protección Adicional

#### 1. **API Key para Mobile**
```typescript
// Header requerido en apps móviles
X-API-Key: ${API_KEY}

// Validación
if (clientType === 'mobile' && apiKey !== expectedKey) {
  throw new UnauthorizedException();
}
```

#### 2. **Fingerprinting de Dispositivo**
```typescript
// Detectar uso de token desde dispositivo diferente
const fingerprint = createHash('sha256')
  .update(`${userAgent}${ip}${headers['accept-language']}`)
  .digest('hex');
```

#### 3. **Suspensión de Cuenta**
```typescript
// Bloquear después de N intentos fallidos
if (failedAttempts >= 5) {
  await this.suspendAccount(userId, '15m');
}
```

#### 4. **2FA (Two-Factor Authentication)**
- TOTP (Google Authenticator)
- SMS (costo alto)
- Email OTP

---

## 🌐 Configuración de Dominios

### Estructura Propuesta

```
Desarrollo Local (con túnel):
├── Frontend: https://testr3.r0lm0.dev
├── API:      https://apitest.r0lm0.dev
└── WebSocket: wss://apitest.r0lm0.dev

Producción:
├── Frontend: https://r3chat.r0lm0.dev
├── API:      https://api.r0lm0.dev
└── WebSocket: wss://api.r0lm0.dev
```

### CORS Configuración

```typescript
const allowedOrigins = [
  // Desarrollo
  'https://testr3.r0lm0.dev',
  'http://localhost:5173',
  
  // Producción
  'https://r3chat.r0lm0.dev',
  'https://www.r3chat.r0lm0.dev',
];
```

---

## 🔧 Implementación Inmediata

### Prioridad 1: IDOR Fix
- [ ] Agregar verificación de ownership en `/users/:id`
- [ ] Agregar verificación en `/chat/sessions/:id`

### Prioridad 2: Logging Seguro
- [ ] Sanitizar todos los logs
- [ ] Implementar AuditService

### Prioridad 3: WebSocket Hardening
- [ ] Validar token en cada mensaje
- [ ] Rate limiting por conexión

### Prioridad 4: Headers Adicionales
- [ ] Permissions-Policy
- [ ] CSP Report-Only

---

## 📊 Matriz de Riesgo

| Amenaza | Probabilidad | Impacto | Riesgo Total | Mitigación |
|---------|--------------|---------|--------------|------------|
| IDOR | Media | Alto | 🔴 Alto | Fix inmediato |
| OAuth token leak | Baja | Alto | 🟠 Medio | Cambiar a cookies en dev |
| Credential stuffing | Alta | Alto | 🔴 Crítico | Rate limiting ✅ |
| XSS | Baja | Medio | 🟡 Bajo | CSP ✅ Helmet ✅ |
| CSRF | Baja | Medio | 🟡 Bajo | SameSite cookies ✅ |
| Data breach | Baja | Crítico | 🟠 Medio | E2EE (opcional) |

---

## 📋 Checklist de Implementación

- [ ] Fix IDOR en endpoints de usuario
- [ ] Fix IDOR en endpoints de chat
- [ ] Sanitizar logs de AI services
- [ ] Implementar AuditService
- [ ] Configurar Cloudflare Tunnel para dev
- [ ] Actualizar CORS para nuevos dominios
- [ ] Agregar Permissions-Policy header
- [ ] WebSocket heartbeat + re-auth
- [ ] Documentar configuración dev vs prod
- [ ] Pruebas de seguridad (OWASP ZAP)

---

**Próximos pasos:**
1. Decidir si implementamos E2EE
2. Configurar túneles de Cloudflare
3. Implementar fixes de IDOR
4. Agregar headers adicionales
