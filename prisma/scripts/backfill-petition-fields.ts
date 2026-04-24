/**
 * Backfill encrypted full-name fields for existing elections after the
 * petitions migration.  Run once, after `prisma migrate deploy`.
 *
 *   npx tsx prisma/scripts/backfill-petition-fields.ts
 *
 * The migration SQL seeds `created_by_full_name` / `approved_by_full_name`
 * with plaintext admin names.  This script walks every election and
 * re-writes those columns with the AES-256-GCM ciphertext expected by
 * decryptField (same format used for private keys).
 */

import 'dotenv/config';

import { encryptField } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';

function looksEncrypted(value: string | null): boolean {
  // encryptField output is <ivHex>:<authTagHex>:<cipherHex>
  if (!value) return false;
  const parts = value.split(':');
  return (
    parts.length === 3 &&
    parts.every((p) => /^[0-9a-f]+$/i.test(p)) &&
    parts[0].length === 24 && // 12-byte IV
    parts[1].length === 32 // 16-byte tag
  );
}

async function main() {
  const elections = await prisma.election.findMany({
    select: {
      id: true,
      created_by_full_name: true,
      approved_by_full_name: true,
    },
  });

  let encryptedCreated = 0;
  let encryptedApproved = 0;
  let skipped = 0;

  for (const e of elections) {
    const updates: {
      created_by_full_name?: string;
      approved_by_full_name?: string;
    } = {};

    if (e.created_by_full_name && !looksEncrypted(e.created_by_full_name)) {
      updates.created_by_full_name = encryptField(e.created_by_full_name);
      encryptedCreated++;
    }
    if (e.approved_by_full_name && !looksEncrypted(e.approved_by_full_name)) {
      updates.approved_by_full_name = encryptField(e.approved_by_full_name);
      encryptedApproved++;
    }

    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }

    await prisma.election.update({ where: { id: e.id }, data: updates });
  }

  console.log(
    `[backfill] total=${elections.length} encrypted_created=${encryptedCreated} encrypted_approved=${encryptedApproved} skipped=${skipped}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
