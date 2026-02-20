import type { APIRoute } from 'astro';
import { authenticateUser, createSession, isEmailAuthConfigured } from '@lib/db-auth';
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from '@lib/auth';

function buildRedirectWithValues(path: string, email: string, error: string): string {
  const params = new URLSearchParams();
  params.set('error', error);
  if (email) params.set('email', email);
  return `${path}?${params.toString()}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Allow login if database is configured
  const isConfigured = await isEmailAuthConfigured();
  if (!isConfigured) {
    return redirect('/login?error=not_configured');
  }

  const formData = await request.formData();
  const email = formData.get('email')?.toString()?.trim() || '';
  const password = formData.get('password')?.toString() || '';

  if (!email || !password) {
    return redirect(buildRedirectWithValues('/login', email, 'missing_credentials'));
  }

  const result = await authenticateUser(email, password);
  if (!result.success) {
    return redirect(buildRedirectWithValues('/login', email, 'invalid_credentials'));
  }

  const session = await createSession(result.user.id);
  cookies.set(SESSION_COOKIE_NAME, session.id, getSessionCookieOptions());

  return redirect('/');
};
