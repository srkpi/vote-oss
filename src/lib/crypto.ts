import {
  constants,
  createHash,
  createSign,
  createVerify,
  generateKeyPairSync,
  privateDecrypt,
  randomBytes,
} from 'crypto';

import type { Ballot } from '@/types/ballot';

export function generateElectionKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

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

/** Decrypt an RSA-OAEP ballot. Returns an array of choice IDs. */
export function decryptBallot(privateKeyPem: string, encryptedBallotBase64: string): string[] {
  const buffer = Buffer.from(encryptedBallotBase64, 'base64');
  const decrypted = privateDecrypt(
    { key: privateKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    buffer,
  );
  const text = decrypted.toString('utf-8');
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as string[];
    // Backward compat: single string
    return [text];
  } catch {
    return [text];
  }
}

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

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateBase64Token(length: number): string {
  const bytes = Math.ceil((length * 3) / 4);
  const token = randomBytes(bytes).toString('base64');
  return token.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, length);
}

// ── Client-side (browser) crypto ─────────────────────────────────────────────

export async function computeNullifierClient(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Encrypt an array of choice IDs with the election RSA public key. */
export async function encryptChoiceClient(
  publicKeyPem: string,
  choiceIds: string[],
): Promise<string> {
  const pemContents = publicKeyPem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');

  const binaryDer = atob(pemContents);
  const binaryArray = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) binaryArray[i] = binaryDer.charCodeAt(i);

  const key = await window.crypto.subtle.importKey(
    'spki',
    binaryArray.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );

  const encoded = new TextEncoder().encode(JSON.stringify(choiceIds));
  const encrypted = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

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
    ['decrypt'],
  );
}

/** Returns array of decrypted choice IDs, or null on failure. */
export async function decryptBallotData(
  key: CryptoKey,
  encryptedBase64: string,
): Promise<string[] | null> {
  try {
    const buf = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
    const dec = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, buf);
    const text = new TextDecoder().decode(dec);
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as string[];
    return [text]; // backward compat
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
