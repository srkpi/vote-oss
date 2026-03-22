'use client';

import 'swagger-ui-react/swagger-ui.css';

import SwaggerUI from 'swagger-ui-react';

export default function DocsPage() {
  return <SwaggerUI url="/openapi.json" withCredentials />;
}
