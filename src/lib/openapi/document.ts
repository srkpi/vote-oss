import { OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { documentedRoutes } from '@/lib/openapi/routes';
import { registerSchemas } from '@/lib/openapi/schemas';

export function createOpenApiDocument(name = 'Vote OSS', version = '1.0.0') {
  const registry = new OpenAPIRegistry();
  registerSchemas(registry);
  for (const route of documentedRoutes) {
    registry.registerPath(route);
  }
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: { title: name, version },
  });
}
