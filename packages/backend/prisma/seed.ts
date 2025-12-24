import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user
  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
    },
  });

  console.log('✅ Created test user:', user.email);

  // Create sample entity
  const habitEntity = await prisma.entity.create({
    data: {
      name: 'Morning Exercise',
      type: 'Habit',
      categories: ['Health', 'Fitness'],
      valueType: 'checkbox',
      userId: user.id,
    },
  });

  console.log('✅ Created sample entity:', habitEntity.name);

  // Create sample entry
  await prisma.entry.create({
    data: {
      entityId: habitEntity.id,
      entityName: habitEntity.name,
      timestamp: new Date(),
      value: 'true',
      notes: 'Morning workout completed!',
      userId: user.id,
    },
  });

  console.log('✅ Created sample entry');
  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
