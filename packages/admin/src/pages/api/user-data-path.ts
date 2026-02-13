/**
 * User Data Path API
 * 
 * GET /api/user-data-path - Get current user data path configuration
 * PUT /api/user-data-path - Update user data path (requires server restart)
 */

import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getRepoPath, clearConfigCache } from '../../lib/paths';

function getBootstrapPath(): string {
    return path.join(getRepoPath(), 'artis.config.yaml');
}

export const GET: APIRoute = async () => {
    try {
        const bootstrapPath = getBootstrapPath();

        // Try to read artis.config.yaml
        try {
            const content = await fs.readFile(bootstrapPath, 'utf-8');
            const config = yaml.load(content) as { userDataPath?: string; contentPath?: string; path?: string; projectName?: string };
            const resolvedPath = config?.userDataPath || config?.contentPath || config?.path || '';

            return new Response(JSON.stringify({
                configured: true,
                path: resolvedPath,
                projectName: config?.projectName || '',
                bootstrapFile: bootstrapPath
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch {
            // File doesn't exist
            return new Response(JSON.stringify({
                configured: false,
                path: '',
                bootstrapFile: bootstrapPath,
                message: 'User data path not configured. Please set up your user data folder.'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Failed to get user data path:', error);
        return new Response(JSON.stringify({ error: 'Failed to get user data path' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const PUT: APIRoute = async ({ request }) => {
    try {
        const { path: userDataPath, projectName } = await request.json();

        if (!userDataPath || typeof userDataPath !== 'string') {
            return new Response(JSON.stringify({ error: 'Path is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const bootstrapPath = getBootstrapPath();

        const configLines = [
            `userDataPath: ${userDataPath}`
        ];

        if (projectName && typeof projectName === 'string') {
            configLines.push(`projectName: ${projectName}`);
        }

        const yamlContent = `# ArtSiteMaker Site Configuration
# ========================
# This file defines where artis finds all site-specific data.

${configLines.join('\n')}
`;

        await fs.writeFile(bootstrapPath, yamlContent, 'utf-8');

        // Clear cached paths so they're reloaded
        clearConfigCache();

        return new Response(JSON.stringify({
            success: true,
            path: userDataPath,
            projectName: projectName || '',
            message: 'User data path updated. Please restart the dev server for changes to take effect.'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to save user data path:', error);
        return new Response(JSON.stringify({ error: 'Failed to save user data path' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
