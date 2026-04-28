/**
 * Field validators for candidate registration submissions.
 *
 * Each validator returns a normalised value on success or an error message on
 * failure.  Used by both the submit/draft endpoints and (eventually) the
 * submit-time UI.
 */

import {
  REGISTRATION_PHONE_MAX_LENGTH,
  REGISTRATION_PROGRAM_URL_ALLOWED_HOSTS,
  REGISTRATION_PROGRAM_URL_MAX_LENGTH,
  REGISTRATION_TELEGRAM_TAG_MAX_LENGTH,
} from '@/lib/constants';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Accepts a Ukrainian mobile in the form `+380XXXXXXXXX` (exactly 12 digits,
 * leading `+`). Cosmetic spaces / dashes / parentheses are allowed in input
 * and stripped on normalisation.
 */
export function validatePhoneNumber(raw: string): ValidationResult<string> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Номер телефону обовʼязковий' };
  if (trimmed.length > REGISTRATION_PHONE_MAX_LENGTH) {
    return { ok: false, error: `Номер не довший за ${REGISTRATION_PHONE_MAX_LENGTH} символів` };
  }
  if (!/^[+\d\s()-]+$/.test(trimmed)) {
    return { ok: false, error: 'Номер містить недопустимі символи' };
  }
  if (!trimmed.startsWith('+')) {
    return { ok: false, error: 'Номер має починатися з «+»' };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 12) {
    return { ok: false, error: 'Номер має містити рівно 12 цифр' };
  }
  if (!digits.startsWith('380')) {
    return { ok: false, error: 'Номер має починатися з +380' };
  }
  return { ok: true, value: `+${digits}` };
}

/** Accepts `@username` or `username`; normalises to `@username`. */
export function validateTelegramTag(raw: string): ValidationResult<string> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Telegram-тег обовʼязковий' };
  const stripped = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(stripped)) {
    return {
      ok: false,
      error: 'Telegram-тег має починатися з літери і містити 5–32 латинських символи, цифри або _',
    };
  }
  const normalised = `@${stripped}`;
  if (normalised.length > REGISTRATION_TELEGRAM_TAG_MAX_LENGTH) {
    return { ok: false, error: 'Telegram-тег задовгий' };
  }
  return { ok: true, value: normalised };
}

/** Accepts a Google Drive / Docs URL only. */
export function validateCampaignProgramUrl(raw: string): ValidationResult<string> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Посилання на програму обовʼязкове' };
  if (trimmed.length > REGISTRATION_PROGRAM_URL_MAX_LENGTH) {
    return {
      ok: false,
      error: `Посилання задовге (макс. ${REGISTRATION_PROGRAM_URL_MAX_LENGTH} символів)`,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Невалідна URL-адреса' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Посилання має бути https' };
  }

  const host = url.hostname.toLowerCase();
  const allowed = REGISTRATION_PROGRAM_URL_ALLOWED_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`),
  );
  if (!allowed) {
    return {
      ok: false,
      error: `Посилання має бути на одному з: ${REGISTRATION_PROGRAM_URL_ALLOWED_HOSTS.join(', ')}`,
    };
  }

  return { ok: true, value: trimmed };
}
