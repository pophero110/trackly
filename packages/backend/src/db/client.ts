import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client singleton
 * Prevents multiple instances in development with hot reloading
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown - disconnect Prisma client
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}
