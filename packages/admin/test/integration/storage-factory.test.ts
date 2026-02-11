import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadStorageConfig } from '../../src/lib/storage/storage-factory';

let storageMode: 'local' | 'r2' = 'local';
let bucketName = 'test-bucket';
let publicUrl = 'https://r2.example';
let projectPrefix = 'test-project';
let encryptedSecrets: Record<string, unknown> | null = null;
let decryptedSecrets: {
  r2?: {
    account_id?: string;
    access_key_id?: string;
    secret_access_key?: string;
  };
} | null = null;

vi.mock('../../src/lib/paths', () => ({
  getImageStorageMode: () => storageMode,
  getR2BucketName: () => bucketName,
  getR2PublicUrl: () => publicUrl,
  getR2ProjectPrefix: () => projectPrefix,
  getFilesPath: () => '/test/files',
  getThumbnailsPath: () => '/test/thumbnails',
  getSiteName: () => 'Test Site',
}));

vi.mock('../../src/lib/secrets', () => ({
  loadEncryptedSecrets: async () => encryptedSecrets,
  decryptWithSession: () => decryptedSecrets,
}));

describe('Storage Factory (R2 Vault Guardrails)', () => {
  beforeEach(() => {
    storageMode = 'r2';
    bucketName = 'test-bucket';
    publicUrl = 'https://r2.example';
    projectPrefix = 'test-project';
    encryptedSecrets = { version: '1.0' };
    decryptedSecrets = {
      r2: {
        account_id: 'acct',
        access_key_id: 'access',
        secret_access_key: 'secret',
      },
    };
  });

  it('requires secrets vault to be initialized for R2 storage', async () => {
    encryptedSecrets = null;
    decryptedSecrets = null;

    await expect(loadStorageConfig()).rejects.toThrow(
      'R2 storage requires secrets vault to be initialized. Please set up secrets in Admin > Configuration > Secrets.'
    );
  });

  it('requires vault credentials even when non-secret config exists', async () => {
    decryptedSecrets = null;

    await expect(loadStorageConfig()).rejects.toThrow(
      'R2 credentials not found in secrets vault or session expired. Please unlock secrets and configure R2 credentials in Admin > Configuration.'
    );
  });

  it('uses vault credentials for R2 config', async () => {
    const config = await loadStorageConfig();

    expect(config.type).toBe('r2');
    expect(config.r2?.accountId).toBe('acct');
    expect(config.r2?.accessKeyId).toBe('access');
    expect(config.r2?.secretAccessKey).toBe('secret');
    expect(config.r2?.bucketName).toBe('test-bucket');
    expect(config.r2?.publicUrl).toBe('https://r2.example');
    expect(config.r2?.projectPrefix).toBe('test-project');
  });

  it('requires bucketName and publicUrl in config for R2 storage', async () => {
    bucketName = '';
    publicUrl = '';

    await expect(loadStorageConfig()).rejects.toThrow(
      'R2 storage requires: account_id, access_key_id, secret_access_key (in secrets vault), bucketName and publicUrl (in config)'
    );
  });
});
