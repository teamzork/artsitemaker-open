/**
 * Storage Factory
 * 
 * Creates the appropriate storage provider based on configuration.
 * R2 credentials are loaded from the encrypted secrets vault.
 */

import type { StorageProvider, StorageConfig } from './types';
import { LocalStorageProvider } from './local-storage';
import { R2StorageProvider } from './r2-storage';
import { getImageStorageMode, getSiteName, getFilesPath, getThumbnailsPath } from '../paths';
import { getR2VaultConfig } from './r2-vault';
import { logStorageInfo, logStorageWarning } from './storage-logger';

/**
 * Load storage configuration from secrets vault and site config
 */
export async function loadStorageConfig(): Promise<StorageConfig> {
  const storageType = getImageStorageMode();

  logStorageInfo('storage-mode-resolved', { storageType });

  if (storageType === 'r2') {
    // R2 configuration: credentials from secrets vault, non-secret config from config files
    const r2Result = await getR2VaultConfig({
      requireBucketName: true,
      requirePublicUrl: true,
    });

    if (!r2Result.ok) {
      logStorageWarning('r2-config-invalid', {
        reason: r2Result.reason,
        missingFields: r2Result.missingFields ?? [],
      });
      switch (r2Result.reason) {
        case 'vault-uninitialized':
          throw new Error(
            'R2 storage requires secrets vault to be initialized. Please set up secrets in Admin > Configuration > Secrets.'
          );
        case 'vault-locked':
        case 'credentials-missing':
        case 'credentials-incomplete':
          throw new Error(
            'R2 credentials not found in secrets vault or session expired. Configure R2 credentials in Configuration > Secrets.'
          );
        case 'config-missing':
          throw new Error(
            'R2 storage requires: account_id, access_key_id, secret_access_key (in secrets vault), bucketName and publicUrl (in config)'
          );
        default:
          throw new Error('R2 storage configuration failed.');
      }
    }

    logStorageInfo('r2-config-loaded', {
      bucketName: r2Result.config.bucketName,
      publicUrl: r2Result.config.publicUrl,
      projectPrefix: r2Result.config.projectPrefix,
    });

    return {
      type: 'r2',
      r2: r2Result.config,
    };
  } else {
    // Local storage configuration
    const filesPath = getFilesPath();
    const thumbnailsPath = getThumbnailsPath();
    const publicUrl = process.env.LOCAL_IMAGES_URL || 'http://localhost:4322';

    logStorageInfo('local-config-loaded', {
      filesPath,
      thumbnailsPath,
      publicUrl,
    });

    return {
      type: 'local',
      local: {
        filesPath,
        thumbnailsPath,
        publicUrl,
      }
    };
  }
}

/**
 * Create storage provider instance (async)
 */
export async function createStorageProvider(): Promise<StorageProvider> {
  const config = await loadStorageConfig();

  switch (config.type) {
    case 'r2':
      return new R2StorageProvider(config);
    case 'local':
      return new LocalStorageProvider(config);
    default:
      throw new Error(`Unsupported storage type: ${(config as any).type}`);
  }
}

/**
 * Get current storage configuration (for debugging/info)
 */
export async function getStorageInfo() {
  const config = await loadStorageConfig();

  return {
    type: config.type,
    siteName: getSiteName(),
    ...(config.type === 'r2' ? {
      bucketName: config.r2?.bucketName,
      publicUrl: config.r2?.publicUrl,
      projectPrefix: config.r2?.projectPrefix,
    } : {
      filesPath: config.local?.filesPath,
      publicUrl: config.local?.publicUrl,
    })
  };
}
