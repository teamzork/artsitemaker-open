/**
 * R2 Sync Helper Functions
 * 
 * Utilities for syncing local images to Cloudflare R2
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import {
  getUserDataPath,
  getFilesPath,
  getThumbnailsPath,
  getImageStorageMode,
  getR2BucketName,
  getR2PublicUrl,
} from './paths';
import type { ImageVariants } from './storage/types';

export interface ArtworkSlug {
  slug: string;
  hasOriginal: boolean;
}

export interface SyncProgress {
  current: number;
  total: number;
  slug: string;
  status: 'uploading' | 'success' | 'error';
  message?: string;
}

export interface SyncResult {
  uploaded: number;
  failed: number;
  errors: Array<{ slug: string; error: string }>;
}

export interface R2ConfigStatus {
  configured: boolean;
  storageMode: 'local' | 'r2' | 'external';
  missingFields: string[];
}

/**
 * Check if R2 storage is configured (non-secret settings only)
 * Note: Credentials are checked separately from the Secrets Vault
 * Returns detailed status including which fields are missing
 */
export function checkR2Configuration(): R2ConfigStatus {
  const storageMode = getImageStorageMode();
  const missingFields: string[] = [];

  if (storageMode !== 'r2') {
    return {
      configured: false,
      storageMode,
      missingFields: ['imageStorage (must be set to "r2")'],
    };
  }

  const bucketName = getR2BucketName();
  const publicUrl = getR2PublicUrl();

  if (!bucketName) missingFields.push('r2.bucketName (Configuration)');
  if (!publicUrl) missingFields.push('r2.publicUrl (Configuration)');

  return {
    configured: missingFields.length === 0,
    storageMode,
    missingFields,
  };
}

/**
 * Read all artwork slugs from local storage
 */
export async function getAllArtworkSlugs(): Promise<ArtworkSlug[]> {
  const userDataPath = getUserDataPath();
  const artworksDir = path.join(userDataPath, 'artworks');

  try {
    const files = await fs.readdir(artworksDir);
    const yamlFiles = files.filter((f) => f.endsWith('.yaml'));

    const slugs: ArtworkSlug[] = [];

    for (const file of yamlFiles) {
      const slug = path.basename(file, '.yaml');
      const artworkPath = path.join(artworksDir, file);

      try {
        const content = await fs.readFile(artworkPath, 'utf-8');
        const artwork = yaml.load(content) as any;

        // Check if artwork has an image file
        const hasOriginal = await checkImageExists(slug);

        slugs.push({
          slug: artwork.slug || slug,
          hasOriginal,
        });
      } catch (e) {
        // Skip files that can't be read
        console.warn(`Failed to read artwork: ${file}`, e);
      }
    }

    return slugs;
  } catch (e) {
    console.error('Failed to read artworks directory:', e);
    return [];
  }
}

/**
 * Check if image files exist for a given slug
 */
export async function checkImageExists(slug: string): Promise<boolean> {
  const filesPath = getFilesPath();
  const largePath = path.join(filesPath, 'large', `${slug}.webp`);

  try {
    await fs.access(largePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read image buffers from local filesystem for a given slug
 * Returns null if required files are missing
 */
export async function readImageVariants(slug: string): Promise<ImageVariants | null> {
  const filesPath = getFilesPath();
  const thumbnailsPath = getThumbnailsPath();

  const paths = {
    large: path.join(filesPath, 'large', `${slug}.webp`),
    medium: path.join(filesPath, 'medium', `${slug}.webp`),
    small: path.join(filesPath, 'small', `${slug}.webp`),
    thumb: path.join(thumbnailsPath, `${slug}.png`),
    original: path.join(filesPath, 'originals', `${slug}.jpg`),
  };

  try {
    // Read all variants in parallel
    const [large, medium, small, thumb] = await Promise.all([
      fs.readFile(paths.large),
      fs.readFile(paths.medium),
      fs.readFile(paths.small),
      fs.readFile(paths.thumb),
    ]);

    // Original is optional
    let original: Buffer | undefined;
    try {
      original = await fs.readFile(paths.original);
    } catch {
      // Original doesn't exist, that's ok
    }

    return {
      large,
      medium,
      small,
      thumb,
      ...(original ? { original } : {}),
    };
  } catch (e) {
    console.error(`Failed to read image variants for ${slug}:`, e);
    return null;
  }
}

/**
 * Get the count of images to sync
 */
export async function getSyncStats(): Promise<{
  total: number;
  withImages: number;
  withoutImages: number;
}> {
  const slugs = await getAllArtworkSlugs();
  const withImages = slugs.filter((s) => s.hasOriginal).length;

  return {
    total: slugs.length,
    withImages,
    withoutImages: slugs.length - withImages,
  };
}
