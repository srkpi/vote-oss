import { getBuildInfo } from '@/lib/build-info';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { NODE_ENV } from '@/lib/config/server';

/**
 * @swagger
 * /api/info:
 *   get:
 *     summary: Application info
 *     description: Returns general information about the application.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Application info retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   description: The application name
 *                   example: MyApp
 *                 url:
 *                   type: string
 *                   description: Base URL of the application
 *                   example: https://example.com
 *                 docs:
 *                   type: string
 *                   description: URL to the API documentation
 *                   example: https://example.com/docs
 *                 environment:
 *                   type: string
 *                   description: Current runtime environment
 *                   example: development
 *                 build:
 *                   type: object
 *                   nullable: true
 *                   description: >
 *                     Build provenance metadata for the running image, or
 *                     null for local builds not produced by CI. `verify`
 *                     contains ready-to-run commands that let anyone
 *                     independently confirm this image was built by this
 *                     project's official GitHub Actions workflow from the
 *                     referenced commit, AND that the files this domain is
 *                     actually serving right now match that same build —
 *                     see scripts/verify-deployment.cjs and the BuildInfo
 *                     component.
 *                   properties:
 *                     commit:
 *                       type: string
 *                       example: a1b2c3d4e5f60718293a4b5c6d7e8f9012345678
 *                     repo:
 *                       type: string
 *                       example: srkpi/vote-oss
 *                     commitUrl:
 *                       type: string
 *                       example: https://github.com/srkpi/vote-oss/commit/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678
 *                     builtAt:
 *                       type: string
 *                       example: 2026-08-20T10:00:00Z
 *                     actionsRunUrl:
 *                       type: string
 *                       example: https://github.com/srkpi/vote-oss/actions/runs/123456789
 *                     docker:
 *                       type: object
 *                       properties:
 *                         reference:
 *                           type: string
 *                           example: sckpi/vote-oss:sha-a1b2c3d
 *                         hubUrl:
 *                           type: string
 *                     verify:
 *                       type: object
 *                       properties:
 *                         inspect:
 *                           type: string
 *                           example: docker buildx imagetools inspect sckpi/vote-oss:sha-a1b2c3d
 *                         attest:
 *                           type: string
 *                           example: gh attestation verify oci://docker.io/sckpi/vote-oss:sha-a1b2c3d --repo srkpi/vote-oss
 *                         scriptUrl:
 *                           type: string
 *                           description: Raw URL of the verification script, pinned to this exact commit.
 *                           example: https://raw.githubusercontent.com/srkpi/vote-oss/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678/scripts/verify-deployment.cjs
 *                         scriptCommand:
 *                           type: string
 *                           description: One-liner shell command for Unix-like environments to verify deployment.
 *                           example: curl -fsSL https://raw.githubusercontent.com/srkpi/vote-oss/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678/scripts/verify-deployment.cjs | node - https://voteoss.kpi.ua
 *                         scriptCommandWindows:
 *                           type: string
 *                           description: One-liner command for Windows PowerShell environments to verify deployment.
 *                           example: (Invoke-RestMethod -Uri https://raw.githubusercontent.com/srkpi/vote-oss/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678/scripts/verify-deployment.cjs | node - https://voteoss.kpi.ua
 */
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
