// packages/admin/src/pages/auth/callback.ts
// Handles GitHub OAuth callback

import type { APIRoute } from 'astro';
import {
  getGitHubCredentials,
  createGitHubClient,
  isUserAllowed,
  encodeSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  getSessionCookieOptions
} from '@lib/auth';

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  // Get code and state from query params
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('github_oauth_state')?.value;

  // Clear the state cookie
  cookies.delete('github_oauth_state', { path: '/' });

  // Validate state to prevent CSRF
  if (!state || !storedState || state !== storedState) {
    console.error('OAuth state mismatch');
    return redirect('/login?error=auth_failed');
  }

  if (!code) {
    return redirect('/login?error=no_code');
  }

  try {
    // Get credentials from vault
    const creds = await getGitHubCredentials();
    if (!creds.clientId || !creds.clientSecret) {
      return redirect('/login?error=not_configured');
    }

    // Exchange code for access token
    const github = createGitHubClient(creds.clientId, creds.clientSecret, creds.callbackUrl);
    const tokens = await github.validateAuthorizationCode(code);
    const accessToken = tokens.accessToken();

    // Fetch user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'ArtSiteMaker-Admin'
      }
    });

    if (!userResponse.ok) {
      console.error('Failed to fetch GitHub user:', await userResponse.text());
      return redirect('/login?error=auth_failed');
    }

    const githubUser: GitHubUser = await userResponse.json();

    // Check if user is allowed
    if (!isUserAllowed(githubUser.login, creds.allowedUsers)) {
      console.warn(`User ${githubUser.login} not in allowed users list`);
      return redirect('/login?error=access_denied');
    }

    // Create session
    const sessionData = {
      userId: String(githubUser.id),
      username: githubUser.login,
      avatarUrl: githubUser.avatar_url,
      accessToken: accessToken,
      authMethod: 'github' as const,
      expiresAt: Date.now() + (SESSION_MAX_AGE * 1000)
    };

    // Set session cookie
    cookies.set(SESSION_COOKIE_NAME, encodeSession(sessionData), getSessionCookieOptions());

    // Redirect to dashboard
    return redirect('/');

  } catch (error) {
    console.error('OAuth callback error:', error);
    return redirect('/login?error=auth_failed');
  }
};
