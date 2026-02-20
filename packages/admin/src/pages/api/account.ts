/**
 * Account API — Manage basic auth credentials
 *
 * PUT /api/account — Update username and/or password.
 *   Body: { currentPassword?: string, username?: string, newPassword?: string }
 *
 * When no password hash exists yet (first setup), currentPassword is not required.
 */

import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import {
    getAuthConfig,
    hashPassword,
    verifyPassword,
    invalidateAuthConfigCache,
} from '../../lib/auth';
import { getProjectConfigPath } from '../../lib/config-paths';

function json(data: object, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export const PUT: APIRoute = async ({ request }) => {
    try {
        const requestBody = await request.json();
        const { currentPassword, username, newPassword } = requestBody;

        const authConfig = getAuthConfig();
        const existingHash = authConfig.basic?.passwordHash;

        // If a password hash already exists, verify the current password
        if (existingHash) {
            if (!currentPassword) {
                return json({ error: 'Current password is required' }, 400);
            }
            const valid = await verifyPassword(currentPassword, existingHash);
            if (!valid) {
                return json({ error: 'Current password is incorrect' }, 403);
            }
        }

        // Build updates for the basic auth section
        const basicUpdates: Record<string, any> = {};

        if (username && username.trim().length >= 3) {
            basicUpdates.username = username.trim();
        }

        // Handle optional fields
        if (typeof requestBody.passwordHint === 'string') {
            basicUpdates.passwordHint = requestBody.passwordHint.trim();
        }
        if (typeof requestBody.enforceStrongPassword === 'boolean') {
            basicUpdates.enforceStrongPassword = requestBody.enforceStrongPassword;
        }

        if (newPassword) {
            // Check strength if enforced (default to true if not set)
            const enforceStrong = requestBody.enforceStrongPassword ?? authConfig.basic?.enforceStrongPassword ?? true;

            if (enforceStrong && newPassword.length < 8) {
                return json({ error: 'Password must be at least 8 characters' }, 400);
            }
            basicUpdates.passwordHash = await hashPassword(newPassword);
        }

        if (Object.keys(basicUpdates).length === 0) {
            return json({ error: 'No changes provided' }, 400);
        }

        // Read, merge, write project config
        const configPath = getProjectConfigPath();
        let config: any = {};
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            config = yaml.load(content) as any;
        } catch {
            // File doesn't exist, start fresh
        }

        config.auth = config.auth || {};
        config.auth.basic = { ...(config.auth.basic || {}), ...basicUpdates };

        const dir = configPath.substring(0, configPath.lastIndexOf('/'));
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(
            configPath,
            yaml.dump(config, { lineWidth: -1, quotingType: '"' as const }),
            'utf-8',
        );

        // Invalidate cached config so middleware picks up changes immediately
        invalidateAuthConfigCache();

        return json({ success: true });
    } catch (error) {
        console.error('Failed to update account:', error);
        return json({ error: 'Failed to update account' }, 500);
    }
};
