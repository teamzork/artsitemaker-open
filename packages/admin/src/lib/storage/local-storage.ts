/**
 * Local Storage Provider
 * 
 * Handles image storage on local filesystem with configurable paths
 */

import fs from 'fs/promises';
import path from 'path';
import type { StorageProvider, ImageUrls, ImageVariants, StorageConfig } from './types';

export class LocalStorageProvider implements StorageProvider {
  private config: NonNullable<StorageConfig['local']>;
  
  constructor(config: StorageConfig) {
    if (!config.local) {
      throw new Error('Local storage config is required');
    }
    this.config = config.local;
  }
  
  async uploadImages(slug: string, variants: ImageVariants): Promise<ImageUrls> {
    const { filesPath, thumbnailsPath, publicUrl } = this.config;
    
    // Ensure directories exist
    const dirs = ['large', 'medium', 'small'];
    if (variants.original) {
      dirs.push('originals');
    }
    
    // Create image directories
    for (const dir of dirs) {
      const dirPath = path.join(filesPath, dir);
      await fs.mkdir(dirPath, { recursive: true });
    }

    // Create thumbnails directory
    await fs.mkdir(thumbnailsPath, { recursive: true });
    
    // Write image files
    const filename = `${slug}.webp`;
    const originalFilename = variants.original ? `${slug}.jpg` : undefined;
    
    await Promise.all([
      fs.writeFile(path.join(filesPath, 'large', filename), variants.large),
      fs.writeFile(path.join(filesPath, 'medium', filename), variants.medium),
      fs.writeFile(path.join(filesPath, 'small', filename), variants.small),
      fs.writeFile(path.join(thumbnailsPath, `${slug}.png`), variants.thumb),
      ...(variants.original && originalFilename ? [
        fs.writeFile(path.join(filesPath, 'originals', originalFilename), variants.original)
      ] : [])
    ]);
    
    // Return URLs
    const baseUrl = publicUrl.replace(/\/$/, ''); // Remove trailing slash
    
    return {
      large: `${baseUrl}/large/${filename}`,
      medium: `${baseUrl}/medium/${filename}`,
      small: `${baseUrl}/small/${filename}`,
      thumb: `${baseUrl}/thumbnails/${slug}.png`,
      ...(originalFilename ? { original: `${baseUrl}/originals/${originalFilename}` } : {})
    };
  }
  
  async deleteImages(slug: string): Promise<void> {
    const { filesPath, thumbnailsPath } = this.config;
    const filename = `${slug}.webp`;
    
    const filesToDelete = [
      path.join(filesPath, 'large', filename),
      path.join(filesPath, 'medium', filename),
      path.join(filesPath, 'small', filename),
      path.join(thumbnailsPath, `${slug}.png`),
      path.join(filesPath, 'originals', `${slug}.jpg`), // Try both extensions
      path.join(filesPath, 'originals', `${slug}.png`),
      path.join(filesPath, 'originals', `${slug}.webp`)
    ];
    
    // Delete files that exist (ignore errors for missing files)
    await Promise.allSettled(
      filesToDelete.map(filePath => fs.unlink(filePath))
    );
  }
  
  async imagesExist(slug: string): Promise<boolean> {
    const { filesPath } = this.config;
    const filename = `${slug}.webp`;
    const largePath = path.join(filesPath, 'large', filename);
    
    try {
      await fs.access(largePath);
      return true;
    } catch {
      return false;
    }
  }
  
  async getImageUrls(slug: string): Promise<ImageUrls> {
    const { publicUrl } = this.config;
    const baseUrl = publicUrl.replace(/\/$/, '');
    const filename = `${slug}.webp`;
    
    return {
      large: `${baseUrl}/large/${filename}`,
      medium: `${baseUrl}/medium/${filename}`,
      small: `${baseUrl}/small/${filename}`,
      thumb: `${baseUrl}/thumbnails/${slug}.png`
    };
  }
}