import { randomUUID } from 'crypto';

import * as allure from 'allure-js-commons';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

import { MOCK_ELECTION_ID } from '@/__tests__/helpers/fixtures';
import { BALLOT_VERSION_ANONYMOUS, INVITE_TOKEN_LENGTH } from '@/lib/constants';
import {
  computeBallotHash,
  computeNullifier,
  decryptBallot,
  encryptBallot,
  generateBase64Token,
  generateElectionKeyPair,
  generateVoteToken,
  hashToken,
  signBallotEntry,
  signVoteToken,
  verifyVoteTokenSignature,
} from '@/lib/crypto';

describe('Election cryptography', () => {
  describe('Generating election keys', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Key Generation');
    });

    it('should return PEM-encoded public and private keys when generating election keys', () => {
      allure.description('Both keys must be present and PEM-formatted.');
      const { publicKey, privateKey } = generateElectionKeyPair();
      expect(publicKey).toMatch(/-----BEGIN PUBLIC KEY-----/);
      expect(privateKey).toMatch(/-----BEGIN PRIVATE KEY-----/);
    });

    it('should generate a unique key pair on every call when generating election keys', () => {
      allure.description('Each invocation should yield different keys.');
      const first = generateElectionKeyPair();
      const second = generateElectionKeyPair();
      expect(first.publicKey).not.toBe(second.publicKey);
      expect(first.privateKey).not.toBe(second.privateKey);
    });
  });

  describe('Issuing a voting token', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Vote Token');
    });

    it('should embed election id as the first segment when issuing a voting token', () => {
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      expect(token.startsWith(`${MOCK_ELECTION_ID}:`)).toBe(true);
    });

    it('should include a 64-char hex random secret when issuing a voting token', () => {
      const { token, randomSecret } = generateVoteToken(MOCK_ELECTION_ID);
      expect(randomSecret).toMatch(/^[a-f0-9]{64}$/);
      expect(token).toBe(`${MOCK_ELECTION_ID}:${randomSecret}`);
    });

    it('should produce different secrets for each call when issuing a voting token', () => {
      const a = generateVoteToken(MOCK_ELECTION_ID);
      const b = generateVoteToken(MOCK_ELECTION_ID);
      expect(a.randomSecret).not.toBe(b.randomSecret);
    });
  });

  describe('Verifying a voting token signature', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Vote Token Signature');
    });

    let publicKey: string;
    let privateKey: string;

    beforeAll(() => {
      ({ publicKey, privateKey } = generateElectionKeyPair());
    });

    it('should accept the signature when the vote token was signed with the matching private key', () => {
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      const sig = signVoteToken(privateKey, token);
      expect(verifyVoteTokenSignature(publicKey, token, sig)).toBe(true);
    });

    it('should return false for a tampered token when verifying a voting token signature', () => {
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      const sig = signVoteToken(privateKey, token);
      expect(verifyVoteTokenSignature(publicKey, token + 'X', sig)).toBe(false);
    });

    it('should return false for a tampered signature when verifying a voting token signature', () => {
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      const sig = signVoteToken(privateKey, token);
      const tampered = sig.slice(0, -4) + 'AAAA';
      expect(verifyVoteTokenSignature(publicKey, token, tampered)).toBe(false);
    });

    it('should return false for a wrong key pair when verifying a voting token signature', () => {
      const { privateKey: otherPriv, publicKey: otherPub } = generateElectionKeyPair();
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      const sig = signVoteToken(otherPriv, token);
      expect(verifyVoteTokenSignature(publicKey, token, sig)).toBe(false);
      expect(verifyVoteTokenSignature(otherPub, token, signVoteToken(privateKey, token))).toBe(
        false,
      );
    });

    it('should return false for garbage base64 signature when verifying a voting token signature', () => {
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      expect(verifyVoteTokenSignature(publicKey, token, 'notAValidSig====')).toBe(false);
    });
  });

  describe('Identifying a spent voting token', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Nullifier');
    });

    it('should return a 64-char hex SHA-256 hash when identifying a spent voting token', () => {
      const n = computeNullifier('sometoken');
      expect(n).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce the same spent-token marker when hashing the same token again', () => {
      expect(computeNullifier('abc')).toBe(computeNullifier('abc'));
    });

    it('should differ for different inputs when identifying a spent voting token', () => {
      expect(computeNullifier('a')).not.toBe(computeNullifier('b'));
    });
  });

  describe('Encrypting a ballot', () => {
    let publicKey: string;
    let privateKey: string;
    const choices = [randomUUID(), randomUUID()];
    const maxChoices = 5;

    beforeAll(() => {
      ({ publicKey, privateKey } = generateElectionKeyPair());
    });

    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Ballot Encryption Envelope');
    });

    it('should recover the original choices when decrypting an encrypted ballot', () => {
      allure.description('Should recover original choices after round-trip encryption/decryption.');
      const encryptedEnvelope = encryptBallot(publicKey, choices, maxChoices);
      const decryptedChoices = decryptBallot(privateKey, encryptedEnvelope);

      expect(decryptedChoices.choiceIds).toEqual(choices);
    });

    it('should produce a base64 encoded JSON envelope with expected version when encrypting a ballot', () => {
      const encryptedEnvelope = encryptBallot(publicKey, choices, maxChoices);
      const json = Buffer.from(encryptedEnvelope, 'base64').toString('utf-8');
      const envelope = JSON.parse(json);

      expect(envelope).toMatchObject({
        v: BALLOT_VERSION_ANONYMOUS,
        wrappedKey: expect.any(String),
        iv: expect.any(String),
        tag: expect.any(String),
        ciphertext: expect.any(String),
      });
    });

    it('should pad ballots to the same length regardless of choice count when encrypting a ballot', () => {
      const maxChoices = 5;
      const choice1 = randomUUID();
      const choice2 = randomUUID();

      const enc1 = encryptBallot(publicKey, [choice1, choice2], maxChoices);

      // Voter 2 picks 0 options (blank ballot)
      const enc2 = encryptBallot(publicKey, [], maxChoices);

      const getCipherLen = (env: string) =>
        JSON.parse(Buffer.from(env, 'base64').toString()).ciphertext.length;

      expect(getCipherLen(enc1)).toBe(getCipherLen(enc2));
    });

    it('should throw when trying to decrypt with the wrong private key', () => {
      const { privateKey: wrongKey } = generateElectionKeyPair();
      const encrypted = encryptBallot(publicKey, choices, maxChoices);

      expect(() => decryptBallot(wrongKey, encrypted)).toThrow();
    });

    it('should throw on tampered ciphertext (AES-GCM Auth Check) when encrypting a ballot', () => {
      const encrypted = encryptBallot(publicKey, choices, maxChoices);
      const envelope = JSON.parse(Buffer.from(encrypted, 'base64').toString());

      // Decode, flip the very first byte, and re-encode
      const rawCiphertext = Buffer.from(envelope.ciphertext, 'base64');
      rawCiphertext[0] = rawCiphertext[0] ^ 0xff; // Flip all bits in the first byte
      envelope.ciphertext = rawCiphertext.toString('base64');

      const tampered = Buffer.from(JSON.stringify(envelope)).toString('base64');
      expect(() => decryptBallot(privateKey, tampered)).toThrow();
    });

    it('should throw on invalid envelope version when encrypting a ballot', () => {
      const encrypted = encryptBallot(publicKey, choices, maxChoices);
      const envelope = JSON.parse(Buffer.from(encrypted, 'base64').toString());

      envelope.v = 999; // Future version
      const tampered = Buffer.from(JSON.stringify(envelope)).toString('base64');

      expect(() => decryptBallot(privateKey, tampered)).toThrow('Unsupported ballot version');
    });
  });

  describe('Signing a ballot record', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Ballot Entry Signing');
    });

    let privateKey: string;
    beforeAll(() => ({ privateKey } = generateElectionKeyPair()));

    it('should return a non-empty base64 string when signing a ballot record', () => {
      const sig = signBallotEntry(privateKey, {
        electionId: MOCK_ELECTION_ID,
        encryptedBallot: 'base64data',
        previousHash: null,
      });
      expect(typeof sig).toBe('string');
      expect(sig.length).toBeGreaterThan(10);
    });

    it('should change when any field in data changes', () => {
      const base = { electionId: MOCK_ELECTION_ID, encryptedBallot: 'data', previousHash: null };
      const sig1 = signBallotEntry(privateKey, base);
      const sig2 = signBallotEntry(privateKey, { ...base, encryptedBallot: 'other' });
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('Hashing a ballot record', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Ballot Blockchain Hash');
    });

    const data = {
      electionId: MOCK_ELECTION_ID,
      encryptedBallot: 'ballot',
      signature: 'sig',
      previousHash: null,
    };

    it('should return a 64-char hex string when hashing a ballot record', () => {
      expect(computeBallotHash(data)).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce the same ballot hash when hashing the same ballot again', () => {
      expect(computeBallotHash(data)).toBe(computeBallotHash(data));
    });

    it('should change with different previousHash when hashing a ballot record', () => {
      const withPrev = computeBallotHash({ ...data, previousHash: 'abc123' });
      expect(withPrev).not.toBe(computeBallotHash(data));
    });
  });

  describe('Generating invitation tokens', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Invite Token');
    });

    it('should produce the same token hash when hashing the same input again', () => {
      expect(hashToken('secret')).toBe(hashToken('secret'));
    });

    it('should produce different token hashes when the inputs differ', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });

    it('should produce a URL-safe token of the requested length when generating a token', () => {
      const token = generateBase64Token(INVITE_TOKEN_LENGTH);
      expect(token.length).toBe(INVITE_TOKEN_LENGTH);
      expect(token).toMatch(new RegExp(`^[A-Za-z0-9_-]{${INVITE_TOKEN_LENGTH}}$`));
    });

    it('should produce different random tokens when generating multiple tokens', () => {
      expect(generateBase64Token(INVITE_TOKEN_LENGTH)).not.toBe(
        generateBase64Token(INVITE_TOKEN_LENGTH),
      );
    });
  });
});
