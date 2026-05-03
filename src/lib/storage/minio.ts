import { Client } from 'minio';

import {
  MINIO_ACCESS_KEY,
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_PUBLIC_BUCKET,
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

export const PUBLIC_BUCKET = MINIO_PUBLIC_BUCKET;
