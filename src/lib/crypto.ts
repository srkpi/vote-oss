import {
  generateKeyPairSync,
  createSign,
  createVerify,
  privateDecrypt,
  createHash,
  constants,
} from 'crypto';
import { randomBytes } from 'crypto';
import type { Ballot } from '@/types/ballot';

export function generateElectionKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

export function generateVoteToken(electionId: number): { token: string; randomSecret: string } {
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

export function decryptBallot(privateKeyPem: string, encryptedBallotBase64: string): string {
  const buffer = Buffer.from(encryptedBallotBase64, 'base64');
  const decrypted = privateDecrypt(
    { key: privateKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    buffer,
  );
  return decrypted.toString('utf-8');
}

export function signBallotEntry(
  privateKeyPem: string,
  data: { electionId: number; encryptedBallot: string; previousHash: string | null },
): string {
  const payload = JSON.stringify(data);
  const signer = createSign('SHA256');
  signer.update(payload);
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

export function computeBallotHash(data: {
  electionId: number;
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

export function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
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

export async function decryptBallotData(
  key: CryptoKey,
  encryptedBase64: string,
): Promise<string | null> {
  try {
    const buf = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
    const dec = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, buf);
    return new TextDecoder().decode(dec);
  } catch {
    return null;
  }
}

export async function verifyBallotHash(ballot: Ballot, electionId: number): Promise<boolean> {
  try {
    const raw = JSON.stringify({
      electionId,
      encryptedBallot: ballot.encrypted_ballot,
      signature: ballot.signature,
      previousHash: ballot.previous_hash,
    });
    const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const computed = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return computed === ballot.current_hash;
  } catch {
    return false;
  }
}
