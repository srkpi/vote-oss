import { getBuildInfo } from '@/lib/build-info';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { NODE_ENV } from '@/lib/config/server';

export async function GET() {
  const build = getBuildInfo();

  return Response.json({
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
}
