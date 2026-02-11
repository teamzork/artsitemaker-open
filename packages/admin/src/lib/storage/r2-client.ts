/**
 * R2 Client Helper
 *
 * Centralizes S3 client initialization for R2 to keep credential handling consistent.
 */

import { S3Client } from '@aws-sdk/client-s3';
import type { StorageConfig } from './types';

type R2ClientConfig = Pick<
  NonNullable<StorageConfig['r2']>,
  'accountId' | 'accessKeyId' | 'secretAccessKey'
>;

export function createR2Client(config: R2ClientConfig): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
