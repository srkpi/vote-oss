import type { ResponseConfig, ZodMediaTypeObject } from '@asteasolutions/zod-to-openapi';

import type { SchemaName } from '@/lib/openapi/schemas';

export function schemaRef(name: SchemaName) {
  return { $ref: `#/components/schemas/${name}` };
}

export function jsonResponse(
  description: string,
  schema: NonNullable<ZodMediaTypeObject['schema']>,
): ResponseConfig {
  return { description, content: { 'application/json': { schema } } };
}
