import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { DATABASE_URL, NODE_ENV } from '@/lib/config/server';

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
    log: NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
