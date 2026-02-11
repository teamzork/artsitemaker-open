/**
 * Image Storage API
 * 
 * POST /api/image-storage - Update image storage mode
 * This updates artis.config.yaml and clears config cache in both admin and site packages
 */

import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getSiteProjectPath, getRepoPath, clearConfigCache as clearAdminCache } from '../../lib/paths';

function getConfigPath(): string {
    const siteProject = getSiteProjectPath();
    if (siteProject) {
        return path.join(siteProject, 'artis.config.yaml');
    }

    const repoRoot = getRepoPath();
    if (repoRoot) {
        return path.join(repoRoot, 'artis.config.yaml');
    }

    return path.join(process.cwd(), 'artis.config.yaml');
}

/**
 * Clear config cache in the site package by dynamically importing and calling its clearConfigCache
 */
async function clearSiteCache() {
    try {
        // Dynamically import the site package's paths module using the alias
        const sitePathsModule = await import('@artsitemaker/site/lib/paths');
        if (sitePathsModule.clearConfigCache) {
            sitePathsModule.clearConfigCache();
        }
    } catch (error) {
        console.warn('Could not clear site package cache:', error);
    }
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { imageStorage, r2PublicUrl, r2BucketName, r2ProjectPrefix } = body;

        if (!imageStorage) {
            return new Response(JSON.stringify({ error: 'imageStorage is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate imageStorage value
        if (!['local', 'r2', 'external'].includes(imageStorage)) {
            return new Response(JSON.stringify({ error: 'Invalid imageStorage value' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const configPath = getConfigPath();
        const configDir = path.dirname(configPath);

        // Ensure directory exists
        await fs.mkdir(configDir, { recursive: true });

        // Load existing config
        let existing: any = {};
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            existing = yaml.load(content) as any;
        } catch {
            // File doesn't exist, start fresh
        }

        // Update imageStorage
        existing.imageStorage = imageStorage;

        // Update R2 settings if provided
        if (r2PublicUrl !== undefined) {
            existing.r2PublicUrl = r2PublicUrl;
        }
        if (r2BucketName !== undefined) {
            existing.r2BucketName = r2BucketName;
        }
        if (r2ProjectPrefix !== undefined) {
            existing.r2ProjectPrefix = r2ProjectPrefix;
        }

        // Write back to file
        const yamlContent = '# ArtSiteMaker Site Configuration\n# ========================\n# This file defines where ArtSiteMaker finds all site-specific data.\n\n' + yaml.dump(existing, {
            lineWidth: -1,
            quotingType: '"' as const
        });

        await fs.writeFile(configPath, yamlContent, 'utf-8');

        // Clear cache in both admin and site packages
        clearAdminCache();
        await clearSiteCache();

        return new Response(JSON.stringify({ 
            success: true, 
            imageStorage,
            message: 'Image storage updated. Changes will take effect immediately.'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to update image storage:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to update image storage',
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
