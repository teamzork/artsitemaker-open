/**
 * Storage Diagnostics
 *
 * Provides a consistent view of storage configuration and vault state.
 */

import fs from 'fs/promises';
import path from 'path';
import {
  getFilesPath,
  getImageBaseUrl,
  getImageStorageMode,
  getR2BucketName,
  getR2ProjectPrefix,
  getR2PublicUrl,
  getSiteName,
  getThumbnailsPath,
  getRepoPath,
  getUserDataPath,
} from '../paths';
import {
  loadUserDataStructureSchema,
  validateUserDataStructure,
  type StructureIssue,
} from '../user-data-structure';
import { getR2VaultCredentials } from './r2-vault';
import { logStorageInfo } from './storage-logger';

export type VaultStatus =
  | 'ready'
  | 'vault-uninitialized'
  | 'vault-locked'
  | 'credentials-missing'
  | 'credentials-incomplete'
  | 'config-missing';

export type StorageDiagnostics = {
  timestamp: string;
  siteName: string;
  storageMode: 'local' | 'r2' | 'external';
  imageBaseUrl: string;
  userDataStructure: {
    valid: boolean;
    errors: StructureIssue[];
    warnings: StructureIssue[];
    summary: {
      errorCount: number;
      warningCount: number;
    };
  };
  local: {
    filesPath: string;
    thumbnailsPath: string;
    publicUrl: string;
    filesPathExists: boolean;
    thumbnailsPathExists: boolean;
    variantCounts: {
      originals: number;
      large: number;
      medium: number;
      small: number;
      thumbnails: number;
    };
  };
  r2: {
    bucketName: string;
    publicUrl: string;
    projectPrefix: string;
    configMissingFields: string[];
    vault: {
      status: VaultStatus;
      missingFields: string[];
    };
  };
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(path: string): Promise<number> {
  const exists = await pathExists(path);
  if (!exists) return 0;
  const entries = await fs.readdir(path);
  return entries.filter((entry) => !entry.startsWith('.')).length;
}

async function getLocalVariantCounts(filesPath: string, thumbnailsPath: string) {
  const [originals, large, medium, small, thumbnails] = await Promise.all([
    countFiles(`${filesPath}/originals`),
    countFiles(`${filesPath}/large`),
    countFiles(`${filesPath}/medium`),
    countFiles(`${filesPath}/small`),
    countFiles(thumbnailsPath),
  ]);

  return { originals, large, medium, small, thumbnails };
}

async function getUserDataStructureDiagnostics(): Promise<{
  valid: boolean;
  errors: StructureIssue[];
  warnings: StructureIssue[];
  summary: {
    errorCount: number;
    warningCount: number;
  };
}> {
  const repoRoot = getRepoPath();
  const userDataPath = getUserDataPath();
  if (!repoRoot) {
    return {
      valid: false,
      errors: [
        {
          level: 'error',
          code: 'missing-repo-root',
          message: 'Repository root is not available.',
          targetPath: userDataPath,
        },
      ],
      warnings: [],
      summary: { errorCount: 1, warningCount: 0 },
    };
  }

  const schemaPath = path.join(repoRoot, 'schemas/user-data.structure.yaml');
  try {
    const schema = loadUserDataStructureSchema(schemaPath);
    return validateUserDataStructure(userDataPath, schema);
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          level: 'error',
          code: 'schema-load-failed',
          message: error instanceof Error ? error.message : 'Failed to load schema.',
          targetPath: schemaPath,
        },
      ],
      warnings: [],
      summary: { errorCount: 1, warningCount: 0 },
    };
  }
}

export async function getStorageDiagnostics(): Promise<StorageDiagnostics> {
  const storageMode = getImageStorageMode();
  const siteName = getSiteName();
  const imageBaseUrl = getImageBaseUrl();

  const filesPath = getFilesPath();
  const thumbnailsPath = getThumbnailsPath();
  const localPublicUrl = process.env.LOCAL_IMAGES_URL || 'http://localhost:4322';
  const [filesPathExists, thumbnailsPathExists, variantCounts, userDataStructure] = await Promise.all([
    pathExists(filesPath),
    pathExists(thumbnailsPath),
    getLocalVariantCounts(filesPath, thumbnailsPath),
    getUserDataStructureDiagnostics(),
  ]);

  const bucketName = getR2BucketName();
  const publicUrl = getR2PublicUrl();
  const projectPrefix = getR2ProjectPrefix();

  const configMissingFields: string[] = [];
  if (!bucketName) configMissingFields.push('bucketName');
  if (!publicUrl) configMissingFields.push('publicUrl');

  const vaultResult = await getR2VaultCredentials();
  const vaultStatus: VaultStatus = vaultResult.ok ? 'ready' : vaultResult.reason;
  const vaultMissingFields = vaultResult.ok ? [] : vaultResult.missingFields ?? [];

  const diagnostics: StorageDiagnostics = {
    timestamp: new Date().toISOString(),
    siteName,
    storageMode,
    imageBaseUrl,
    userDataStructure,
    local: {
      filesPath,
      thumbnailsPath,
      publicUrl: localPublicUrl,
      filesPathExists,
      thumbnailsPathExists,
      variantCounts,
    },
    r2: {
      bucketName,
      publicUrl,
      projectPrefix,
      configMissingFields,
      vault: {
        status: vaultStatus,
        missingFields: vaultMissingFields,
      },
    },
  };

  logStorageInfo('storage-diagnostics-generated', {
    storageMode,
    vaultStatus,
    configMissingFields,
    bucketName: bucketName || null,
    publicUrl: publicUrl || null,
    projectPrefix,
  });

  return diagnostics;
}
