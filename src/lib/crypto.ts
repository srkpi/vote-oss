import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createSign,
  createVerify,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'crypto';

import type { Ballot } from '@/types/ballot';

// ---------------------------------------------------------------------------
// Election key pair
// ---------------------------------------------------------------------------

export function generateElectionKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

// ---------------------------------------------------------------------------
// Vote token
// ---------------------------------------------------------------------------

export function generateVoteToken(electionId: string): { token: string; randomSecret: string } {
  const randomSecret = randomBytes(32).toString('hex');
  const token = `${electionId}:${randomSecret}`;
  return { token, randomSecret };
}

export function signVoteToken(privateKeyPem: string, token: string): string {
  const signer = createSign('SHA256');
  signer.update(token);
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

export function verifyVoteTokenSignature(
  publicKeyPem: string,
  token: string,
  signature: string,
): boolean {
  try {
    const verifier = createVerify('SHA256');
    verifier.update(token);
    verifier.end();
    return verifier.verify(publicKeyPem, signature, 'base64');
  } catch {
    return false;
  }
}

export function computeNullifier(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Ballot encryption — hybrid AES-256-GCM + RSA-OAEP (server-side, Node.js)
// ---------------------------------------------------------------------------

/** Sentinel used to pad a choice array to maxChoices length. */
const BALLOT_PADDING = '00000000-0000-0000-0000-000000000000';
export const BALLOT_VERSION = 1;

interface BallotEnvelope {
  v: number;
  wrappedKey: string; // base64 – RSA-OAEP encrypted AES key
  iv: string; // base64 – 12-byte GCM IV
  tag: string; // base64 – 16-byte GCM authentication tag
  ciphertext: string; // base64 – AES-256-GCM encrypted payload
}

/**
 * Encrypt an array of choice IDs using hybrid AES-256-GCM + RSA-OAEP.
 *
 * The choice array is padded to `maxChoices` with empty-string sentinels so
 * every ballot has identical plaintext length, hiding how many options were
 * selected. The result is a base64-encoded JSON envelope.
 */
export function encryptBallot(
  publicKeyPem: string,
  choiceIds: string[],
  maxChoices: number,
): string {
  // Pad to maxChoices so all ciphertexts are the same size
  const padded = [...choiceIds];
  while (padded.length < maxChoices) padded.push(BALLOT_PADDING);

  // Generate fresh AES-256 key and 96-bit IV
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);

  // Encrypt plaintext with AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(padded), 'utf-8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 16 bytes

  // Wrap AES key with the election RSA public key
  const wrappedKey = publicEncrypt(
    { key: publicKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    aesKey,
  );

  const envelope: BallotEnvelope = {
    v: BALLOT_VERSION,
    wrappedKey: wrappedKey.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };

  return Buffer.from(JSON.stringify(envelope), 'utf-8').toString('base64');
}

/**
 * Decrypt a hybrid AES-256-GCM + RSA-OAEP ballot envelope.
 * Returns the array of real choice IDs (padding sentinels are stripped).
 */
export function decryptBallot(privateKeyPem: string, encryptedBallotBase64: string): string[] {
  let envelope: BallotEnvelope;
  try {
    const json = Buffer.from(encryptedBallotBase64, 'base64').toString('utf-8');
    envelope = JSON.parse(json) as BallotEnvelope;
  } catch {
    throw new Error('Failed to parse ballot envelope');
  }

  if (envelope.v !== BALLOT_VERSION) {
    throw new Error(`Unsupported ballot version: ${envelope.v}`);
  }

  const wrappedKey = Buffer.from(envelope.wrappedKey, 'base64');
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  // Unwrap AES key using the RSA private key
  const aesKey = privateDecrypt(
    { key: privateKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    wrappedKey,
  );

  // Decrypt — AES-GCM verifies the auth tag automatically and throws on tamper
  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  const parsed: unknown = JSON.parse(plaintext.toString('utf-8'));
  if (!Array.isArray(parsed)) throw new Error('Invalid ballot payload');

  // Strip padding sentinels; keep only real choice IDs
  return (parsed as string[]).filter((id) => id !== BALLOT_PADDING);
}

// ---------------------------------------------------------------------------
// Ballot chain signing + hashing
// ---------------------------------------------------------------------------

export function signBallotEntry(
  privateKeyPem: string,
  data: { electionId: string; encryptedBallot: string; previousHash: string | null },
): string {
  const payload = JSON.stringify(data);
  const signer = createSign('SHA256');
  signer.update(payload);
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

export function computeBallotHash(data: {
  electionId: string;
  encryptedBallot: string;
  signature: string;
  previousHash: string | null;
}): string {
  const raw = JSON.stringify(data);
  return createHash('sha256').update(raw).digest('hex');
}

// ---------------------------------------------------------------------------
// Invite token helpers
// ---------------------------------------------------------------------------

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateBase64Token(length: number): string {
  const bytes = Math.ceil((length * 3) / 4);
  const token = randomBytes(bytes).toString('base64');
  return token.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, length);
}

// ---------------------------------------------------------------------------
// Client-side (browser) WebCrypto helpers
// ---------------------------------------------------------------------------

export async function computeNullifierClient(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** ArrayBuffer or Uint8Array → base64 string (safe for large arrays). */
function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!);
  return btoa(binary);
}

/**
 * Encrypt choice IDs using hybrid AES-256-GCM + RSA-OAEP (browser WebCrypto).
 *
 * The array is padded to `maxChoices` with empty-string sentinels so every
 * ballot ciphertext is the same size. Returns a base64-encoded JSON envelope
 * identical in structure to the server-side `encryptBallot` output.
 */
export async function encryptBallotClient(
  publicKeyPem: string,
  choiceIds: string[],
  maxChoices: number,
): Promise<string> {
  const padded = [...choiceIds];
  while (padded.length < maxChoices) padded.push(BALLOT_PADDING);

  // Generate AES-256-GCM key (extractable so we can wrap it)
  const aesKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
  ]);

  // 96-bit IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt plaintext
  const encoded = new TextEncoder().encode(JSON.stringify(padded));
  const encryptedRaw = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);

  // WebCrypto appends the 16-byte auth tag at the end
  const encryptedArray = new Uint8Array(encryptedRaw);
  const ciphertext = encryptedArray.slice(0, -16);
  const tag = encryptedArray.slice(-16);

  // Import RSA public key for wrapping
  const pemContents = publicKeyPem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const rsaKey = await window.crypto.subtle.importKey(
    'spki',
    binaryDer.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['wrapKey'],
  );

  // Wrap AES key with RSA-OAEP
  const wrappedKey = await window.crypto.subtle.wrapKey('raw', aesKey, rsaKey, {
    name: 'RSA-OAEP',
  });

  const envelope = {
    v: BALLOT_VERSION,
    wrappedKey: bufToBase64(wrappedKey),
    iv: bufToBase64(iv),
    tag: bufToBase64(tag),
    ciphertext: bufToBase64(ciphertext),
  };

  return btoa(JSON.stringify(envelope));
}

