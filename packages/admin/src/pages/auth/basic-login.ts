// packages/admin/src/pages/auth/basic-login.ts
// Handles basic (password) authentication login

import type { APIRoute } from 'astro';
import {
    getAuthConfig,
    verifyPassword,
    encodeSession,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
    getSessionCookieOptions,
} from '@lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    try {
        const formData = await request.formData();
        const username = (formData.get('username') as string)?.trim() || '';
        const password = (formData.get('password') as string) || '';

        if (!username || !password) {
            return redirect('/login?error=missing_credentials');
        }

        const authConfig = getAuthConfig();
        const storedUsername = authConfig.basic?.username || 'admin';
        const storedHash = authConfig.basic?.passwordHash;

        // Check if basic auth is configured (has a password hash)
        if (!storedHash) {
            return redirect('/login?error=not_configured');
        }

        // Verify username
        if (username.toLowerCase() !== storedUsername.toLowerCase()) {
            return redirect('/login?error=invalid_credentials');
        }

        // Verify password
        const valid = await verifyPassword(password, storedHash);
        if (!valid) {
            return redirect('/login?error=invalid_credentials');
        }

        // Create session
        const sessionData = {
            userId: `basic:${username}`,
            username,
            avatarUrl: '',
            accessToken: '',
            authMethod: 'basic' as const,
            expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
        };

        cookies.set(SESSION_COOKIE_NAME, encodeSession(sessionData), getSessionCookieOptions());

        return redirect('/');
    } catch (error) {
        console.error('Basic login error:', error);
        return redirect('/login?error=auth_failed');
    }
};
