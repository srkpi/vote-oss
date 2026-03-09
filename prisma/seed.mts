import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  console.log('🌱  Seeding admins...');

  // -------------------------------------------------------------------------
  // Super-admin — unrestricted, can manage other admins
  // -------------------------------------------------------------------------
  const superAdmin = await prisma.admin.upsert({
    where: { user_id: 'superadmin-001' },
    update: {},
    create: {
      user_id: 'superadmin-001',
      full_name: 'Super Admin User',
      group: 'KV-11',
      faculty: 'FICE',
      promoted_by: null,
      manage_admins: true,
      restricted_to_faculty: false,
    },
  });
  console.log(`  ✓ superadmin: ${superAdmin.user_id} (${superAdmin.full_name})`);

  // -------------------------------------------------------------------------
  // Faculty-scoped admin — can only manage elections for FICE faculty,
  // promoted by the super-admin above
  // -------------------------------------------------------------------------
  const facultyAdmin = await prisma.admin.upsert({
    where: { user_id: 'admin-002' },
    update: {},
    create: {
      user_id: 'admin-002',
      full_name: 'Faculty Admin FICE',
      group: 'KV-12',
      faculty: 'FICE',
      promoted_by: 'superadmin-001',
      manage_admins: false,
      restricted_to_faculty: true,
    },
  });
  console.log(`  ✓ faculty admin: ${facultyAdmin.user_id} (${facultyAdmin.full_name})`);

  console.log('✅  Seed complete.');
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
