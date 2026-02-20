// packages/admin/src/lib/auth.ts
// Multi-method authentication: none, basic (password), email (Neon DB), GitHub OAuth

import { GitHub } from 'arctic';
import fs from 'fs';
import yaml from 'js-yaml';
import crypto from 'crypto';
import { getProjectConfigPath } from './config-paths';
import { validateSession, isEmailAuthConfigured } from './db-auth';

// ── Auth Method Resolution ──────────────────────────────────────────────────

export type AuthMethod = 'none' | 'basic' | 'email' | 'github';

interface AuthConfig {
  method: AuthMethod;
  basic?: {
    username?: string;
    passwordHash?: string;
    passwordHint?: string;
    enforceStrongPassword?: boolean;
  };
  email?: {
    allowSignup?: boolean;
  };
  github?: {
    clientId?: string;
    clientSecret?: string;
    allowedUsers?: string;
  };
}

let cachedAuthConfig: AuthConfig | null = null;
let cachedAuthConfigMtime: number = 0;

/**
 * Read the auth section from project-configuration.yaml.
 * Caches result and re-reads only when the file changes.
 */
export function getAuthConfig(): AuthConfig {
  const configPath = getProjectConfigPath();
  try {
    const stat = fs.statSync(configPath);
    if (cachedAuthConfig && stat.mtimeMs === cachedAuthConfigMtime) {
      return cachedAuthConfig;
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(content) as any;
    cachedAuthConfig = {
      method: config?.auth?.method || 'none',
      basic: config?.auth?.basic,
      email: config?.auth?.email,
      github: config?.auth?.github,
    };
    cachedAuthConfigMtime = stat.mtimeMs;
    return cachedAuthConfig;
  } catch {
    return { method: 'none' };
  }
}

/**
 * Returns the configured auth method: 'none' | 'basic' | 'github'
 */
export function getAuthMethod(): AuthMethod {
  return getAuthConfig().method;
}

/** Force re-read of auth config on next access (e.g. after saving settings). */
export function invalidateAuthConfigCache(): void {
  cachedAuthConfig = null;
  cachedAuthConfigMtime = 0;
}

// ── Session (shared by basic + github) ──────────────────────────────────────

export const SESSION_COOKIE_NAME = 'artsitemaker_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionData {
  userId: string;
  username: string;
  avatarUrl: string;
  accessToken: string;
  authMethod: AuthMethod;
  expiresAt: number;
}

export function encodeSession(data: SessionData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

export function decodeSession(cookie: string): SessionData | null {
  try {
    const data = JSON.parse(Buffer.from(cookie, 'base64').toString('utf-8'));
    if (data.expiresAt && Date.now() > data.expiresAt) {
      return null;
    }
    return data as SessionData;
  } catch {
    return null;
  }
}

export function getSession(cookies: { get: (name: string) => { value: string } | undefined }): SessionData | null {
  const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) return null;
  return decodeSession(sessionCookie.value);
}

export interface EmailSessionUser {
  id: number;
  email: string;
  username: string | null;
  role: string;
}

function isLikelyDbSessionId(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

/**
 * Check if request is authenticated (sync version for basic/github).
 * For email auth, use isAuthenticatedAsync instead.
 */
export function isAuthenticated(cookies: { get: (name: string) => { value: string } | undefined }): boolean {
  const method = getAuthMethod();
  if (method === 'none') return true;
  if (method === 'email') {
    console.warn('isAuthenticated() called with email auth - use isAuthenticatedAsync() instead');
    const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
    return sessionCookie?.value ? true : false;
  }
  const session = getSession(cookies);
  return session !== null;
}

/**
 * Async authentication check that supports all auth methods including email (DB sessions).
 */
export async function isAuthenticatedAsync(
  cookies: { get: (name: string) => { value: string } | undefined }
): Promise<{ authenticated: boolean; user?: EmailSessionUser }> {
  const method = getAuthMethod();
  if (method === 'none') return { authenticated: true };
  
  const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) return { authenticated: false };
  
  if (method === 'email') {
    const result = await validateSession(sessionCookie.value);
    if (result.valid) {
      return { authenticated: true, user: result.user };
    }
    return { authenticated: false };
  }

  if (isLikelyDbSessionId(sessionCookie.value) && await isEmailAuthConfigured()) {
    const result = await validateSession(sessionCookie.value);
    if (result.valid) {
      return { authenticated: true, user: result.user };
    }
  }

  const session = decodeSession(sessionCookie.value);
  return { authenticated: session !== null };
}

export function getSessionCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE,
  };
}

