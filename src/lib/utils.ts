import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ElectionStatus } from '@/types';

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
  }).format(date);
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

export function pluralize(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) return `${count} ${forms[2]}`;
  if (mod10 === 1) return `${count} ${forms[0]}`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
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
