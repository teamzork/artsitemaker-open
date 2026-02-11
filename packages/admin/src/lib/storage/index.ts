/**
 * Storage Module Exports
 */

export type { 
  StorageProvider, 
  StorageConfig, 
  ImageUrls, 
  ImageVariants, 
  ProcessedImage 
} from './types';

export { LocalStorageProvider } from './local-storage';
export { R2StorageProvider } from './r2-storage';
export { 
  createStorageProvider, 
  loadStorageConfig, 
  getStorageInfo 
} from './storage-factory';