// ── Basic Auth (password) ───────────────────────────────────────────────────

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_LEN = 16;

/**
 * Hash a password using Node's built-in scrypt.
 * Returns `salt:hash` (both hex-encoded).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SCRYPT_SALT_LEN).toString('hex');
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `${salt}:${hash.toString('hex')}`;
}

/**
 * Verify a password against a stored `salt:hash` string.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, storedHash] = stored.split(':');
  if (!salt || !storedHash) return false;
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), hash);
}

/**
 * Check if basic auth has a password configured.
 */
export function isBasicAuthConfigured(): boolean {
  const config = getAuthConfig();
  return Boolean(config.basic?.passwordHash);
}

/**
 * Check if the current auth method has valid credentials configured.
 * Used by middleware to avoid lockout when switching to an auth method
 * before credentials are set up.
 *
 * - `none`: always ready
 * - `basic`: ready if a passwordHash exists in config
 * - `email`: ready if DATABASE_URL is configured
 * - `github`: ready if clientId + clientSecret exist in vault/env
 */
export async function isAuthReady(): Promise<boolean> {
  const method = getAuthMethod();
  switch (method) {
    case 'none':
      return true;
    case 'basic':
      return isBasicAuthConfigured();
    case 'email':
      return isEmailAuthConfigured();
    case 'github':
      return isOAuthConfigured();
    default:
      return true;
  }
}

// ── GitHub OAuth ────────────────────────────────────────────────────────────

import {
  loadEncryptedSecrets,
  decryptWithSession,
  isSessionValid,
} from './secrets';

interface GitHubCredentials {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  allowedUsers: string[];
}

/**
 * Get GitHub OAuth credentials.
 * Priority: secrets vault (primary) → env vars (fallback) → project config (fallback)
 */
export async function getGitHubCredentials(): Promise<GitHubCredentials> {
  const callbackUrl = import.meta.env.GITHUB_CALLBACK_URL
    || process.env.GITHUB_CALLBACK_URL
    || 'http://localhost:4322/auth/callback';

  const config = getAuthConfig();

  // 1. Try secrets vault (primary source for credentials)
  if (isSessionValid()) {
    try {
      const encrypted = await loadEncryptedSecrets();
      if (encrypted) {
        const data = decryptWithSession(encrypted);
        if (data?.auth?.github_client_id && data?.auth?.github_client_secret) {
          const allowedStr = config.github?.allowedUsers || '';
          return {
            clientId: data.auth.github_client_id,
            clientSecret: data.auth.github_client_secret,
            callbackUrl,
            allowedUsers: allowedStr.split(',').map(u => u.trim().toLowerCase()).filter(Boolean),
          };
        }
      }
    } catch {
      // Fall through to env vars
    }
  }

  // 2. Fall back to env vars
  const envClientId = import.meta.env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '';
  const envClientSecret = import.meta.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '';
  const envAllowedUsers = (import.meta.env.GITHUB_ALLOWED_USERS || process.env.GITHUB_ALLOWED_USERS || '')
    .split(',').map((u: string) => u.trim().toLowerCase()).filter(Boolean);

  if (envClientId && envClientSecret) {
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      callbackUrl,
      allowedUsers: envAllowedUsers.length > 0
        ? envAllowedUsers
        : (config.github?.allowedUsers || '').split(',').map(u => u.trim().toLowerCase()).filter(Boolean),
    };
  }

  // 3. Fall back to project config (non-secret fields like clientId might be stored here)
  return {
    clientId: config.github?.clientId || '',
    clientSecret: config.github?.clientSecret || '',
    callbackUrl,
    allowedUsers: (config.github?.allowedUsers || '').split(',').map(u => u.trim().toLowerCase()).filter(Boolean),
  };
}

/**
 * Create a GitHub OAuth client with the current credentials.
 * Must be called per-request since credentials may come from the vault.
 */
export function createGitHubClient(clientId: string, clientSecret: string, callbackUrl: string): GitHub {
  return new GitHub(clientId, clientSecret, callbackUrl);
}

/**
 * Check if GitHub OAuth has valid credentials available.
 */
export async function isOAuthConfigured(): Promise<boolean> {
  const creds = await getGitHubCredentials();
  return Boolean(creds.clientId && creds.clientSecret);
}

export function isUserAllowed(username: string, allowedUsers: string[]): boolean {
  if (allowedUsers.length === 0) {
    console.warn('No GITHUB_ALLOWED_USERS configured — allowing any GitHub user');
    return true;
  }
  return allowedUsers.includes(username.toLowerCase());
}
