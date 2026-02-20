import type { APIRoute } from 'astro';
import { createUser, createSession, validateEmail, validatePassword, isEmailAuthConfigured } from '@lib/db-auth';
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from '@lib/auth';

function buildRedirectWithValues(path: string, email: string, username: string | undefined, error: string, message?: string): string {
  const params = new URLSearchParams();
  params.set('error', error);
  if (message) params.set('message', message);
  if (email) params.set('email', email);
  if (username) params.set('username', username);
  return `${path}?${params.toString()}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Allow signup if database is configured, regardless of current auth method
  const isConfigured = await isEmailAuthConfigured();
  if (!isConfigured) {
    return redirect('/signup?error=not_configured');
  }

  const formData = await request.formData();
  const email = formData.get('email')?.toString()?.trim() || '';
  const password = formData.get('password')?.toString() || '';
  const confirmPassword = formData.get('confirmPassword')?.toString() || '';
  const username = formData.get('username')?.toString()?.trim() || '';

  if (!email || !password) {
    return redirect(buildRedirectWithValues('/signup', email, username || undefined, 'missing_fields'));
  }

  if (!validateEmail(email)) {
    return redirect(buildRedirectWithValues('/signup', email, username || undefined, 'invalid_email'));
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    const errorMsg = passwordValidation.errors[0];
    return redirect(buildRedirectWithValues('/signup', email, username || undefined, 'weak_password', errorMsg));
  }

  if (password !== confirmPassword) {
    return redirect(buildRedirectWithValues('/signup', email, username || undefined, 'password_mismatch'));
  }

  const result = await createUser(email, password, username || undefined);
  if (!result.success) {
    const errorMsg = result.error;
    return redirect(buildRedirectWithValues('/signup', email, username || undefined, 'signup_failed', errorMsg));
  }

  const session = await createSession(result.user.id);
  cookies.set(SESSION_COOKIE_NAME, session.id, getSessionCookieOptions());

  return redirect('/');
};
