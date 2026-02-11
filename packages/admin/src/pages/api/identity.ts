import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';
import { getIdentityConfigPath } from '../../lib/config-paths';

/**
 * Identity Kit API
 * 
 * Handles reading and writing Identity Kit settings from settings/identity.yaml
 */

export const GET: APIRoute = async () => {
    try {
        const identityPath = getIdentityConfigPath();
        const content = await fs.readFile(identityPath, 'utf-8');
        const identity = yaml.load(content);

        return new Response(JSON.stringify(identity), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        // If file doesn't exist, return empty object
        if (error.code === 'ENOENT') {
            return new Response(JSON.stringify({}), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        console.error('Failed to load identity kit:', error);
        return new Response(JSON.stringify({ error: 'Failed to load identity kit' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const PUT: APIRoute = async ({ request }) => {
    try {
        // Load existing identity
        let existing: any = {};
        const identityPath = getIdentityConfigPath();
        try {
            const content = await fs.readFile(identityPath, 'utf-8');
            existing = yaml.load(content) as any || {};
        } catch {
            // File doesn't exist, start fresh
        }

        // Get updates from request
        const updates = await request.json();

        // Deep merge updates into existing settings
        const merged = deepMerge(existing, updates);

        // Write back to file
        const yamlContent = yaml.dump(merged, {
            lineWidth: -1,
            quotingType: '"'
        });

        // Ensure directory exists
        await fs.mkdir(path.dirname(identityPath), { recursive: true });
        await fs.writeFile(identityPath, yamlContent, 'utf-8');

        return new Response(JSON.stringify({ success: true, identity: merged }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to save identity kit:', error);
        return new Response(JSON.stringify({ error: 'Failed to save identity kit' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// Helper function to deep merge objects
function deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key of Object.keys(source)) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            // Preserve empty strings and other falsy values (except null/undefined)
            result[key] = source[key];
        }
    }

    return result;
}
