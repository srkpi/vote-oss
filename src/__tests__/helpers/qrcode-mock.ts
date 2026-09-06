/**
 * Mock for the `qrcode` package.
 *
 * Usage:
 *   import { qrCodeMock } from '@/__tests__/helpers/qrcode-mock';
 *   jest.mock('qrcode', () => qrCodeMock);
 */

export const qrCodeMock = { toDataURL: jest.fn() };
