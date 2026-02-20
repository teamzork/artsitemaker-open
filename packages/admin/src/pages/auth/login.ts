// packages/admin/src/pages/auth/login.ts
// Initiates GitHub OAuth flow

import type { APIRoute } from 'astro';
import { getGitHubCredentials, createGitHubClient } from '@lib/auth';
import { generateState } from 'arctic';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  // Get GitHub credentials (vault → env → config)
  const creds = await getGitHubCredentials();

  if (!creds.clientId || !creds.clientSecret) {
    return redirect('/login?error=not_configured');
  }

  // Generate state for CSRF protection
  const state = generateState();

  // Store state in cookie for verification on callback
  cookies.set('github_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  });

  // Create authorization URL
  const github = createGitHubClient(creds.clientId, creds.clientSecret, creds.callbackUrl);
  const url = github.createAuthorizationURL(state, ['read:user', 'user:email']);

  return redirect(url.toString());
};
