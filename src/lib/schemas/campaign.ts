import { z } from 'zod';

import { restrictionSchema } from '@/lib/schemas/common';

const campaignDatesShape = {
  announcedAt: z.string().optional(),
  registrationClosesAt: z.string().optional(),
  votingOpensAt: z.string().optional(),
  votingClosesAt: z.string().optional(),
  signaturesOpensAt: z.string().nullable().optional(),
  signaturesClosesAt: z.string().nullable().optional(),
};

export const campaignDatesBodySchema = z.object(campaignDatesShape);
export const campaignCreateBodySchema = campaignDatesBodySchema.extend({
  positionTitle: z.string().optional(),
  electionKind: z.enum(['REGULAR', 'BY_ELECTION', 'REPLACEMENT', 'REPEAT']).optional(),
  signatureCollection: z.boolean().optional(),
  signatureQuorum: z.int().nullable().optional(),
  teamSize: z.int().optional(),
  requiresCampaignProgram: z.boolean().optional(),
  restrictions: z.array(restrictionSchema).optional(),
});
