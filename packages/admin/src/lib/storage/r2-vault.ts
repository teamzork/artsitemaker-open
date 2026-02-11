/**
 * R2 Vault Helpers
 *
 * All R2 clients that require credentials should source them from the secrets vault.
 */

import { getR2BucketName, getR2ProjectPrefix, getR2PublicUrl } from '../paths';
import { decryptWithSession, loadEncryptedSecrets } from '../secrets';
import type { StorageConfig } from './types';
import { createR2Client } from './r2-client';
import { logStorageInfo, logStorageWarning } from './storage-logger';

export type R2VaultFailureReason =
  | 'vault-uninitialized'
  | 'vault-locked'
  | 'credentials-missing'
  | 'credentials-incomplete'
  | 'config-missing';

export type R2VaultFailure = {
  ok: false;
  reason: R2VaultFailureReason;
  missingFields?: string[];
};

export type R2VaultCredentials = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type R2VaultConfig = NonNullable<StorageConfig['r2']>;

export type R2VaultCredentialsResult =
  | { ok: true; credentials: R2VaultCredentials }
  | R2VaultFailure;

export type R2VaultConfigResult =
  | { ok: true; config: R2VaultConfig }
  | R2VaultFailure;

export type R2VaultClientResult =
  | { ok: true; client: ReturnType<typeof createR2Client>; config: R2VaultConfig }
  | R2VaultFailure;

export type R2VaultConfigOptions = {
  requireBucketName?: boolean;
  requirePublicUrl?: boolean;
  requireProjectPrefix?: boolean;
};

export async function getR2VaultCredentials(): Promise<R2VaultCredentialsResult> {
  const encrypted = await loadEncryptedSecrets();
  if (!encrypted) {
    logStorageWarning('r2-vault-uninitialized');
    return { ok: false, reason: 'vault-uninitialized' };
  }

  const secrets = decryptWithSession(encrypted);
  if (!secrets) {
    logStorageWarning('r2-vault-locked');
    return { ok: false, reason: 'vault-locked' };
  }

  if (!secrets.r2) {
    logStorageWarning('r2-credentials-missing');
    return { ok: false, reason: 'credentials-missing' };
  }

  const missingFields: string[] = [];
  if (!secrets.r2.account_id) missingFields.push('account_id');
  if (!secrets.r2.access_key_id) missingFields.push('access_key_id');
  if (!secrets.r2.secret_access_key) missingFields.push('secret_access_key');

  if (missingFields.length > 0) {
    logStorageWarning('r2-credentials-incomplete', { missingFields });
    return {
      ok: false,
      reason: 'credentials-incomplete',
      missingFields,
    };
  }

  logStorageInfo('r2-credentials-loaded');
  return {
    ok: true,
    credentials: {
      accountId: secrets.r2.account_id,
      accessKeyId: secrets.r2.access_key_id,
      secretAccessKey: secrets.r2.secret_access_key,
    },
  };
}

export async function getR2VaultConfig(
  options: R2VaultConfigOptions = {}
): Promise<R2VaultConfigResult> {
  const credentialsResult = await getR2VaultCredentials();
  if (!credentialsResult.ok) {
    return credentialsResult;
  }

  const bucketName = getR2BucketName();
  const publicUrl = getR2PublicUrl();
  const projectPrefix = getR2ProjectPrefix();

  const missingFields: string[] = [];
  if (options.requireBucketName && !bucketName) missingFields.push('bucketName');
  if (options.requirePublicUrl && !publicUrl) missingFields.push('publicUrl');
  if (options.requireProjectPrefix && !projectPrefix) missingFields.push('projectPrefix');

  if (missingFields.length > 0) {
    logStorageWarning('r2-config-missing', { missingFields });
    return {
      ok: false,
      reason: 'config-missing',
      missingFields,
    };
  }

  logStorageInfo('r2-config-resolved', {
    bucketName,
    publicUrl,
    projectPrefix,
  });
  return {
    ok: true,
    config: {
      accountId: credentialsResult.credentials.accountId,
      accessKeyId: credentialsResult.credentials.accessKeyId,
      secretAccessKey: credentialsResult.credentials.secretAccessKey,
      bucketName,
      publicUrl,
      projectPrefix,
    },
  };
}

export async function createR2ClientFromVault(
  options: R2VaultConfigOptions = {}
): Promise<R2VaultClientResult> {
  const configResult = await getR2VaultConfig(options);
  if (!configResult.ok) {
    return configResult;
  }

  const client = createR2Client({
    accountId: configResult.config.accountId,
    accessKeyId: configResult.config.accessKeyId,
    secretAccessKey: configResult.config.secretAccessKey,
  });

  logStorageInfo('r2-client-created', {
    bucketName: configResult.config.bucketName,
    projectPrefix: configResult.config.projectPrefix,
  });
  return { ok: true, client, config: configResult.config };
}