/**
 * Import the election RSA private key for ballot decryption and AES key
 * unwrapping in the ballot transparency view.
 */
export async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  const pemContents = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binaryArray = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    'pkcs8',
    binaryArray.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt', 'unwrapKey'],
  );
}

/**
 * Decrypt a ballot envelope in the browser using the election RSA private key.
 * Returns the array of real choice IDs (padding stripped), or null on failure.
 */
export async function decryptBallotData(
  key: CryptoKey,
  encryptedBase64: string,
): Promise<string[] | null> {
  try {
    const envelopeJson = atob(encryptedBase64);
    const envelope = JSON.parse(envelopeJson) as {
      v: number;
      wrappedKey: string;
      iv: string;
      tag: string;
      ciphertext: string;
    };

    if (envelope.v !== BALLOT_VERSION) return null;

    const fromBase64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

    const wrappedKeyBytes = fromBase64(envelope.wrappedKey);
    const iv = fromBase64(envelope.iv);
    const tag = fromBase64(envelope.tag);
    const ciphertext = fromBase64(envelope.ciphertext);

    // Unwrap the AES key using the RSA private key
    const aesKey = await window.crypto.subtle.unwrapKey(
      'raw',
      wrappedKeyBytes.buffer as ArrayBuffer,
      key,
      { name: 'RSA-OAEP' },
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );

    // WebCrypto AES-GCM expects ciphertext + tag concatenated
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext, 0);
    combined.set(tag, ciphertext.length);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      aesKey,
      combined.buffer as ArrayBuffer,
    );

    const text = new TextDecoder().decode(decrypted);
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return null;

    // Strip padding sentinels
    return (parsed as string[]).filter((id: string) => id !== BALLOT_PADDING);
  } catch {
    return null;
  }
}

export async function verifyBallotHash(ballot: Ballot, electionId: string): Promise<boolean> {
  try {
    const raw = JSON.stringify({
      electionId,
      encryptedBallot: ballot.encryptedBallot,
      signature: ballot.signature,
      previousHash: ballot.previousHash,
    });
    const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const computed = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return computed === ballot.currentHash;
  } catch {
    return false;
  }
}
