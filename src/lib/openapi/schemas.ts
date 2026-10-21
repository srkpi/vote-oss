import './zod';

import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { componentSchemas, securitySchemes } from '@/lib/openapi/components';
import { faqCategoryBodySchema, faqItemBodySchema } from '@/lib/schemas/faq';
import { protocolBodySchema } from '@/lib/schemas/protocol';

const sharedRequestSchemas = {
  FaqCategoryCreateBody: faqCategoryBodySchema,
  FaqItemCreateBody: faqItemBodySchema,
  CreateProtocolBody: protocolBodySchema,
};

export type SchemaName = keyof typeof componentSchemas | keyof typeof sharedRequestSchemas;

export function registerSchemas(registry: OpenAPIRegistry) {
  for (const [name, schema] of Object.entries(componentSchemas)) {
    registry.registerComponent('schemas', name, schema);
  }
  for (const [name, schema] of Object.entries(sharedRequestSchemas)) {
    registry.register(name, schema);
  }
  for (const [name, schema] of Object.entries(securitySchemes)) {
    registry.registerComponent('securitySchemes', name, schema);
  }
}
