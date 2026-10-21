import {
  createCampaignFormSchema,
  createCampaignScheduleSchema,
  serializeCampaignSchedule,
} from '@/lib/schemas/campaign-form';
import type { ElectionCampaign } from '@/types/campaign';
const values = {
  positionTitle: ' Council ',
  electionKind: 'REGULAR' as const,
  announcedAt: new Date('2026-11-02'),
  registrationClosesAt: new Date('2026-11-03'),
  votingOpensAt: new Date('2026-11-05'),
  votingClosesAt: new Date('2026-11-06'),
  signatureCollection: false,
  signaturesOpensAt: null,
  signaturesClosesAt: null,
  signatureQuorum: null,
  teamSize: 0,
  requiresCampaignProgram: false,
  faculties: [],
};
const schema = createCampaignFormSchema(() => Date.parse('2026-11-01'));
describe('campaign forms', () => {
  it('accepts a schedule without signatures and trims the title', () => {
    expect(schema.parse(values).positionTitle).toBe('Council');
    expect(serializeCampaignSchedule(values).signaturesOpensAt).toBeNull();
  });
  it('allows zero-length review windows', () => {
    expect(
      schema.safeParse({ ...values, votingOpensAt: values.registrationClosesAt }).success,
    ).toBe(true);
  });
  it('rejects reversed dates and excessive voting duration', () => {
    expect(schema.safeParse({ ...values, registrationClosesAt: values.announcedAt }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...values, votingClosesAt: new Date('2026-12-20') }).success).toBe(
      false,
    );
  });
  it('requires signature dates and quorum only when enabled', () => {
    expect(schema.safeParse({ ...values, signatureCollection: true }).success).toBe(false);
    expect(
      schema.safeParse({
        ...values,
        signatureCollection: true,
        signaturesOpensAt: new Date('2026-11-03'),
        signaturesClosesAt: new Date('2026-11-04'),
        signatureQuorum: 100,
      }).success,
    ).toBe(true);
  });
  it('rejects fractional quorum and signatures overlapping voting', () => {
    expect(
      schema.safeParse({
        ...values,
        signatureCollection: true,
        signaturesOpensAt: new Date('2026-11-03'),
        signaturesClosesAt: new Date('2026-11-07'),
        signatureQuorum: 1.5,
      }).success,
    ).toBe(false);
  });
  it('checks current time when submitting a creation form', () => {
    expect(createCampaignFormSchema(() => Date.parse('2026-11-10')).safeParse(values).success).toBe(
      false,
    );
  });
  const campaign = {
    ...serializeCampaignSchedule(values),
    signatureCollection: false,
    state: 'REGISTRATION_OPEN',
  } as ElectionCampaign;
  const editSchema = createCampaignScheduleSchema(campaign, () =>
    Date.parse('2026-11-02T12:00:00Z'),
  );
  it('preserves locked timestamps and only extends the current stage', () => {
    expect(editSchema.safeParse(values).success).toBe(true);
    expect(editSchema.safeParse({ ...values, announcedAt: new Date('2026-11-01') }).success).toBe(
      false,
    );
    expect(
      editSchema.safeParse({ ...values, registrationClosesAt: new Date('2026-11-02T18:00:00Z') })
        .success,
    ).toBe(false);
    expect(
      editSchema.safeParse({ ...values, registrationClosesAt: new Date('2026-11-04') }).success,
    ).toBe(true);
  });
  it('rejects editing terminal campaigns', () => {
    expect(
      createCampaignScheduleSchema({ ...campaign, state: 'COMPLETED' }).safeParse(values).success,
    ).toBe(false);
  });
});
