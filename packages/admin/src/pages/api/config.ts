/**
 * Site Config API
 * 
 * GET /api/config - Get artis.config.yaml
 * PUT /api/config - Update artis.config.yaml
 */

import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getSiteProjectPath, getRepoPath, clearConfigCache } from '../../lib/paths';

function getConfigPath(): string {
    // Always use repo root for artis.config.yaml
    // This is the bootstrap file that points to user data
    const repoRoot = getRepoPath();
    if (repoRoot) {
        return path.join(repoRoot, 'artis.config.yaml');
    }

    // Last resort - current working directory
    return path.join(process.cwd(), 'artis.config.yaml');
}

export const GET: APIRoute = async () => {
    try {
        const configPath = getConfigPath();
        const content = await fs.readFile(configPath, 'utf-8');
        const config = yaml.load(content);

        return new Response(JSON.stringify(config), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to load config:', error);
        return new Response(JSON.stringify({ error: 'Failed to load config' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const PUT: APIRoute = async ({ request }) => {
    try {
        const configPath = getConfigPath();
        const configDir = path.dirname(configPath);

        // Ensure directory exists
        await fs.mkdir(configDir, { recursive: true });

        // Load existing config (if any)
        let existing: any = {};
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            existing = yaml.load(content) as any;
        } catch {
            // File doesn't exist, start fresh
        }

        // Get updates from request
        const updates = await request.json();

        // Merge updates into existing config (shallow merge for config)
        const merged = { ...existing, ...updates };

        // Write back to file with comment header
        const yamlContent = '# ArtSiteMaker Site Configuration\n# ========================\n# This file defines where ArtSiteMaker finds all site-specific data.\n\n' + yaml.dump(merged, {
            lineWidth: -1,
            quotingType: '"' as const
        });

        await fs.writeFile(configPath, yamlContent, 'utf-8');
        clearConfigCache();

        return new Response(JSON.stringify({ success: true, config: merged }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to save config:', error);
        return new Response(JSON.stringify({ error: 'Failed to save config' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
