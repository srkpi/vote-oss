import { describe, it, expect } from 'vitest';

import { GET } from '@/app/api/info/route';
import { getBuildInfo } from '@/lib/build-info';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { NODE_ENV } from '@/lib/config/server';

describe('Requesting application information (GET /api/info)', () => {
  it('should return application identity and build information when requested', async () => {
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
            repo: build.repo,
            commitUrl: build.commitUrl,
            builtAt: build.builtAt,
            actionsRunUrl: build.actionsRunUrl,
            docker: build.docker,
            verify: build.verify,
          },
    });
  });

  it('should omit build provenance when the application was built without CI metadata', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.build).toBeNull();
  });
});
