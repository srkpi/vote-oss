import * as allure from 'allure-js-commons';
import { randomUUID } from 'crypto';

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

describe('crypto', () => {
  describe('generateElectionKeyPair', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Key Generation');
    });

    it('returns PEM-encoded public and private keys', () => {
      allure.description('Both keys must be present and PEM-formatted.');
      const { publicKey, privateKey } = generateElectionKeyPair();
      expect(publicKey).toMatch(/-----BEGIN PUBLIC KEY-----/);
      expect(privateKey).toMatch(/-----BEGIN PRIVATE KEY-----/);
    });

    it('generates a unique key pair on every call', () => {
      allure.description('Each invocation should yield different keys.');
      const first = generateElectionKeyPair();
      const second = generateElectionKeyPair();
      expect(first.publicKey).not.toBe(second.publicKey);
      expect(first.privateKey).not.toBe(second.privateKey);
    });
  });

  describe('generateVoteToken', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Vote Token');
    });

    it('embeds election id as the first segment', () => {
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      expect(token.startsWith(`${MOCK_ELECTION_ID}:`)).toBe(true);
    });

    it('includes a 64-char hex random secret', () => {
      const { token, randomSecret } = generateVoteToken(MOCK_ELECTION_ID);
      expect(randomSecret).toMatch(/^[a-f0-9]{64}$/);
      expect(token).toBe(`${MOCK_ELECTION_ID}:${randomSecret}`);
    });

    it('produces different secrets for each call', () => {
      const a = generateVoteToken(MOCK_ELECTION_ID);
      const b = generateVoteToken(MOCK_ELECTION_ID);
      expect(a.randomSecret).not.toBe(b.randomSecret);
    });
  });

  describe('signVoteToken / verifyVoteTokenSignature', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Vote Token Signature');
    });

    let publicKey: string;
    let privateKey: string;

    beforeAll(() => {
      ({ publicKey, privateKey } = generateElectionKeyPair());
    });

    it('signature created with private key is verified with public key', () => {
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      const sig = signVoteToken(privateKey, token);
      expect(verifyVoteTokenSignature(publicKey, token, sig)).toBe(true);
    });

    it('returns false for a tampered token', () => {
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      const sig = signVoteToken(privateKey, token);
      expect(verifyVoteTokenSignature(publicKey, token + 'X', sig)).toBe(false);
    });

    it('returns false for a tampered signature', () => {
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      const sig = signVoteToken(privateKey, token);
      const tampered = sig.slice(0, -4) + 'AAAA';
      expect(verifyVoteTokenSignature(publicKey, token, tampered)).toBe(false);
    });

    it('returns false for a wrong key pair', () => {
      const { privateKey: otherPriv, publicKey: otherPub } = generateElectionKeyPair();
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      const sig = signVoteToken(otherPriv, token);
      expect(verifyVoteTokenSignature(publicKey, token, sig)).toBe(false);
      expect(verifyVoteTokenSignature(otherPub, token, signVoteToken(privateKey, token))).toBe(
        false,
      );
    });

    it('returns false for garbage base64 signature', () => {
      const { token } = generateVoteToken(MOCK_ELECTION_ID);
      expect(verifyVoteTokenSignature(publicKey, token, 'notAValidSig====')).toBe(false);
    });
  });

  describe('computeNullifier', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Nullifier');
    });

    it('returns a 64-char hex SHA-256 hash', () => {
      const n = computeNullifier('sometoken');
      expect(n).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic for the same input', () => {
      expect(computeNullifier('abc')).toBe(computeNullifier('abc'));
    });

    it('differs for different inputs', () => {
      expect(computeNullifier('a')).not.toBe(computeNullifier('b'));
    });
  });

  describe('Ballot Encryption (Hybrid AES-GCM + RSA-OAEP)', () => {
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

    it('encrypts and decrypts a ballot correctly', () => {
      allure.description('Should recover original choices after round-trip encryption/decryption.');
      const encryptedEnvelope = encryptBallot(publicKey, choices, maxChoices);
      const decryptedChoices = decryptBallot(privateKey, encryptedEnvelope);

      expect(decryptedChoices.choiceIds).toEqual(choices);
    });

    it('produces a base64 encoded JSON envelope with expected version', () => {
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

    it('pads ballots to the same length regardless of choice count', () => {
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

    it('throws when trying to decrypt with the wrong private key', () => {
      const { privateKey: wrongKey } = generateElectionKeyPair();
      const encrypted = encryptBallot(publicKey, choices, maxChoices);

      expect(() => decryptBallot(wrongKey, encrypted)).toThrow();
    });

    it('throws on tampered ciphertext (AES-GCM Auth Check)', () => {
      const encrypted = encryptBallot(publicKey, choices, maxChoices);
      const envelope = JSON.parse(Buffer.from(encrypted, 'base64').toString());

      // Decode, flip the very first byte, and re-encode
      const rawCiphertext = Buffer.from(envelope.ciphertext, 'base64');
      rawCiphertext[0] = rawCiphertext[0] ^ 0xff; // Flip all bits in the first byte
      envelope.ciphertext = rawCiphertext.toString('base64');

      const tampered = Buffer.from(JSON.stringify(envelope)).toString('base64');
      expect(() => decryptBallot(privateKey, tampered)).toThrow();
    });

    it('throws on invalid envelope version', () => {
      const encrypted = encryptBallot(publicKey, choices, maxChoices);
      const envelope = JSON.parse(Buffer.from(encrypted, 'base64').toString());

      envelope.v = 999; // Future version
      const tampered = Buffer.from(JSON.stringify(envelope)).toString('base64');

      expect(() => decryptBallot(privateKey, tampered)).toThrow('Unsupported ballot version');
    });
  });

  describe('signBallotEntry', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Ballot Entry Signing');
    });

    let privateKey: string;
    beforeAll(() => ({ privateKey } = generateElectionKeyPair()));

    it('returns a non-empty base64 string', () => {
      const sig = signBallotEntry(privateKey, {
        electionId: MOCK_ELECTION_ID,
        encryptedBallot: 'base64data',
        previousHash: null,
      });
      expect(typeof sig).toBe('string');
      expect(sig.length).toBeGreaterThan(10);
    });

    it('changes when any field in data changes', () => {
      const base = { electionId: MOCK_ELECTION_ID, encryptedBallot: 'data', previousHash: null };
      const sig1 = signBallotEntry(privateKey, base);
      const sig2 = signBallotEntry(privateKey, { ...base, encryptedBallot: 'other' });
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('computeBallotHash', () => {
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

    it('returns a 64-char hex string', () => {
      expect(computeBallotHash(data)).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic', () => {
      expect(computeBallotHash(data)).toBe(computeBallotHash(data));
    });

    it('changes with different previousHash', () => {
      const withPrev = computeBallotHash({ ...data, previousHash: 'abc123' });
      expect(withPrev).not.toBe(computeBallotHash(data));
    });
  });

  describe('hashToken / generateBase64Token', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Invite Token');
    });

    it('hashToken is deterministic', () => {
      expect(hashToken('secret')).toBe(hashToken('secret'));
    });

    it('hashToken differs for different inputs', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });

    it('generateBase64Token returns a valid Base64URL string of correct length', () => {
      const token = generateBase64Token(INVITE_TOKEN_LENGTH);
      expect(token.length).toBe(INVITE_TOKEN_LENGTH);
      expect(token).toMatch(new RegExp(`^[A-Za-z0-9_-]{${INVITE_TOKEN_LENGTH}}$`));
    });

    it('generateBase64Token produces unique tokens', () => {
      expect(generateBase64Token(INVITE_TOKEN_LENGTH)).not.toBe(
        generateBase64Token(INVITE_TOKEN_LENGTH),
      );
    });
  });
});
