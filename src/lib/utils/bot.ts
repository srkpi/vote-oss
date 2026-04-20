import { headers } from 'next/headers';

import { BOT_REQUEST_HEADER } from '@/lib/constants';

export async function isBotRequest(): Promise<boolean> {
  const headersList = await headers();
  return headersList.get(BOT_REQUEST_HEADER) === '1';
}
