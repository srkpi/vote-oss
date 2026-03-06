import {
  generateKeyPairSync,
  createSign,
  createVerify,
  privateDecrypt,
  createHash,
  constants,
} from 'crypto';
import { randomBytes } from 'crypto';

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
