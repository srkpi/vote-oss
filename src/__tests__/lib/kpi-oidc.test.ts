jest.mock('openid-client', () => ({ discovery: jest.fn(), enableNonRepudiationChecks: jest.fn() }));
import { parseStudentClaims } from '@/lib/kpi-oidc';
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
