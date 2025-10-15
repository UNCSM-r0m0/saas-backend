const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
    try {
        console.log('🔍 Verificando datos en la base de datos...\n');

        // Verificar usuario
        const user = await prisma.user.findUnique({
            where: { email: 'rolmo92@gmail.com' }
        });
        console.log('👤 Usuario:', user ? `${user.email} (ID: ${user.id})` : 'No encontrado');

        // Verificar chats
        const chats = await prisma.chat.findMany({
            where: { ownerId: user?.id },
            include: {
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        console.log(`💬 Chats encontrados: ${chats.length}`);

        if (chats.length > 0) {
            chats.forEach((chat, index) => {
                console.log(`  ${index + 1}. ${chat.title} (${chat.messages.length} mensajes)`);
            });
        }

        // Verificar todos los chats
        const allChats = await prisma.chat.findMany({
            include: {
                owner: {
                    select: { email: true }
                }
            }
        });
        console.log(`\n📊 Total de chats en la base de datos: ${allChats.length}`);

        if (allChats.length > 0) {
            allChats.forEach((chat, index) => {
                console.log(`  ${index + 1}. "${chat.title}" - Owner: ${chat.owner?.email || 'Anónimo'}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
