import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { StudyFormValue } from '@/lib/constants';
import { LEVEL_COURSE_LEVEL_LABELS, STUDY_FORM_LABELS } from '@/lib/constants';
import type { InviteToken } from '@/types/admin';
import type { ElectionStatus, RestrictionType } from '@/types/election';
import type { QuillDelta } from '@/types/quill';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  }).format(date);
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace('р. о', '');
}

export function formatTimeRemaining(targetDate: string): string {
  const now = Date.now();
  const target = new Date(targetDate).getTime();
  const diff = target - now;

  if (diff <= 0) return 'Завершено';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) return `${days} дн. ${hours} год.`;
  if (hours > 0) return `${hours} год. ${minutes} хв.`;
  if (minutes > 0) return `${minutes} хв. ${seconds} с.`;
  return `${seconds} с.`;
}

export function formatLevelCourse(value: string): string {
  const level = value[0] as 'b' | 'm' | 'g';
  const course = value.slice(1);
  const levelLabel = LEVEL_COURSE_LEVEL_LABELS[level];

  // Singular form for display: Бакалавр, Магістр, Аспірант
  const singularMap: Record<string, string> = {
    b: 'Бакалавр',
    m: 'Магістр',
    g: 'Аспірант',
  };

  return `${singularMap[level] ?? levelLabel} ${course} курс`;
}

export function formatRestrictionValue(type: RestrictionType, value: string) {
  if (type === 'STUDY_FORM') {
    return STUDY_FORM_LABELS[value as StudyFormValue] || value;
  }
  if (type === 'STUDY_YEAR') {
    return `${value} курс`;
  }
  if (type === 'LEVEL_COURSE') {
    return formatLevelCourse(value);
  }
  return value;
}

export function getElectionStatus(opensAt: string, closesAt: string): ElectionStatus {
  const now = new Date();
  const open = new Date(opensAt);
  const close = new Date(closesAt);

  if (now < open) return 'upcoming';
  if (now <= close) return 'open';
  return 'closed';
}

export function getStatusLabel(status: ElectionStatus): string {
  const labels: Record<ElectionStatus, string> = {
    upcoming: 'Очікується',
    open: 'Активне',
    closed: 'Завершено',
  };
  return labels[status];
}

export function getStatusColor(status: ElectionStatus): string {
  const colors: Record<ElectionStatus, string> = {
    upcoming: 'warning',
    open: 'success',
    closed: 'secondary',
  };
  return colors[status];
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '…';
}

export function pluralize(
  count: number,
  forms: [string, string, string],
  returnCount: boolean = true,
): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  let word: string;

  if (mod100 >= 11 && mod100 <= 14) {
    word = forms[2];
  } else if (mod10 === 1) {
    word = forms[0];
  } else if (mod10 >= 2 && mod10 <= 4) {
    word = forms[1];
  } else {
    word = forms[2];
  }

  return returnCount ? `${count} ${word}` : word;
}

export function calculateVotePercentage(votes: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((votes / total) * 100 * 10) / 10;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function isValidDate(dateString: string): boolean {
  const d = new Date(dateString);
  return d instanceof Date && !isNaN(d.getTime());
}

export function isFutureDate(dateString: string): boolean {
  return new Date(dateString) > new Date();
}

/**
 * Validates that a string is a well-formed UUID v4.
 * Used in API routes to reject obviously invalid IDs before hitting the DB.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export function tokenUsageFraction(token: InviteToken): number {
  if (token.maxUsage === 0) return 0;
  return token.currentUsage / token.maxUsage;
}

export function tokenUsageColor(fraction: number): string {
  if (fraction >= 1) return 'bg-error';
  if (fraction >= 0.8) return 'bg-kpi-orange';
  return 'bg-success';
}

export function tokenExpiresLabel(validDue: string): { text: string; urgent: boolean } {
  const diff = new Date(validDue).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);

  return { text: formatDateTime(validDue), urgent: days < 3 };
}

export function parseQuillDelta(content: string): QuillDelta | null {
  try {
    const raw = JSON.parse(content) as unknown;
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as QuillDelta).ops)) {
      return null;
    }
    return raw as QuillDelta;
  } catch {
    return null;
  }
}

/**
 * Extract plain text from a Quill Delta JSON string.
 * Used server-side to validate content length and client-side for previews.
 *
 * Quill always appends a trailing "\n" to every document; we strip it so
 * that length checks match the visible character count.
 */
export function deltaToPlainText(content: string): string {
  const delta = parseQuillDelta(content);
  if (!delta) return '';

  const text = delta.ops
    .filter((op) => typeof op.insert === 'string')
    .map((op) => op.insert as string)
    .join('');

  // Strip the single trailing newline Quill always appends
  return text.endsWith('\n') ? text.slice(0, -1) : text;
}
