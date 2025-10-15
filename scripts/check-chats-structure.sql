-- Verificar estructura de la tabla chats
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'chats' 
ORDER BY ordinal_position;
