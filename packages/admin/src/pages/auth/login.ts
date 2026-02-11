// packages/admin/src/pages/auth/login.ts
// Initiates GitHub OAuth flow

import type { APIRoute } from 'astro';
import { github, isOAuthConfigured } from '@lib/auth';
import { generateState } from 'arctic';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  // Check if OAuth is configured
  if (!isOAuthConfigured()) {
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
  const url = github.createAuthorizationURL(state, ['read:user', 'user:email']);
  
  return redirect(url.toString());
};

