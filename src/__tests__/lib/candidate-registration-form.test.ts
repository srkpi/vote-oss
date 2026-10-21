import { createCandidateRegistrationSchemas } from '@/lib/schemas/candidate-registration-form';
const blank = {
  phoneNumber: '',
  telegramTag: '',
  campaignProgramUrl: '',
  confirmedNoOverlap: false,
  confirmedDataAccurate: false,
};
describe('candidate registration form schemas', () => {
  it('allows incomplete drafts without confirmations', () => {
    expect(createCandidateRegistrationSchemas(true).draft.safeParse(blank).success).toBe(true);
  });
  it('rejects invalid supplied draft fields', () => {
    const result = createCandidateRegistrationSchemas(true).draft.safeParse({
      ...blank,
      phoneNumber: 'invalid',
      telegramTag: '@x',
      campaignProgramUrl: 'https://example.com',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['phoneNumber', 'telegramTag', 'campaignProgramUrl']),
      );
    }
  });
  it('requires phone, program and both confirmations for final submission', () => {
    const result = createCandidateRegistrationSchemas(true).submission.safeParse(blank);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining([
          'phoneNumber',
          'campaignProgramUrl',
          'confirmedNoOverlap',
          'confirmedDataAccurate',
        ]),
      );
    }
  });
  it('normalizes phone and telegram and ignores programs when not required', () => {
    const result = createCandidateRegistrationSchemas(false).submission.parse({
      ...blank,
      phoneNumber: '0501234567',
      telegramTag: 'username',
      campaignProgramUrl: 'invalid',
      confirmedNoOverlap: true,
      confirmedDataAccurate: true,
    });
    expect(result).toMatchObject({
      phoneNumber: '+380501234567',
      telegramTag: '@username',
      campaignProgramUrl: '',
    });
  });
});
