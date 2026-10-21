import {
  createRegistrationDialogSchema,
  getRegistrationDialogPhase,
} from '@/lib/schemas/registration-dialog-form';
const target = { opensAt: '2026-11-02T12:00:00Z', closesAt: '2026-11-04T12:00:00Z' };
const values = {
  title: ' Form ',
  description: '',
  opensAt: new Date(target.opensAt),
  closesAt: new Date(target.closesAt),
  faculties: [],
  requiresCampaignProgram: false,
  teamSize: 0,
};
describe('registration form dialog', () => {
  it('allows future dates and trims the title before opening', () => {
    const schema = createRegistrationDialogSchema(target, () => Date.parse('2026-11-01'));
    expect(schema.parse(values).title).toBe('Form');
    expect(schema.safeParse({ ...values, opensAt: new Date('2026-11-03') }).success).toBe(true);
  });
  it('rejects reversed dates and dates in the past', () => {
    const schema = createRegistrationDialogSchema(null, () => Date.parse('2026-11-01'));
    expect(schema.safeParse({ ...values, closesAt: new Date('2026-10-31') }).success).toBe(false);
    expect(schema.safeParse({ ...values, opensAt: new Date('2026-10-31') }).success).toBe(false);
  });
  it('only allows extending an open form and preserves the start', () => {
    const schema = createRegistrationDialogSchema(target, () => Date.parse('2026-11-03'));
    expect(schema.safeParse({ ...values, closesAt: new Date('2026-11-05') }).success).toBe(true);
    expect(schema.safeParse({ ...values, closesAt: new Date('2026-11-04') }).success).toBe(false);
    expect(schema.safeParse({ ...values, opensAt: new Date('2026-11-03') }).success).toBe(false);
  });
  it('checks phase at validation time even when a dialog crosses a boundary', () => {
    let now = Date.parse('2026-11-01');
    const schema = createRegistrationDialogSchema(target, () => now);
    expect(schema.safeParse(values).success).toBe(true);
    now = Date.parse(target.closesAt);
    expect(schema.safeParse(values).success).toBe(false);
    expect(getRegistrationDialogPhase(target, now)).toBe('closed');
  });
  it('rejects empty titles and invalid team sizes', () => {
    const schema = createRegistrationDialogSchema(null, () => Date.parse('2026-11-01'));
    expect(schema.safeParse({ ...values, title: ' ', teamSize: 1.5 }).success).toBe(false);
    expect(schema.safeParse({ ...values, teamSize: 11 }).success).toBe(false);
  });
});
