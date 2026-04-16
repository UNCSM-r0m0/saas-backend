# Diagrama de Clases

## Descripción
El diagrama de clases modela las entidades principales del dominio de la **SaaS Platform**, extraídas directamente del esquema de Prisma. Se representan los atributos clave, los enums del sistema y las relaciones entre entidades (asociación, agregación y composición). Las entidades se organizan en cuatro schemas lógicos de PostgreSQL: `users`, `chat`, `billing` y `usage`.

```mermaid
classDiagram
    direction TB

    class User {
        +String id
        +String email
        +String? password
        +String? firstName
        +String? lastName
        +String? avatar
        +UserRole role
        +AuthProvider provider
        +String? providerId
        +Boolean isActive
        +Boolean emailVerified
        +String? tenantId
        +DateTime createdAt
        +DateTime updatedAt
        +DateTime? lastLoginAt
    }

    class RefreshToken {
        +String id
        +String userId
        +String tokenHash
        +DateTime expiresAt
        +DateTime? revokedAt
        +DateTime createdAt
    }

    class Tenant {
        +String id
        +String name
        +String slug
        +Boolean isActive
        +DateTime createdAt
        +DateTime updatedAt
    }

    class Subscription {
        +String id
        +String userId
        +SubscriptionTier tier
        +SubscriptionStatus status
        +String? stripeCustomerId
        +String? stripeSubscriptionId
        +String? stripePriceId
        +DateTime? stripeCurrentPeriodEnd
        +DateTime createdAt
        +DateTime updatedAt
    }

    class Chat {
        +String id
        +String title
        +Boolean isAnonymous
        +String? ownerId
        +DateTime createdAt
        +DateTime updatedAt
    }

    class Message {
        +String id
        +String chatId
        +String? userId
        +MessageRole role
        +String content
        +String model
        +Int tokensUsed
        +MessageStatus status
        +String? streamId
        +Json? meta
        +String[] attachments
        +DateTime createdAt
    }

    class UsageRecord {
        +String id
        +String? userId
        +DateTime date
        +Int messageCount
        +Int tokensUsed
        +String? anonymousId
        +DateTime createdAt
        +DateTime updatedAt
    }

    class UsageConsumedEvent {
        +String id
        +String eventId
        +String eventType
        +DateTime createdAt
    }

    class BillingUsageEvent {
        +String id
        +String eventId
        +String source
        +String eventType
        +String? userId
        +String? anonymousId
        +String? conversationId
        +String? messageId
        +String? model
        +Int tokensUsed
        +DateTime occurredAt
        +DateTime createdAt
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

    User "1" --> "*" RefreshToken : tiene
    User "1" --> "0..1" Subscription : posee
    User "*" --> "0..1" Tenant : pertenece
    User "1" --> "*" Chat : propietario
    User "1" --> "*" Message : envía
    Chat "1" --> "*" Message : contiene
    User "1" --> "*" UsageRecord : genera

    User --> UserRole : usa
    User --> AuthProvider : usa
    Subscription --> SubscriptionTier : usa
    Subscription --> SubscriptionStatus : usa
    Message --> MessageRole : usa
    Message --> MessageStatus : usa
```

## Notas técnicas
- **Composición:** `RefreshToken` y `Subscription` dependen de la existencia de un `User`; si el usuario se elimina, estos registros se eliminan en cascada (`onDelete: Cascade`).
- **Agregación:** `Message` pertenece a un `Chat`; la eliminación del chat borra todos sus mensajes en cascada.
- **Asociación opcional:** un `Chat` puede ser anónimo (`ownerId` nullable), permitiendo interacciones sin autenticación previa.
- **Idempotencia:** `UsageConsumedEvent` evita el doble conteo de eventos de uso consumidos por el microservicio `usage`.
