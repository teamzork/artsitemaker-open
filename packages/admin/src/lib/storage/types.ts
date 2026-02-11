/**
 * Storage Types and Interfaces
 * 
 * Defines the contract for different storage backends (local, R2, etc.)
 */

export interface ImageUrls {
  large: string;
  medium: string;
  small: string;
  thumb: string;
  original?: string;
}

export interface StorageConfig {
  type: 'local' | 'r2';

  // Local storage config
  local?: {
    filesPath: string;        // Where processed images are stored locally
    thumbnailsPath: string;   // Where thumbnails are stored
    publicUrl: string;        // Base URL for serving images (e.g., http://localhost:3001)
  };

  // R2 storage config  
  r2?: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;        // Custom domain (e.g., https://images.valerokanz.artistablinum.com)
    projectPrefix: string;    // Namespace for this project (e.g., "myportfolio")
  };
}

export interface ProcessedImage {
  slug: string;
  urls: ImageUrls;
  metadata: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

export interface StorageProvider {
  /**
   * Upload processed image variants to storage
   */
  uploadImages(slug: string, variants: ImageVariants): Promise<ImageUrls>;

  /**
   * Delete images for a given slug
   */
  deleteImages(slug: string): Promise<void>;

  /**
   * Check if images exist for a slug
   */
  imagesExist(slug: string): Promise<boolean>;

  /**
   * Get URLs for existing images
   */
  getImageUrls(slug: string): Promise<ImageUrls>;
}

export interface ImageVariants {
  large: Buffer;
  medium: Buffer;
  small: Buffer;
  thumb: Buffer;
  original?: Buffer;
}