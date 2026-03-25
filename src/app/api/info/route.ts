import { APP_NAME, APP_URL } from '@/lib/config/client';
import { APP_VERSION, NODE_ENV } from '@/lib/config/server';

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
 *                 version:
 *                   type: string
 *                   description: Current application version
 *                   example: 1.0.0
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
 */
export async function GET() {
  return Response.json({
    title: APP_NAME,
    version: APP_VERSION,
    url: APP_URL,
    docs: `${APP_URL}/docs`,
    environment: NODE_ENV,
  });
}
