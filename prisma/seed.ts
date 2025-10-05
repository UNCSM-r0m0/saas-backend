import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Crear usuario admin
    const adminEmail = process.env.ADMIN_EMAIL || 'rolmo33@saas.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Jenny23.!';

    const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail },
    });

    if (existingAdmin) {
        console.log(`✅ Admin user already exists: ${adminEmail}`);
    } else {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const admin = await prisma.user.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                firstName: 'Admin',
                lastName: 'User',
                role: 'SUPER_ADMIN',
                provider: 'LOCAL',
                isActive: true,
                emailVerified: true,
            },
        });

        console.log(`✅ Admin user created: ${admin.email}`);
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
    }

    console.log('✨ Seeding completed!');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

