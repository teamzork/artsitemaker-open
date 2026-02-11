/**
 * Cloudflare R2 Storage Provider
 * 
 * Handles image storage on Cloudflare R2 with multi-project support
 */

import { PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { StorageProvider, ImageUrls, ImageVariants, StorageConfig } from './types';
import { createR2Client } from './r2-client';

export class R2StorageProvider implements StorageProvider {
  private client: ReturnType<typeof createR2Client>;
  private config: NonNullable<StorageConfig['r2']>;
  
  constructor(config: StorageConfig) {
    if (!config.r2) {
      throw new Error('R2 storage config is required');
    }
    
    this.config = config.r2;
    
    // Initialize S3 client for R2
    this.client = createR2Client({
      accountId: this.config.accountId,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
    });
  }
  
  private getObjectKey(size: string, filename: string): string {
    return `${this.config.projectPrefix}/${size}/${filename}`;
  }
  
  async uploadImages(slug: string, variants: ImageVariants): Promise<ImageUrls> {
    const filename = `${slug}.webp`;
    const thumbFilename = `${slug}.png`;
    const originalFilename = variants.original ? `${slug}.jpg` : undefined;

    // Upload all variants in parallel
    const uploads = [
      this.uploadFile('large', filename, variants.large, 'image/webp'),
      this.uploadFile('medium', filename, variants.medium, 'image/webp'),
      this.uploadFile('small', filename, variants.small, 'image/webp'),
      this.uploadFile('thumbnails', thumbFilename, variants.thumb, 'image/png'),
    ];

    if (variants.original && originalFilename) {
      uploads.push(this.uploadFile('originals', originalFilename, variants.original, 'image/jpeg'));
    }

    await Promise.all(uploads);

    // Return URLs using custom domain
    const baseUrl = this.config.publicUrl.replace(/\/$/, '');

    return {
      large: `${baseUrl}/${this.getObjectKey('large', filename)}`,
      medium: `${baseUrl}/${this.getObjectKey('medium', filename)}`,
      small: `${baseUrl}/${this.getObjectKey('small', filename)}`,
      thumb: `${baseUrl}/${this.getObjectKey('thumbnails', thumbFilename)}`,
      ...(originalFilename ? {
        original: `${baseUrl}/${this.getObjectKey('originals', originalFilename)}`
      } : {})
    };
  }
  
  private async uploadFile(size: string, filename: string, buffer: Buffer, contentType: string): Promise<void> {
    const key = this.getObjectKey(size, filename);
    
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
    });
    
    await this.client.send(command);
  }
  
  async deleteImages(slug: string): Promise<void> {
    const filename = `${slug}.webp`;
    const thumbFilename = `${slug}.png`;

    // List of possible files to delete
    const keysToDelete = [
      this.getObjectKey('large', filename),
      this.getObjectKey('medium', filename),
      this.getObjectKey('small', filename),
      this.getObjectKey('thumbnails', thumbFilename),
      this.getObjectKey('originals', `${slug}.jpg`),
      this.getObjectKey('originals', `${slug}.png`),
      this.getObjectKey('originals', `${slug}.webp`),
    ];

    // Delete all files (ignore errors for missing files)
    await Promise.allSettled(
      keysToDelete.map(key =>
        this.client.send(new DeleteObjectCommand({
          Bucket: this.config.bucketName,
          Key: key,
        }))
      )
    );
  }
  
  async imagesExist(slug: string): Promise<boolean> {
    const filename = `${slug}.webp`;
    const key = this.getObjectKey('large', filename);
    
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }
  
  async getImageUrls(slug: string): Promise<ImageUrls> {
    const baseUrl = this.config.publicUrl.replace(/\/$/, '');
    const filename = `${slug}.webp`;
    const thumbFilename = `${slug}.png`;

    return {
      large: `${baseUrl}/${this.getObjectKey('large', filename)}`,
      medium: `${baseUrl}/${this.getObjectKey('medium', filename)}`,
      small: `${baseUrl}/${this.getObjectKey('small', filename)}`,
      thumb: `${baseUrl}/${this.getObjectKey('thumbnails', thumbFilename)}`,
    };
  }
}
