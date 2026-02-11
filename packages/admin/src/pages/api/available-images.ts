import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getFilesPath, getImageBaseUrl, getImageStorageMode } from '../../lib/paths';
import { createR2ClientFromVault } from '../../lib/storage/r2-vault';
import { isAllowedImageExtension } from '../../lib/image-constants';

type ImageOption = {
  path: string;
  filename: string;
  variant: 'originals' | 'large';
  url?: string;
};

function isImageFile(filename: string): boolean {
  return isAllowedImageExtension(filename);
}

async function listLocalImages(): Promise<ImageOption[]> {
  const filesPath = getFilesPath();
  const variants: Array<'originals' | 'large'> = ['originals', 'large'];
  const results: ImageOption[] = [];

  for (const variant of variants) {
    const dirPath = path.join(filesPath, variant);
    if (!existsSync(dirPath)) {
      continue;
    }
    const entries = await fs.readdir(dirPath);
    for (const entry of entries) {
      if (!isImageFile(entry)) continue;
      results.push({
        path: `${variant}/${entry}`,
        filename: entry,
        variant
      });
    }
  }

  return results;
}

async function listR2Images(): Promise<ImageOption[]> {
  const clientResult = await createR2ClientFromVault({
    requireBucketName: true,
    requireProjectPrefix: true,
  });

  if (!clientResult.ok) {
    if (clientResult.reason === 'vault-uninitialized') {
      throw new Error('Secrets vault is not initialized.');
    }

    if (
      clientResult.reason === 'vault-locked' ||
      clientResult.reason === 'credentials-missing' ||
      clientResult.reason === 'credentials-incomplete'
    ) {
      throw new Error('Secrets vault is locked or R2 credentials are missing.');
    }

    throw new Error('R2 storage is not fully configured.');
  }

  const { client, config } = clientResult;
  const bucketName = config.bucketName;
  const projectPrefix = config.projectPrefix;

  const variants: Array<'originals' | 'large'> = ['originals', 'large'];
  const results: ImageOption[] = [];

  for (const variant of variants) {
    const prefix = `${projectPrefix}/${variant}/`;
    let continuationToken: string | undefined;

    do {
      const response = await client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken
      }));

      for (const item of response.Contents || []) {
        if (!item.Key) continue;
        if (!item.Key.startsWith(prefix)) continue;
        const filename = item.Key.slice(prefix.length);
        if (!filename || filename.includes('/')) continue;
        if (!isImageFile(filename)) continue;
        results.push({
          path: `${variant}/${filename}`,
          filename,
          variant
        });
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  return results;
}

export const GET: APIRoute = async () => {
  try {
    const storageMode = getImageStorageMode();
    let images: ImageOption[] = [];

    if (storageMode === 'local') {
      images = await listLocalImages();
    } else if (storageMode === 'r2') {
      images = await listR2Images();
    } else {
      images = [];
    }

    const baseUrl = getImageBaseUrl();
    const normalizedBaseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';

    images = images.map((image) => ({
      ...image,
      url: normalizedBaseUrl
        ? `${normalizedBaseUrl}/${image.path}`
        : `/${image.path.replace(/^\/+/, '')}`
    }));

    images.sort((a, b) => a.filename.localeCompare(b.filename));

    return new Response(JSON.stringify({ storage: storageMode, images }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to list images'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
