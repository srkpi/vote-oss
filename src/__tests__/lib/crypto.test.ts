import * as allure from 'allure-js-commons';
import { constants, publicEncrypt } from 'crypto';

import { MOCK_ELECTION_ID } from '@/__tests__/helpers/fixtures';
import { INVITE_TOKEN_LENGTH } from '@/lib/constants';
import {
  computeBallotHash,
  computeNullifier,
  decryptBallot,
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

  describe('decryptBallot', () => {
    beforeEach(() => {
      allure.feature('Crypto');
      allure.story('Ballot Encryption');
    });

    let publicKey: string;
    let privateKey: string;

    beforeAll(() => {
      ({ publicKey, privateKey } = generateElectionKeyPair());
    });

    function encrypt(plaintext: string[]): string {
      const buf = publicEncrypt(
        { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        Buffer.from(JSON.stringify(plaintext)),
      );
      return buf.toString('base64');
    }

    it('decrypts a value correctly encrypted with the matching public key', () => {
      const enc = encrypt(['42']);
      expect(decryptBallot(privateKey, enc)).toEqual(['42']);
    });

    it('throws on invalid base64 input', () => {
      expect(() => decryptBallot(privateKey, '!!!not-base64!!!')).toThrow();
    });

    it('throws when decrypting with wrong private key', () => {
      const { privateKey: otherKey } = generateElectionKeyPair();
      const enc = encrypt(['10']);
      expect(() => decryptBallot(otherKey, enc)).toThrow();
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
