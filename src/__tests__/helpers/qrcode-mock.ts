import { vi } from 'vitest';

/**
 * Mock for the `qrcode` package.
 *
 * Usage:
 *   import { qrCodeMock } from '@/__tests__/helpers/qrcode-mock';
 *   vi.mock('qrcode', async () => {
 *     const { qrCodeMock } = await import('@/__tests__/helpers/qrcode-mock');
 *     return { default: qrCodeMock };
 *   });
 */

export const qrCodeMock = { toDataURL: vi.fn() };
