import { z } from 'zod';

import {
  FAQ_CATEGORY_TITLE_MAX_LENGTH,
  FAQ_ITEM_CONTENT_MAX_LENGTH,
  FAQ_ITEM_TITLE_MAX_LENGTH,
} from '@/lib/constants';
import { trimmedString } from '@/lib/schemas/common';
import { deltaToPlainText, parseQuillDelta } from '@/lib/utils/common';

export const faqCategoryBodySchema = z.object({
  title: trimmedString(FAQ_CATEGORY_TITLE_MAX_LENGTH),
});

export const faqItemBodySchema = z.object({
  title: trimmedString(FAQ_ITEM_TITLE_MAX_LENGTH),
  content: z.string().superRefine((content, context) => {
    const delta = parseQuillDelta(content);
    if (
      !delta ||
      delta.ops.some(
        (operation) => !operation || typeof operation !== 'object' || Array.isArray(operation),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'content must be a valid Quill Delta JSON string',
      });
      return;
    }
    if (deltaToPlainText(content).length > FAQ_ITEM_CONTENT_MAX_LENGTH) {
      context.addIssue({
        code: 'custom',
        message: `content plain text must be at most ${FAQ_ITEM_CONTENT_MAX_LENGTH} characters`,
      });
    }
  }),
});

export const faqReorderBodySchema = z.object({ order: z.array(z.string()) });
