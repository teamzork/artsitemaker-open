// packages/admin/src/pages/auth/logout.ts
// Handles logout by clearing session (cookie + DB for email auth)

import type { APIRoute } from 'astro';
import { SESSION_COOKIE_NAME, getAuthMethod } from '@lib/auth';
import { deleteSession } from '@lib/db-auth';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const authMethod = getAuthMethod();
  
  // For email auth, also delete session from database
  if (authMethod === 'email') {
    const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
    if (sessionCookie?.value) {
      await deleteSession(sessionCookie.value);
    }
  }
  
  // Clear session cookie
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  
  // Redirect to login
  return redirect('/login');
};

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const authMethod = getAuthMethod();
  
  // For email auth, also delete session from database
  if (authMethod === 'email') {
    const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
    if (sessionCookie?.value) {
      await deleteSession(sessionCookie.value);
    }
  }
  
  // Clear session cookie
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  
  // Redirect to login
  return redirect('/login');
};