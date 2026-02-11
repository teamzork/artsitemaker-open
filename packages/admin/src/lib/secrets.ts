// packages/admin/src/lib/secrets.ts
// AES-256-GCM encryption with PBKDF2 key derivation for secrets management

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { getContentPath } from './paths';

const ENCRYPTION_VERSION = '1.0';
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha512';

const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds
const PERSISTED_SESSION_TTL = 60 * 60 * 1000; // 1 hour TTL for persisted sessions

export const SECRETS_VALIDATION_MESSAGES = [
  {
    key: 'vault_locked',
    message: 'Secrets vault is locked. Unlock it in Configuration first.',
  },
  {
    key: 'vault_not_found',
    message: 'Secrets vault not found',
  },
  {
    key: 'cloudflare_token_missing',
    message: 'Cloudflare API token missing or invalid',
  },
] as const;

export type SecretsValidationMessageKey = (typeof SECRETS_VALIDATION_MESSAGES)[number]['key'];

export function getSecretsValidationMessage(key: SecretsValidationMessageKey): string {
  const entry = SECRETS_VALIDATION_MESSAGES.find((item) => item.key === key);
  return entry?.message ?? 'Unknown error';
}

export interface SessionPersistenceConfig {
  enabled: boolean;
}

export interface PersistedSession {
  encryptedKey: string;
  iv: string;
  authTag: string;
  salt: string;
  expiresAt: number;
}

export interface SecretsData {
  encryption_version: string;
  auth?: {
    type: 'none' | 'password' | 'github';
    password_hash?: string;
    github_client_id?: string;
    github_client_secret?: string;
  };
  r2?: {
    account_id: string;
    access_key_id: string;
    secret_access_key: string;
  };
  deployment?: {
    type: 'static' | 'ftp' | 'sftp' | 'git';
    ftp_host?: string;
    ftp_user?: string;
    ftp_password?: string;
    github_token?: string;
    deploy_repo?: string;
  };
  cloudflare?: {
    account_id: string;
    api_token: string;
  };
}

export interface EncryptedSecrets {
  version: string;
  salt: string;
  iv: string;
  authTag: string;
  data: string;
  masterPasswordHash: string;
}

interface SecretSession {
  derivedKey: Buffer;
  unlockedAt: number;
}

let activeSession: SecretSession | null = null;

function getSessionPersistenceConfigPath(): string {
  const contentPath = getContentPath();
  return path.join(contentPath, 'configuration', '.session-persistence.json');
}

function getPersistedSessionPath(): string {
  const contentPath = getContentPath();
  return path.join(contentPath, 'configuration', '.persisted-session.enc');
}


const MACHINE_SECRET = (() => {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  return pbkdf2Sync(`${hostname}:${platform}:${arch}:artsitemaker-session`, 'artsitemaker-salt', 10000, 32, 'sha256');
})();

export async function getSessionPersistenceEnabled(): Promise<boolean> {
  try {
    const content = await fs.readFile(getSessionPersistenceConfigPath(), 'utf8');
    const config: SessionPersistenceConfig = JSON.parse(content);
    return config.enabled === true;
  } catch {
    return false;
  }
}

export async function setSessionPersistenceEnabled(enabled: boolean): Promise<void> {
  const configPath = getSessionPersistenceConfigPath();
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });

  const config: SessionPersistenceConfig = { enabled };
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

  if (!enabled) {
    await clearPersistedSession();
  }
}

async function persistSession(): Promise<void> {
  if (!activeSession) return;

  const enabled = await getSessionPersistenceEnabled();
  if (!enabled) return;

  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);

  const cipher = createCipheriv(ALGORITHM, MACHINE_SECRET, iv);

  let encrypted = cipher.update(activeSession.derivedKey.toString('hex'), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  const persisted: PersistedSession = {
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
    expiresAt: Date.now() + PERSISTED_SESSION_TTL
  };

  const filePath = getPersistedSessionPath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(persisted, null, 2), 'utf8');
}

