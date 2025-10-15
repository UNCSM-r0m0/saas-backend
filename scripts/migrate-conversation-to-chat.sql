-- Migración: Conversation → Chat
-- Este script mueve los datos de Conversation a Chat y actualiza las referencias

-- Paso 1: Migrar conversaciones existentes a Chat
INSERT INTO chats (id, title, "isAnonymous", "ownerId", "createdAt", "updatedAt")
SELECT 
    id,
    title,
    false as "isAnonymous",  -- Ya no son anónimas
    "userId" as "ownerId",
    "createdAt",
    "updatedAt"
FROM conversations
ON CONFLICT (id) DO NOTHING; -- Evitar duplicados si ya existen

-- Paso 2: Actualizar mensajes para usar chatId en lugar de conversationId
UPDATE messages 
SET "chatId" = "conversationId" 
WHERE "conversationId" IS NOT NULL 
AND "chatId" IS NULL;

-- Paso 3: Verificar que la migración fue exitosa
SELECT 
    'Conversations migrated' as status,
    COUNT(*) as count
FROM conversations;

SELECT 
    'Chats after migration' as status,
    COUNT(*) as count
FROM chats;

SELECT 
    'Messages with chatId' as status,
    COUNT(*) as count
FROM messages 
WHERE "chatId" IS NOT NULL;
