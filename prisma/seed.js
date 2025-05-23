const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  try {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const editorPassword = await bcrypt.hash('editor456', 10);

    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        username: 'admin',
        password: adminPassword,
        role: 'ADMIN',
      },
    });

    const editorUser = await prisma.user.upsert({
      where: { email: 'editor@example.com' },
      update: {},
      create: {
        email: 'editor@example.com',
        username: 'editor',
        password: editorPassword,
        role: 'EDITOR',
      },
    });

    console.log({ adminUser, editorUser });
  } catch (error) {
    console.error('Erro ao adicionar usuários:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();