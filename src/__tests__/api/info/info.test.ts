import { GET } from '@/app/api/info/route';
import { getBuildInfo } from '@/lib/build-info';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { NODE_ENV } from '@/lib/config/server';

describe('GET /api/info', () => {
  it('returns app info', async () => {
    const response = await GET();
    const data = await response.json();
    const build = getBuildInfo();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      title: APP_NAME,
      url: APP_URL,
      docs: `${APP_URL}/docs`,
      environment: NODE_ENV,
      build: build.isLocalBuild
        ? null
        : {
            commit: build.commit,
            commitUrl: build.commitUrl,
            builtAt: build.builtAt,
            actionsRunUrl: build.actionsRunUrl,
            docker: build.docker,
            verify: build.verify,
          },
    });
  });

  it('is null for a local build with no CI provenance metadata', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.build).toBeNull();
  });
});
