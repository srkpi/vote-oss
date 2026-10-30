jest.mock('openid-client', () => ({ discovery: jest.fn(), enableNonRepudiationChecks: jest.fn() }));
import {
  OIDC_TTL,
  openOidcTransaction,
  parseStudentClaims,
  sealOidcTransaction,
} from '@/lib/kpi-oidc';
const valid = {
  sub: 'stable-subject',
  name: 'Student',
  student_ids: ['2', '1', '2'],
  trusted: true,
  auth_method: 'DIIA',
};
describe('KPI OIDC claims', () => {
  it('keeps the subject separate and normalizes all student records', () => {
    const result = parseStudentClaims(valid);
    expect(result.subject).toBe('stable-subject');
    expect(result.students.map((s) => s.STUDENT_ID)).toEqual(['1', '2']);
  });
  it.each(['DIIA', 'BANK_ID'])('accepts trusted %s', (auth_method) => {
    expect(parseStudentClaims({ ...valid, auth_method }).students).toHaveLength(2);
  });
  it.each([false, undefined, 'true'])('rejects trusted=%s', (trusted) => {
    expect(() => parseStudentClaims({ ...valid, trusted })).toThrow('Not allowed auth method');
  });
  it('rejects Google even when trusted is true', () => {
    expect(() => parseStudentClaims({ ...valid, auth_method: 'GOOGLE' })).toThrow();
  });
  it.each([[], undefined])('rejects accounts without student records (%s)', (student_ids) => {
    expect(() => parseStudentClaims({ ...valid, student_ids })).toThrow(
      'only available for students',
    );
  });
  it.each([[123], [''], ['1', null]])(
    'rejects malformed student records (%s)',
    (...student_ids) => {
      expect(() => parseStudentClaims({ ...valid, student_ids })).toThrow();
    },
  );
  it.each([{ sub: '' }, { name: '' }])('requires subject and name', (patch) => {
    expect(() => parseStudentClaims({ ...valid, ...patch })).toThrow();
  });
});

describe('encrypted KPI OIDC transaction', () => {
  const transaction = {
    verifier: 'private-verifier',
    state: 'browser-state',
    nonce: 'token-nonce',
  };
  afterEach(() => jest.useRealTimers());
  it('round-trips the transaction without exposing the verifier in the cookie', async () => {
    const sealed = await sealOidcTransaction(transaction);
    expect(sealed.split('.')).toHaveLength(5);
    expect(sealed).not.toContain(transaction.verifier);
    expect(sealed.length).toBeLessThan(4096);
    await expect(openOidcTransaction(sealed)).resolves.toEqual(transaction);
  });
  it('rejects modified cookie contents', async () => {
    const parts = (await sealOidcTransaction(transaction)).split('.');
    parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);
    await expect(openOidcTransaction(parts.join('.'))).rejects.toThrow();
  });
  it('allows identification to take more than five minutes but expires after fifteen', async () => {
    jest.useFakeTimers();
    const startedAt = Date.now();
    const sealed = await sealOidcTransaction(transaction);
    jest.setSystemTime(startedAt + 6 * 60 * 1000);
    await expect(openOidcTransaction(sealed)).resolves.toEqual(transaction);
    jest.setSystemTime(startedAt + (OIDC_TTL + 1) * 1000);
    await expect(openOidcTransaction(sealed)).rejects.toThrow();
  });
  it.each([undefined, '', 'not-a-jwe'])(
    'rejects a missing or malformed cookie (%s)',
    async (cookie) => {
      await expect(openOidcTransaction(cookie)).rejects.toThrow();
    },
  );
  it('rejects an incomplete transaction even when encrypted by this server', async () => {
    const sealed = await sealOidcTransaction({ ...transaction, nonce: '' });
    await expect(openOidcTransaction(sealed)).rejects.toThrow('Invalid login transaction');
  });
});
