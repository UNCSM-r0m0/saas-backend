# Diagrama de Clases

## Descripción

El siguiente diagrama combina las **entidades persistentes reales** del esquema Prisma con las **clases de aplicación** que orquestan los casos de uso principales del backend. De esta forma se cubren los tres elementos que pide la entrega: **atributos**, **métodos** y **relaciones**. Las entidades reflejan el dominio almacenado en PostgreSQL; las clases de servicio representan la lógica presente en el gateway HTTP/WS y en los microservicios.

```mermaid
classDiagram
    direction TB

    class User {
        +id: String
        +email: String
        +password: String?
        +firstName: String?
        +lastName: String?
        +role: UserRole
        +provider: AuthProvider
        +isActive: Boolean
        +emailVerified: Boolean
        +tenantId: String?
        +createdAt: DateTime
        +updatedAt: DateTime
    }

    class RefreshToken {
        +id: String
        +userId: String
        +tokenHash: String
        +expiresAt: DateTime
        +revokedAt: DateTime?
        +createdAt: DateTime
    }

    class Tenant {
        +id: String
        +name: String
        +slug: String
        +isActive: Boolean
        +createdAt: DateTime
        +updatedAt: DateTime
    }

    class Subscription {
        +id: String
        +userId: String
        +tier: SubscriptionTier
        +status: SubscriptionStatus
        +stripeCustomerId: String?
        +stripeSubscriptionId: String?
        +stripePriceId: String?
        +stripeCurrentPeriodEnd: DateTime?
        +createdAt: DateTime
        +updatedAt: DateTime
    }

    class Chat {
        +id: String
        +title: String
        +isAnonymous: Boolean
        +ownerId: String?
        +createdAt: DateTime
        +updatedAt: DateTime
    }

    class Message {
        +id: String
        +chatId: String
        +userId: String?
        +role: MessageRole
        +content: String
        +model: String
        +tokensUsed: Int
        +status: MessageStatus
        +streamId: String?
        +attachments: String[]
        +createdAt: DateTime
    }

    class UsageRecord {
        +id: String
        +userId: String?
        +anonymousId: String?
        +date: DateTime
        +messageCount: Int
        +tokensUsed: Int
        +createdAt: DateTime
        +updatedAt: DateTime
    }

    class UsageConsumedEvent {
        +id: String
        +eventId: String
        +eventType: String
        +createdAt: DateTime
    }

    class BillingUsageEvent {
        +id: String
        +eventId: String
        +source: String
        +eventType: String
        +userId: String?
        +anonymousId: String?
        +conversationId: String?
        +messageId: String?
        +model: String?
        +tokensUsed: Int
        +occurredAt: DateTime
        +createdAt: DateTime
    }

    class AuthService {
        +validateUser(email, password)
        +login(user)
        +register(registerDto)
        +validateOAuthUser(profile)
        +refresh(refreshToken)
        +revoke(refreshToken)
    }

    class ChatGateway {
        +handleConnection(client)
        +handleSendMessage(data, client)
        +handleStopGeneration(data, client)
        +handleJoinChat(data, client)
        +handleNewChat(client, data)
        +handleListChats(client)
    }

    class ChatClient {
        +sendMessage(dto, userId, streamId, messageId, correlationId)
        +createChat(userId, title)
        +listChats(userId)
        +getChat(chatId, userId)
        +getChatHistory(chatId)
        +getUsageStats(userId)
    }

    class ChatNatsController {
        +sendMessage(payload)
        +createChat(payload)
        +listChats(payload)
        +deleteChat(payload)
        +getChat(payload)
        +getUsageStats(payload)
    }

    class ChatDomainService {
        +sendMessage(dto, userId)
        +sendMessageStreaming(dto, userId, onChunk)
        +createChat(ownerId, title)
        +listChats(ownerId)
        +renameChat(chatId, title, userId)
        +deleteChat(chatId, userId)
        +getChat(chatId, userId)
        +getChatHistory(chatId)
        +getUserUsageStats(userId)
        +updateFirstMessageAndTitle(chatId, userId, newContent)
    }

    class SubscriptionsService {
        +getOrCreateSubscription(userId)
        +getUserLimits(tier)
        +updateSubscriptionTier(userId, tier)
        +cancelSubscription(userId)
        +isSubscriptionActive(userId)
        +handleStripeWebhook(event)
    }

    class UsageService {
        +canSendMessage(userId, anonymousId)
        +incrementMessageCount(tokensUsed, userId, anonymousId)
        +getUserStats(userId)
        +cleanupOldRecords()
    }

    class StripeService {
        +createCheckoutSession(userId, priceId)
        +confirmCheckoutSession(sessionId, requestUserId)
        +createBillingPortalSession(userId)
        +handleWebhook(event)
        +getUserSubscription(userId)
    }

    class PrismaService {
        +user
        +chat
        +message
        +subscription
        +usageRecord
        +usageConsumedEvent
        +billingUsageEvent
    }

    class UserRole {
        <<enumeration>>
        SUPER_ADMIN
        ADMIN
        USER
    }

    class AuthProvider {
        <<enumeration>>
        LOCAL
        GOOGLE
        GITHUB
    }

    class SubscriptionTier {
        <<enumeration>>
        FREE
        REGISTERED
        PREMIUM
    }

    class SubscriptionStatus {
        <<enumeration>>
        ACTIVE
        CANCELED
        EXPIRED
        TRIALING
    }

    class MessageRole {
        <<enumeration>>
        USER
        ASSISTANT
        SYSTEM
    }

    class MessageStatus {
        <<enumeration>>
        DRAFT
        STREAMING
        DONE
        ERROR
    }

    User "1" *-- "0..*" RefreshToken : composición
    User "1" *-- "0..1" Subscription : composición
    Tenant "1" o-- "0..*" User : agregación
    User "1" o-- "0..*" Chat : propietario
    Chat "1" *-- "0..*" Message : composición
    User "1" o-- "0..*" Message : autor
    User "1" *-- "0..*" UsageRecord : uso diario

    User --> UserRole : usa
    User --> AuthProvider : usa
    Subscription --> SubscriptionTier : usa
    Subscription --> SubscriptionStatus : usa
    Message --> MessageRole : usa
    Message --> MessageStatus : usa

    ChatGateway ..> ChatClient : delega por NATS
    ChatClient ..> ChatNatsController : invoca patrones chat.*
    ChatNatsController ..> ChatDomainService : coordina caso de uso
    ChatDomainService ..> SubscriptionsService : consulta plan
    ChatDomainService ..> UsageService : valida cuota
    ChatDomainService ..> PrismaService : persiste chats y mensajes
    SubscriptionsService ..> PrismaService : persiste suscripciones
    UsageService ..> PrismaService : persiste métricas
    StripeService ..> PrismaService : actualiza suscripciones
    StripeService ..> Subscription : sincroniza estado
    AuthService ..> User : autentica usuario
```

## Notas técnicas

- Las clases `User`, `RefreshToken`, `Tenant`, `Subscription`, `Chat`, `Message`, `UsageRecord`, `UsageConsumedEvent` y `BillingUsageEvent` provienen directamente de `prisma/schema.prisma`.
- Las composiciones reflejan el comportamiento del esquema real: por ejemplo, `RefreshToken` y `Subscription` dependen del ciclo de vida de `User`, y `Message` depende de `Chat`.
- `UsageConsumedEvent` registra **idempotencia** para evitar doble conteo cuando el microservicio `usage` consume `chat.events.usage.incremented`.
- `BillingUsageEvent` conserva **auditoría** tanto del evento `chat.events.message.created` como de `chat.events.usage.incremented` en el microservicio `billing`.
- La relación con `Tenant` se conserva porque existe en el dominio persistente, aunque el flujo público de administración de tenants no se modela como caso de uso principal en esta entrega.
