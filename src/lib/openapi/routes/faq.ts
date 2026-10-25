import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const faqRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/faq',
    summary: 'List all FAQ categories with their items',
    description:
      "Public endpoint – no authentication required. Returns the full FAQ tree ordered by category position, with each category's items ordered by item position. Results are served from cache when available.\n",
    tags: ['FAQ'],
    responses: {
      '200': jsonResponse('Array of FAQ categories', {
        type: 'array',
        items: schemaRef('FaqCategory'),
      }),
    },
  },
  {
    method: 'post',
    path: '/api/faq',
    summary: 'Create a FAQ category',
    description:
      'Creates a new FAQ category appended at the end of the existing order. Restricted to admins with the `manage_faq` permission.\n',
    tags: ['FAQ'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('FaqCategoryCreateBody') } },
      },
    },
    responses: {
      '201': jsonResponse('Category created', schemaRef('FaqCategoryMeta')),
      '400': { description: 'Missing or invalid title' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – admin does not have FAQ management rights' },
    },
  },
  {
    method: 'put',
    path: '/api/faq/items/{id}',
    summary: 'Update a FAQ item',
    description:
      'Replaces the title and content of an existing FAQ item. Content must be a valid serialised Quill Delta JSON string. Requires the `manage_faq` permission.\n',
    tags: ['FAQ'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ param: { description: 'FAQ item ID' } }) }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('FaqItemCreateBody') } },
      },
    },
    responses: {
      '200': jsonResponse('Item updated', schemaRef('FaqItem')),
      '400': { description: 'Validation error' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Item not found' },
    },
  },
  {
    method: 'delete',
    path: '/api/faq/items/{id}',
    summary: 'Delete a FAQ item',
    description:
      'Permanently deletes the specified FAQ item. Requires the `manage_faq` permission.',
    tags: ['FAQ'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ param: { description: 'FAQ item ID' } }) }),
    },
    responses: {
      '204': { description: 'Item deleted' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Item not found' },
    },
  },
  {
    method: 'put',
    path: '/api/faq/categories/{id}',
    summary: 'Update a FAQ category title',
    description: 'Renames the specified FAQ category. Requires the `manage_faq` permission.',
    tags: ['FAQ'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ param: { description: 'FAQ category ID' } }) }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('FaqCategoryCreateBody') } },
      },
    },
    responses: {
      '200': jsonResponse('Category updated', schemaRef('FaqCategoryMeta')),
      '400': { description: 'Missing or invalid title' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Category not found' },
    },
  },
  {
    method: 'delete',
    path: '/api/faq/categories/{id}',
    summary: 'Delete a FAQ category',
    description:
      'Permanently deletes the category and all its items. Requires the `manage_faq` permission.',
    tags: ['FAQ'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ param: { description: 'FAQ category ID' } }) }),
    },
    responses: {
      '204': { description: 'Category deleted' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Category not found' },
    },
  },
  {
    method: 'post',
    path: '/api/faq/categories/{id}/items',
    summary: 'Add a FAQ item to a category',
    description:
      "Creates a new FAQ item appended at the end of the category's item list. Content must be a valid serialised Quill Delta JSON string. Requires the `manage_faq` permission.\n",
    tags: ['FAQ'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ param: { description: 'FAQ category ID' } }) }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('FaqItemCreateBody') } },
      },
    },
    responses: {
      '201': jsonResponse('Item created', schemaRef('FaqItem')),
      '400': { description: 'Validation error (missing fields, invalid Delta, content too long)' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Category not found' },
    },
  },
  {
    method: 'patch',
    path: '/api/faq/categories/{id}/items/reorder',
    summary: 'Reorder FAQ items within a category',
    description:
      'Accepts a complete ordered array of item IDs belonging to the category and updates their `position` values atomically. Requires the `manage_faq` permission.\n',
    tags: ['FAQ'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ param: { description: 'FAQ category ID' } }) }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['order'],
              properties: {
                order: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Complete ordered list of item IDs for this category',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '204': { description: 'Items reordered' },
      '400': { description: 'Invalid order array or IDs not belonging to this category' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Category not found' },
    },
  },
  {
    method: 'patch',
    path: '/api/faq/categories/reorder',
    summary: 'Reorder FAQ categories',
    description:
      'Accepts a complete ordered array of category IDs and updates their `position` values atomically. Requires the `manage_faq` permission.\n',
    tags: ['FAQ'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['order'],
              properties: {
                order: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Complete ordered list of all category IDs',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '204': { description: 'Categories reordered' },
      '400': { description: 'Invalid order array or unknown category IDs' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
    },
  },
];
