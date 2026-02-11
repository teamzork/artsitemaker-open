import type { APIRoute } from 'astro';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getSession, isUserAllowed } from '../../lib/auth';

const execAsync = promisify(exec);

// Define error codes for structured error handling
type ErrorCode = {
    code: string;
    message: string;
    suggestion: string;
};

const ERROR_CODES: Record<string, ErrorCode> = {
    ASSETS_NOT_FOUND: {
        code: 'ASSETS_NOT_FOUND',
        message: 'No theme assets found to migrate',
        suggestion: 'Your theme may already be using the pure theme system, or assets are in recommended-assets/.'
    },
    PERMISSION_DENIED: {
        code: 'PERMISSION_DENIED',
        message: 'Cannot write to user-data directory',
        suggestion: 'Check file permissions on user-data/ folder and ensure it is writable.'
    },
    YAML_PARSE_ERROR: {
        code: 'YAML_PARSE_ERROR',
        message: 'Failed to update settings.yaml',
        suggestion: 'Check that settings.yaml is valid YAML format.'
    },
    MIGRATION_TIMEOUT: {
        code: 'MIGRATION_TIMEOUT',
        message: 'Migration took too long (>60s)',
        suggestion: 'Try manual migration or check system resources.'
    },
    UNAUTHORIZED: {
        code: 'UNAUTHORIZED',
        message: 'You must be signed in to run migration',
        suggestion: 'Please sign in with GitHub to continue.'
    },
    FORBIDDEN: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to run migrations',
        suggestion: 'Contact an administrator for assistance.'
    }
};

export const POST: APIRoute = async ({ cookies, request }) => {
    // 1. Check authentication
    const session = getSession(cookies);
    if (!session) {
        return new Response(JSON.stringify({
            success: false,
            error: ERROR_CODES.UNAUTHORIZED.message,
            code: ERROR_CODES.UNAUTHORIZED.code,
            suggestion: ERROR_CODES.UNAUTHORIZED.suggestion
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 2. Check user authorization
    if (!isUserAllowed(session.username)) {
        return new Response(JSON.stringify({
            success: false,
            error: ERROR_CODES.FORBIDDEN.message,
            code: ERROR_CODES.FORBIDDEN.code,
            suggestion: ERROR_CODES.FORBIDDEN.suggestion
        }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 3. Validate request origin (CSRF protection)
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    const allowedHosts = ['localhost:4322', 'localhost:4321'];
    
    if (import.meta.env.PROD) {
        // In production, check against configured admin URL
        const adminUrl = import.meta.env.ADMIN_URL || process.env.ADMIN_URL;
        if (adminUrl) {
            const adminHost = new URL(adminUrl).host;
            allowedHosts.push(adminHost);
        }
    }

    // Allow if origin matches host (same-origin) or is in allowed list
    const isValidOrigin = !origin || 
        origin.includes(host || '') || 
        allowedHosts.some(h => origin.includes(h));

    if (!isValidOrigin) {
        return new Response(JSON.stringify({
            success: false,
            error: 'Invalid request origin',
            code: 'INVALID_ORIGIN',
            suggestion: 'Please refresh the page and try again.'
        }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Run migration script from project root
        const { stdout, stderr } = await execAsync('pnpm migrate:theme-assets', {
            cwd: process.cwd(),
            timeout: 60000 // 60 second timeout
        });

        return new Response(JSON.stringify({
            success: true,
            output: stdout,
            warnings: stderr || undefined
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Migration error:', error);

        // Map error to specific code
        let errorInfo: ErrorCode = ERROR_CODES.MIGRATION_TIMEOUT;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
            errorInfo = ERROR_CODES.ASSETS_NOT_FOUND;
        } else if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
            errorInfo = ERROR_CODES.PERMISSION_DENIED;
        } else if (errorMessage.includes('yaml') || errorMessage.includes('YAML')) {
            errorInfo = ERROR_CODES.YAML_PARSE_ERROR;
        }

        return new Response(JSON.stringify({
            success: false,
            error: errorInfo.message,
            code: errorInfo.code,
            suggestion: errorInfo.suggestion,
            details: import.meta.env.DEV ? errorMessage : undefined
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
