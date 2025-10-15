-- Verificar chats en la base de datos
SELECT 
    c.id,
    c.title,
    c."ownerId",
    c."isAnonymous",
    c."createdAt",
    c."updatedAt",
    u.email as owner_email
FROM "Chat" c
LEFT JOIN "User" u ON c."ownerId" = u.id
ORDER BY c."createdAt" DESC;

-- Contar total de chats
SELECT COUNT(*) as total_chats FROM "Chat";

-- Verificar usuario actual
SELECT id, email, role FROM "User" WHERE email = 'rolmo92@gmail.com';
