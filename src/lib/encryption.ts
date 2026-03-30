/**
 * Application-Level Encryption (ALE) for sensitive database fields.
 *
 * Algorithm: AES-256-GCM
 *   - 256-bit key (32 bytes) sourced from DATABASE_ENCRYPTION_KEY env var (64 hex chars)
 *   - 96-bit (12-byte) random IV per encryption — GCM's recommended nonce size
 *   - 128-bit (16-byte) authentication tag to detect ciphertext tampering
 *
 * Storage format (stored as a single string in the DB column):
 *   <iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * Generate a key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Set DATABASE_ENCRYPTION_KEY=<64-char hex> in your .env file.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

import { DATABASE_ENCRYPTION_KEY } from '@/lib/config/server';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce
const KEY_HEX_LENGTH = 64; // 32 bytes × 2 hex chars = 64

if (DATABASE_ENCRYPTION_KEY.length !== KEY_HEX_LENGTH) {
  throw new Error(
    `DATABASE_ENCRYPTION_KEY must be a ${KEY_HEX_LENGTH}-character hex string (${KEY_HEX_LENGTH / 2} bytes). ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
  );
}

const KEY = Buffer.from(DATABASE_ENCRYPTION_KEY, 'hex');

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Returns a colon-delimited string ready for database storage:
 *   `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // always 16 bytes for GCM

  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
}

/**
 * Decrypt a field previously encrypted with {@link encryptField}.
 *
 * Throws if:
 *  - The stored value is not in the expected `iv:authTag:ciphertext` format
 *  - The authentication tag does not match (ciphertext was tampered with)
 *  - The wrong key is used
 */
export function decryptField(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted field format — expected "iv:authTag:ciphertext" (hex, colon-delimited)',
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
