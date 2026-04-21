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

import {
  BALLOT_PADDING,
  BALLOT_VERSION_ANONYMOUS,
  BALLOT_VERSION_IDENTIFIED,
} from '@/lib/constants';
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
/**
 * v1 – anonymous: plaintext is a JSON array of (padded) choice IDs.
 * v2 – identified: plaintext is a JSON object with choices + voter identity.
 */
interface BallotEnvelope {
  v: number;
  wrappedKey: string; // base64 – RSA-OAEP encrypted AES key
  iv: string; // base64 – 12-byte GCM IV
  tag: string; // base64 – 16-byte GCM authentication tag
  ciphertext: string; // base64 – AES-256-GCM encrypted payload
}

/** Voter identity embedded in v2 (identified) ballot payloads. */
export interface BallotVoterIdentity {
  userId: string;
  fullName: string;
}

/** v2 identified ballot payload. */
interface IdentifiedBallotPayload {
  choices: string[]; // padded with BALLOT_PADDING sentinels
  voterId: string;
  voterName: string;
}

/** Return value of decryptBallot — carries choices and optional voter identity. */
export interface BallotDecryptResult {
  choiceIds: string[];
  voter?: BallotVoterIdentity;
}

/**
 * Encrypt an array of choice IDs using hybrid AES-256-GCM + RSA-OAEP.
 *
 * When `voter` is provided the ballot is encoded as v2 (identified) and the
 * voter's identity is cryptographically bound to the ciphertext so it can
 * only be revealed after the election closes (when the private key is
 * published).
 *
 * The choice array is always padded to `maxChoices` with sentinels so every
 * ballot has identical plaintext length, hiding the selection count.
 */
export function encryptBallot(
  publicKeyPem: string,
  choiceIds: string[],
  maxChoices: number,
  voter?: BallotVoterIdentity,
): string {
  // Pad to maxChoices so all ciphertexts are the same size
  const padded = [...choiceIds];
  while (padded.length < maxChoices) padded.push(BALLOT_PADDING);

  // Build plaintext based on ballot version
  const version = voter ? BALLOT_VERSION_IDENTIFIED : BALLOT_VERSION_ANONYMOUS;
  const plaintext = voter
    ? JSON.stringify({
        choices: padded,
        voterId: voter.userId,
        voterName: voter.fullName,
      } satisfies IdentifiedBallotPayload)
    : JSON.stringify(padded);

  // Generate fresh AES-256 key and 96-bit IV
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);

  // Encrypt plaintext with AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf-8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 16 bytes

  // Wrap AES key with the election RSA public key
  const wrappedKey = publicEncrypt(
    { key: publicKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    aesKey,
  );

  const envelope: BallotEnvelope = {
    v: version,
    wrappedKey: wrappedKey.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };

  return Buffer.from(JSON.stringify(envelope), 'utf-8').toString('base64');
}

/**
 * Decrypt a hybrid AES-256-GCM + RSA-OAEP ballot envelope.
 *
 * Returns the real choice IDs (padding sentinels stripped) and — for v2
 * identified ballots — the embedded voter identity.
 *
 * Backward-compatible: v1 anonymous ballots produce a result with no `voter`.
 */
export function decryptBallot(
  privateKeyPem: string,
  encryptedBallotBase64: string,
): BallotDecryptResult {
  let envelope: BallotEnvelope;
  try {
    const json = Buffer.from(encryptedBallotBase64, 'base64').toString('utf-8');
    envelope = JSON.parse(json) as BallotEnvelope;
  } catch {
    throw new Error('Failed to parse ballot envelope');
  }

  if (envelope.v !== BALLOT_VERSION_ANONYMOUS && envelope.v !== BALLOT_VERSION_IDENTIFIED) {
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
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf-8',
  );

  if (envelope.v === BALLOT_VERSION_ANONYMOUS) {
    // v1 anonymous: plaintext is a JSON array of choice IDs
    const parsed: unknown = JSON.parse(plaintext);
    if (!Array.isArray(parsed)) throw new Error('Invalid v1 ballot payload');
    return {
      choiceIds: (parsed as string[]).filter((id) => id !== BALLOT_PADDING),
    };
  }

  // v2 identified: plaintext is a JSON object with choices + voter identity
  const parsed: unknown = JSON.parse(plaintext);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid v2 ballot payload');
  }
  const payload = parsed as IdentifiedBallotPayload;
  if (
    !Array.isArray(payload.choices) ||
    typeof payload.voterId !== 'string' ||
    typeof payload.voterName !== 'string'
  ) {
    throw new Error('Malformed v2 ballot payload fields');
  }
  return {
    choiceIds: payload.choices.filter((id) => id !== BALLOT_PADDING),
    voter: { userId: payload.voterId, fullName: payload.voterName },
  };
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
 * When `voter` is provided the envelope is encoded as v2 (identified) and the
 * voter identity is bound to the ciphertext — mirroring the server-side
 * `encryptBallot` function exactly.
 */
export async function encryptBallotClient(
  publicKeyPem: string,
  choiceIds: string[],
  maxChoices: number,
  voter?: BallotVoterIdentity,
): Promise<string> {
  const padded = [...choiceIds];
  while (padded.length < maxChoices) padded.push(BALLOT_PADDING);

  // Build plaintext matching the server-side format
  const version = voter ? BALLOT_VERSION_IDENTIFIED : BALLOT_VERSION_ANONYMOUS;
  const plaintextStr = voter
    ? JSON.stringify({
        choices: padded,
        voterId: voter.userId,
        voterName: voter.fullName,
      } satisfies IdentifiedBallotPayload)
    : JSON.stringify(padded);

  // Generate AES-256-GCM key (extractable so we can wrap it)
  const aesKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
  ]);

  // 96-bit IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt plaintext
  const encoded = new TextEncoder().encode(plaintextStr);
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
    v: version,
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

/** Result of decrypting a single ballot on the client. */
export interface DecryptedBallotData {
  choiceIds: string[];
  voter?: BallotVoterIdentity;
}

/**
 * Decrypt a ballot envelope in the browser using the election RSA private key.
 *
 * Returns the decrypted choice IDs (padding stripped) and — for v2 identified
 * ballots — the embedded voter identity.  Returns `null` on any error.
 *
 * Backward-compatible: v1 anonymous ballots produce a result with no `voter`.
 */
export async function decryptBallotData(
  key: CryptoKey,
  encryptedBase64: string,
): Promise<DecryptedBallotData | null> {
  try {
    const envelopeJson = atob(encryptedBase64);
    const envelope = JSON.parse(envelopeJson) as {
      v: number;
      wrappedKey: string;
      iv: string;
      tag: string;
      ciphertext: string;
    };

    if (envelope.v !== BALLOT_VERSION_ANONYMOUS && envelope.v !== BALLOT_VERSION_IDENTIFIED) {
      return null;
    }

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

    if (envelope.v === BALLOT_VERSION_ANONYMOUS) {
      // v1 anonymous: JSON array of choice IDs
      if (!Array.isArray(parsed)) return null;
      return {
        choiceIds: (parsed as string[]).filter((id: string) => id !== BALLOT_PADDING),
      };
    }

    // v2 identified: JSON object with choices + voter identity
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const payload = parsed as IdentifiedBallotPayload;
    if (
      !Array.isArray(payload.choices) ||
      typeof payload.voterId !== 'string' ||
      typeof payload.voterName !== 'string'
    ) {
      return null;
    }
    return {
      choiceIds: payload.choices.filter((id: string) => id !== BALLOT_PADDING),
      voter: { userId: payload.voterId, fullName: payload.voterName },
    };
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
