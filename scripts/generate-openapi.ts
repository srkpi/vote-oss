import fs from 'node:fs';
import path from 'node:path';

import { createOpenApiDocument } from '../src/lib/openapi/document';

const spec = createOpenApiDocument(
  process.env.NEXT_PUBLIC_APP_NAME ?? 'Vote OSS',
  process.env.npm_package_version ?? '1.0.0',
);
const outputPath = path.join(process.cwd(), 'public', 'openapi.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(spec));
console.log('✅ OpenAPI spec generated at public/openapi.json');
