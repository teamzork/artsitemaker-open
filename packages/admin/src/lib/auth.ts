// packages/admin/src/lib/auth.ts
// GitHub OAuth authentication using Arctic

import { GitHub } from 'arctic';

// Environment variables (set in .env or deployment config)
const GITHUB_CLIENT_ID = import.meta.env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = import.meta.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL = import.meta.env.GITHUB_CALLBACK_URL || process.env.GITHUB_CALLBACK_URL || 'http://localhost:4322/auth/callback';

// Allowed GitHub usernames (comma-separated in env, or single username)
const ALLOWED_USERS = (import.meta.env.GITHUB_ALLOWED_USERS || process.env.GITHUB_ALLOWED_USERS || '')
  .split(',')
  .map((u: string) => u.trim().toLowerCase())
  .filter(Boolean);

// Session configuration
export const SESSION_COOKIE_NAME = 'artsitemaker_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

// Initialize GitHub OAuth client
export const github = new GitHub(
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL
);

// Session data structure
export interface SessionData {
  userId: string;
  username: string;
  avatarUrl: string;
  accessToken: string;
  expiresAt: number;
}

// Simple session encoding/decoding (in production, use proper encryption)
export function encodeSession(data: SessionData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

export function decodeSession(cookie: string): SessionData | null {
  try {
    const data = JSON.parse(Buffer.from(cookie, 'base64').toString('utf-8'));
    
    // Check expiration
    if (data.expiresAt && Date.now() > data.expiresAt) {
      return null;
    }
    
    return data as SessionData;
  } catch {
    return null;
  }
}

// Check if a user is allowed to access the admin
export function isUserAllowed(username: string): boolean {
  // If no allowed users configured, allow anyone with GitHub account
  if (ALLOWED_USERS.length === 0) {
    console.warn('No GITHUB_ALLOWED_USERS configured - allowing any GitHub user');
    return true;
  }
  
  return ALLOWED_USERS.includes(username.toLowerCase());
}

// Get session from request cookies
export function getSession(cookies: { get: (name: string) => { value: string } | undefined }): SessionData | null {
  const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) return null;
  
  return decodeSession(sessionCookie.value);
}

// Check if request is authenticated
export function isAuthenticated(cookies: { get: (name: string) => { value: string } | undefined }): boolean {
  const session = getSession(cookies);
  return session !== null;
}

// Create session cookie options
export function getSessionCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE
  };
}

// Check if GitHub OAuth is configured
export function isOAuthConfigured(): boolean {
  return Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
}

