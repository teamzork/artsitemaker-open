// packages/admin/src/middleware.ts
// Authentication middleware for protecting admin routes

import { defineMiddleware } from 'astro:middleware';
import { isAuthenticated, isOAuthConfigured } from '@lib/auth';
import { getProjectState } from '@lib/state-manager';
import { runAutoMigration } from '@lib/migration';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/auth/login',
  '/auth/callback',
  '/auth/logout'
];

// Run auto-migration once on startup
let migrationRan = false;
function ensureMigration(): void {
  if (migrationRan) return;
  migrationRan = true;
  runAutoMigration();
}

let oauthWarningLogged = false;

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

  // Check if OAuth is configured
  if (!isOAuthConfigured()) {
    // In development without OAuth config, allow access with a warning
    if (import.meta.env.DEV) {
      if (!oauthWarningLogged) {
        oauthWarningLogged = true;
        console.warn('⚠️  OAuth not configured - admin access is unrestricted in development');
      }
      return next();
    }
    // In production, redirect to login which will show config error
    return context.redirect('/login?error=not_configured');
  }
  
  // Check authentication
  if (!isAuthenticated(context.cookies)) {
    return context.redirect('/login');
  }
  
  // User is authenticated, continue
  return next();
});
