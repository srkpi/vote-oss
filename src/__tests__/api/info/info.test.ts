import { GET } from '@/app/api/info/route';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { APP_VERSION, NODE_ENV } from '@/lib/config/server';

describe('GET /api/info', () => {
  it('returns app info', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      title: APP_NAME,
      version: APP_VERSION,
      url: APP_URL,
      docs: `${APP_URL}/docs`,
      environment: NODE_ENV,
    });
  });
});
