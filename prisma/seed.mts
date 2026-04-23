import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function generateBase64Token(length: number): string {
  const bytes = Math.ceil((length * 3) / 4);
  const token = randomBytes(bytes).toString('base64');
  return token.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, length);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log('🧪  Generating test admin and invite token...');

  // 1. Create the Creator Admin
  // This admin is needed because the InviteToken has a required 'created_by' relation
  const testAdmin = await prisma.admin.upsert({
    where: { user_id: 'test-admin-id' },
    update: {},
    create: {
      user_id: 'test-admin-id',
      full_name: 'Test Admin',
      group: 'DEBUG',
      faculty: 'SYSTEM',
      manage_admins: true,
      manage_groups: true,
      manage_petitions: true,
      restricted_to_faculty: false,
    },
  });

  // 2. Generate a random secure token
  const rawToken = generateBase64Token(16);
  const tokenHash = hashToken(rawToken);

  // 3. Create the Invite Token in the database
  await prisma.adminInviteToken.create({
    data: {
      token_hash: tokenHash,
      max_usage: 1,
      current_usage: 0,
      manage_admins: true,
      manage_groups: true,
      manage_petitions: true,
      restricted_to_faculty: false,
      valid_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Valid for 7 days
      created_by: testAdmin.user_id,
    },
  });

  console.log(`Token: ${rawToken}`);
  console.log(`Join URL: http://localhost:3000/join/${rawToken}`);
}

main()
  .catch((err) => {
    console.error('❌  Script failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
