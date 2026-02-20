// packages/admin/src/middleware.ts
// Authentication middleware — enforces the configured auth method

import { defineMiddleware } from 'astro:middleware';
import { isAuthenticatedAsync, getAuthMethod, isAuthReady, getAuthConfig } from '@lib/auth';
import { getProjectState } from '@lib/state-manager';
import { runAutoMigration } from '@lib/migration';

// Routes that never require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/auth/login',
  '/auth/basic-login',
  '/auth/email-login',
  '/auth/email-signup',
  '/auth/callback',
  '/auth/logout',
  '/onboarding',
  '/api/onboarding',
];

// In development, allow the reset endpoint
if (import.meta.env.DEV) {
  // Public dev routes can be added here
}

// Run auto-migration once on startup
let migrationRan = false;
function ensureMigration(): void {
  if (migrationRan) return;
  migrationRan = true;
  runAutoMigration();
}

let noAuthWarningLogged = false;
let notReadyWarningLogged = false;

export const onRequest = defineMiddleware(async (context, next) => {
  // Run auto-migration on first request
  ensureMigration();
  const { pathname } = context.url;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    return next();
  }

  // Allow static assets
  if (pathname.startsWith('/_astro/') || pathname.includes('.')) {
    return next();
  }

  // Redirect to onboarding on first run (but allow API routes)
  if (getProjectState() === 'FIRST_RUN' && !pathname.startsWith('/onboarding')) {
    if (!pathname.startsWith('/api/')) {
      return context.redirect('/onboarding');
    }
  }

  // Enforce authentication based on configured method
  const authMethod = getAuthMethod();

  if (authMethod === 'none') {
    // No authentication — allow everything through
    if (!noAuthWarningLogged) {
      noAuthWarningLogged = true;
      console.warn('⚠️  Authentication disabled (auth.method: none) — admin access is unrestricted');
    }
    return next();
  }

  // ── Lockout prevention ──────────────────────────────────────────────────
  // If auth method is basic/github/email but credentials aren't configured yet,
  // fall back to open access instead of locking the user out.
  const ready = await isAuthReady();
  if (!ready) {
    if (!notReadyWarningLogged) {
      notReadyWarningLogged = true;
      console.warn(
        `⚠️  Auth method "${authMethod}" selected but credentials are not configured yet — ` +
        `falling back to open access. Configure credentials in Configuration → Authentication.`
      );
    }
    return next();
  }

  // Check authentication (async for email auth with DB sessions)
  const { authenticated } = await isAuthenticatedAsync(context.cookies);
  if (!authenticated) {
    // API routes get a 401 instead of a redirect
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return context.redirect('/login');
  }

  // User is authenticated, continue
  return next();
});
