import { Client } from 'minio';
import type { Readable } from 'stream';

import {
  MINIO_ACCESS_KEY,
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_PUBLIC_BUCKET,
  MINIO_PUBLIC_URL_BASE,
  MINIO_SECRET_KEY,
  MINIO_USE_SSL,
} from '@/lib/config/server';

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = new Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
      pathStyle: true,
    });
  }
  return client;
}

function defaultPublicBase(): string {
  const protocol = MINIO_USE_SSL ? 'https' : 'http';
  const isStandardPort =
    (MINIO_USE_SSL && MINIO_PORT === 443) || (!MINIO_USE_SSL && MINIO_PORT === 80);
  const hostPart = isStandardPort ? MINIO_ENDPOINT : `${MINIO_ENDPOINT}:${MINIO_PORT}`;
  return `${protocol}://${hostPart}`;
}

export function publicUrl(bucket: string, objectKey: string): string {
  const base = (MINIO_PUBLIC_URL_BASE ?? defaultPublicBase()).replace(/\/+$/, '');
  const safeKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${base}/${bucket}/${safeKey}`;
}

export async function putObject(args: {
  bucket: string;
  objectKey: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await getClient().putObject(args.bucket, args.objectKey, args.body, args.body.length, {
    'Content-Type': args.contentType,
  });
}

export async function removeObject(bucket: string, objectKey: string): Promise<void> {
  await getClient().removeObject(bucket, objectKey);
}

export async function getObjectStream(bucket: string, objectKey: string): Promise<Readable> {
  return getClient().getObject(bucket, objectKey);
}

export const PUBLIC_BUCKET = MINIO_PUBLIC_BUCKET;
