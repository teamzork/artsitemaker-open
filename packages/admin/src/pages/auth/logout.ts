// packages/admin/src/pages/auth/logout.ts
// Handles logout by clearing session

import type { APIRoute } from 'astro';
import { SESSION_COOKIE_NAME } from '@lib/auth';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  // Clear session cookie
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  
  // Redirect to login
  return redirect('/login');
};

export const POST: APIRoute = async ({ cookies, redirect }) => {
  // Clear session cookie
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  
  // Redirect to login
  return redirect('/login');
};



