import { z } from 'zod';

import { computeCampaignStageEditabilityFromApi } from '@/lib/campaign-stage-editability';
import {
  CAMPAIGN_POSITION_TITLE_MAX_LENGTH,
  CAMPAIGN_VOTING_MAX_DURATION_DAYS,
  CAMPAIGN_TOTAL_MAX_DURATION_DAYS,
  CAMPAIGN_TEAM_SIZE_MIN,
  CAMPAIGN_TEAM_SIZE_MAX,
  CAMPAIGN_SIGNATURE_QUORUM_MIN,
  CAMPAIGN_SIGNATURE_QUORUM_MAX,
} from '@/lib/constants';
import type { ElectionCampaign } from '@/types/campaign';
const scheduleFields = z.object({
  announcedAt: z.date(),
  registrationClosesAt: z.date(),
  votingOpensAt: z.date(),
  votingClosesAt: z.date(),
  signaturesOpensAt: z.date().nullable(),
  signaturesClosesAt: z.date().nullable(),
  signatureCollection: z.boolean(),
});
export type CampaignScheduleValues = z.infer<typeof scheduleFields>;
function validateSchedule(values: CampaignScheduleValues, ctx: z.RefinementCtx) {
  const issue = (key: keyof CampaignScheduleValues, message: string) =>
    ctx.addIssue({ code: 'custom', path: [key], message });
  if (values.registrationClosesAt <= values.announcedAt) {
    issue('registrationClosesAt', 'Кінець реєстрації має бути після початку');
  }
  const dayMs = 24 * 60 * 60 * 1000;
  if (
    values.votingClosesAt.getTime() - values.votingOpensAt.getTime() >
    CAMPAIGN_VOTING_MAX_DURATION_DAYS * dayMs
  ) {
    issue('votingClosesAt', 'Перевищено максимальну тривалість голосування');
  }
  if (
    values.votingClosesAt.getTime() - values.announcedAt.getTime() >
    CAMPAIGN_TOTAL_MAX_DURATION_DAYS * dayMs
  ) {
    issue('votingClosesAt', 'Перевищено максимальну тривалість кампанії');
  }
  let reviewEnds = values.registrationClosesAt;
  if (values.signatureCollection) {
    if (!values.signaturesOpensAt) {
      issue('signaturesOpensAt', 'Вкажіть початок збору підписів');
    }
    if (!values.signaturesClosesAt) {
      issue('signaturesClosesAt', 'Вкажіть кінець збору підписів');
    }
    if (values.signaturesOpensAt && values.signaturesClosesAt) {
      if (values.signaturesOpensAt < values.registrationClosesAt) {
        issue('signaturesOpensAt', 'Збір підписів не може починатися до завершення реєстрації');
      }
      if (values.signaturesClosesAt <= values.signaturesOpensAt) {
        issue('signaturesClosesAt', 'Кінець збору підписів має бути після початку');
      }
      reviewEnds = values.signaturesClosesAt;
    }
  }
  if (values.votingOpensAt < reviewEnds) {
    issue('votingOpensAt', 'Голосування не може починатися до завершення попереднього етапу');
  }
  if (values.votingClosesAt <= values.votingOpensAt) {
    issue('votingClosesAt', 'Кінець голосування має бути після початку');
  }
}
function activeDates(values: CampaignScheduleValues) {
  const keys = ['announcedAt', 'registrationClosesAt', 'votingOpensAt', 'votingClosesAt'] as const;
  return [
    ...keys.map((key) => [key, values[key]] as const),
    ...(values.signatureCollection
      ? ([
          ['signaturesOpensAt', values.signaturesOpensAt],
          ['signaturesClosesAt', values.signaturesClosesAt],
        ] as const)
      : []),
  ];
}
export function createCampaignFormSchema(now: () => number = Date.now) {
  return scheduleFields
    .extend({
      positionTitle: z
        .string()
        .trim()
        .min(1, 'Вкажіть тип посади')
        .max(CAMPAIGN_POSITION_TITLE_MAX_LENGTH),
      electionKind: z.enum(['REGULAR', 'BY_ELECTION', 'REPLACEMENT', 'REPEAT']),
      signatureQuorum: z.number().nullable(),
      teamSize: z.int().min(CAMPAIGN_TEAM_SIZE_MIN).max(CAMPAIGN_TEAM_SIZE_MAX),
      requiresCampaignProgram: z.boolean(),
      faculties: z.array(z.string()),
    })
    .superRefine((values, ctx) => {
      validateSchedule(values, ctx);
      const time = now();
      for (const [key, date] of activeDates(values)) {
        if (date && date.getTime() <= time) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'Дата має бути після поточного часу',
          });
        }
      }
      if (
        values.signatureCollection &&
        (values.signatureQuorum === null ||
          !Number.isInteger(values.signatureQuorum) ||
          values.signatureQuorum < CAMPAIGN_SIGNATURE_QUORUM_MIN ||
          values.signatureQuorum > CAMPAIGN_SIGNATURE_QUORUM_MAX)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['signatureQuorum'],
          message: `Ціле число від ${CAMPAIGN_SIGNATURE_QUORUM_MIN} до ${CAMPAIGN_SIGNATURE_QUORUM_MAX}`,
        });
      }
    });
}
export function createCampaignScheduleSchema(
  campaign: ElectionCampaign,
  now: () => number = Date.now,
) {
  return scheduleFields.superRefine((values, ctx) => {
    validateSchedule(values, ctx);
    if (['CANCELLED', 'FAILED', 'COMPLETED'].includes(campaign.state)) {
      ctx.addIssue({ code: 'custom', path: ['root'], message: 'Кампанію завершено' });
      return;
    }
    const locks = computeCampaignStageEditabilityFromApi(campaign, new Date(now()));
    for (const [key, date] of activeDates(values)) {
      const original = campaign[key];
      if (!date || !original) {
        continue;
      }
      if (
        (locks[key] === 'locked' && date.getTime() !== Date.parse(original)) ||
        (locks[key] === 'extend_only' && date.getTime() < Date.parse(original))
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message:
            locks[key] === 'locked' ? 'Цю дату вже не можна змінити' : 'Дату можна лише продовжити',
        });
      }
    }
  });
}
export function campaignScheduleDefaults(campaign: ElectionCampaign): CampaignScheduleValues {
  return {
    announcedAt: new Date(campaign.announcedAt),
    registrationClosesAt: new Date(campaign.registrationClosesAt),
    votingOpensAt: new Date(campaign.votingOpensAt),
    votingClosesAt: new Date(campaign.votingClosesAt),
    signatureCollection: campaign.signatureCollection,
    signaturesOpensAt: campaign.signaturesOpensAt ? new Date(campaign.signaturesOpensAt) : null,
    signaturesClosesAt: campaign.signaturesClosesAt ? new Date(campaign.signaturesClosesAt) : null,
  };
}
export function serializeCampaignSchedule(values: CampaignScheduleValues) {
  return {
    announcedAt: values.announcedAt.toISOString(),
    registrationClosesAt: values.registrationClosesAt.toISOString(),
    votingOpensAt: values.votingOpensAt.toISOString(),
    votingClosesAt: values.votingClosesAt.toISOString(),
    signaturesOpensAt: values.signatureCollection ? values.signaturesOpensAt!.toISOString() : null,
    signaturesClosesAt: values.signatureCollection
      ? values.signaturesClosesAt!.toISOString()
      : null,
  };
}
export type CampaignFormValues = z.infer<ReturnType<typeof createCampaignFormSchema>>;