async function loadPersistedSession(): Promise<boolean> {
  try {
    const enabled = await getSessionPersistenceEnabled();
    if (!enabled) return false;

    const content = await fs.readFile(getPersistedSessionPath(), 'utf8');
    const persisted: PersistedSession = JSON.parse(content);

    if (Date.now() > persisted.expiresAt) {
      await clearPersistedSession();
      return false;
    }

    const iv = Buffer.from(persisted.iv, 'hex');
    const authTag = Buffer.from(persisted.authTag, 'hex');

    const decipher = createDecipheriv(ALGORITHM, MACHINE_SECRET, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(persisted.encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const derivedKey = Buffer.from(decrypted, 'hex');

    activeSession = {
      derivedKey,
      unlockedAt: Date.now()
    };

    console.log('[Secrets] Restored persisted session');
    return true;
  } catch {
    return false;
  }
}

export async function clearPersistedSession(): Promise<void> {
  try {
    await fs.unlink(getPersistedSessionPath());
  } catch {
    // File may not exist
  }
}

function getSecretsFilePath(): string {
  const contentPath = getContentPath();
  return path.join(contentPath, 'configuration', 'secrets.yaml.enc');
}

function getMasterPasswordHashPath(): string {
  const contentPath = getContentPath();
  return path.join(contentPath, 'configuration', '.master-password-hash');
}


export function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

export function hashMasterPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyMasterPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  const actualHash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');

  return actualHash.equals(expectedHash);
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

export function encrypt(data: SecretsData, password: string): EncryptedSecrets {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const jsonData = JSON.stringify(data);

  let encrypted = cipher.update(jsonData, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    version: ENCRYPTION_VERSION,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted,
    masterPasswordHash: hashMasterPassword(password)
  };
}

export function decrypt(encrypted: EncryptedSecrets, password: string): SecretsData {
  const salt = Buffer.from(encrypted.salt, 'hex');
  const iv = Buffer.from(encrypted.iv, 'hex');
  const authTag = Buffer.from(encrypted.authTag, 'hex');

  const key = deriveKey(password, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

export function decryptWithSession(encrypted: EncryptedSecrets): SecretsData | null {
  if (!activeSession) return null;
  if (!isSessionValid()) {
    clearSession();
    return null;
  }

  const salt = Buffer.from(encrypted.salt, 'hex');
  const iv = Buffer.from(encrypted.iv, 'hex');
  const authTag = Buffer.from(encrypted.authTag, 'hex');

  const decipher = createDecipheriv(ALGORITHM, activeSession.derivedKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

export function encryptWithSession(data: SecretsData, existingEncrypted: EncryptedSecrets): EncryptedSecrets | null {
  if (!activeSession) return null;
  if (!isSessionValid()) {
    clearSession();
    return null;
  }

  const salt = Buffer.from(existingEncrypted.salt, 'hex');
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, activeSession.derivedKey, iv);
  const jsonData = JSON.stringify(data);

  let encrypted = cipher.update(jsonData, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    ...existingEncrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted
  };
}

export async function unlockSecrets(password: string, encrypted: EncryptedSecrets): Promise<boolean> {
  try {
    const salt = Buffer.from(encrypted.salt, 'hex');
    const key = deriveKey(password, salt);

    const iv = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    decipher.update(encrypted.data, 'hex', 'utf8');
    decipher.final('utf8');

    activeSession = {
      derivedKey: key,
      unlockedAt: Date.now()
    };

    await persistSession();

    return true;
  } catch {
    return false;
  }
}

export function isSessionValid(): boolean {
  if (!activeSession) return false;
  return Date.now() - activeSession.unlockedAt < SESSION_TIMEOUT;
}

export function getSessionTimeRemaining(): number {
  if (!activeSession) return 0;
  const remaining = SESSION_TIMEOUT - (Date.now() - activeSession.unlockedAt);
  return Math.max(0, remaining);
}

export function refreshSession(): void {
  if (activeSession) {
    activeSession.unlockedAt = Date.now();
  }
}

export function clearSession(): void {
  if (activeSession) {
    activeSession.derivedKey.fill(0);
  }
  activeSession = null;
}

export async function clearSessionAndPersisted(): Promise<void> {
  clearSession();
  await clearPersistedSession();
}

export async function resetSecrets(): Promise<{ hadSecrets: boolean }> {
  const hadSecrets = await secretsFileExists();
  await clearSessionAndPersisted();

  const targets = [getSecretsFilePath(), getMasterPasswordHashPath()];
  await Promise.all(
    targets.map(async (target) => {
      try {
        await fs.unlink(target);
      } catch {
        // Ignore missing files
      }
    }),
  );

  return { hadSecrets };
}

export async function tryRestorePersistedSession(): Promise<boolean> {
  if (activeSession && isSessionValid()) {
    return true;
  }
  return loadPersistedSession();
}

export async function secretsFileExists(): Promise<boolean> {
  try {
    await fs.access(getSecretsFilePath());
    return true;
  } catch {
    return false;
  }
}

export async function loadEncryptedSecrets(): Promise<EncryptedSecrets | null> {
  try {
    const content = await fs.readFile(getSecretsFilePath(), 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function saveEncryptedSecrets(encrypted: EncryptedSecrets): Promise<void> {
  const filePath = getSecretsFilePath();
  const dir = path.dirname(filePath);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(encrypted, null, 2), 'utf8');
}

export async function initializeSecrets(masterPassword: string): Promise<{ success: boolean; error?: string }> {
  const validation = validatePasswordStrength(masterPassword);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  const exists = await secretsFileExists();
  if (exists) {
    return { success: false, error: 'Secrets file already exists' };
  }

  const initialData: SecretsData = {
    encryption_version: ENCRYPTION_VERSION
  };

  const encrypted = encrypt(initialData, masterPassword);
  await saveEncryptedSecrets(encrypted);

  const salt = Buffer.from(encrypted.salt, 'hex');
  activeSession = {
    derivedKey: deriveKey(masterPassword, salt),
    unlockedAt: Date.now()
  };

  await persistSession();

  return { success: true };
}

export async function getSecretsStatus(): Promise<{
  initialized: boolean;
  unlocked: boolean;
  sessionTimeRemaining: number;
  persistenceEnabled: boolean;
}> {
  const exists = await secretsFileExists();

  if (!isSessionValid()) {
    await tryRestorePersistedSession();
  }

  const persistenceEnabled = await getSessionPersistenceEnabled();

  return {
    initialized: exists,
    unlocked: isSessionValid(),
    sessionTimeRemaining: getSessionTimeRemaining(),
    persistenceEnabled
  };
}

export function createEmptySecrets(): SecretsData {
  return {
    encryption_version: ENCRYPTION_VERSION
  };
}

export function maskSecret(value: string | undefined): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return value.slice(0, 2) + '*'.repeat(Math.min(value.length - 4, 10)) + value.slice(-2);
}
