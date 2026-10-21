import { groupRequisitesFormSchema } from '@/lib/schemas/group-requisites-form';
describe('group requisites form', () => {
  const blank = { fullName: ' ', address: '', email: '', contact: '' };
  it('normalizes empty requisites to null', () => {
    expect(groupRequisitesFormSchema.parse(blank)).toEqual({
      fullName: null,
      address: null,
      email: null,
      contact: null,
    });
  });
  it('trims supplied values', () => {
    expect(
      groupRequisitesFormSchema.parse({
        ...blank,
        email: ' office@example.com ',
        fullName: ' Council ',
      }),
    ).toMatchObject({ email: 'office@example.com', fullName: 'Council' });
  });
  it('rejects invalid email and overlong contact', () => {
    const result = groupRequisitesFormSchema.safeParse({
      ...blank,
      email: 'invalid',
      contact: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['email', 'contact']),
      );
    }
  });
});
