import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';
import { getSettingsFilePath } from '../../lib/config-paths';


export const GET: APIRoute = async () => {
    try {
        const content = await fs.readFile(getSettingsFilePath(), 'utf-8');
        const settings = yaml.load(content);

        return new Response(JSON.stringify(settings), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to load settings:', error);
        return new Response(JSON.stringify({ error: 'Failed to load settings' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const PUT: APIRoute = async ({ request }) => {
    try {
        // Load existing settings
        let existing: any = {};
        try {
            const content = await fs.readFile(getSettingsFilePath(), 'utf-8');
            existing = yaml.load(content) as any;
        } catch {
            // File doesn't exist, start fresh
        }

        // Get updates from request
        const rawUpdates = await request.json();

        // Convert dotted keys (like 'r2.publicUrl') to nested objects
        const updates = expandDottedKeys(rawUpdates);

        // Deep merge updates into existing settings
        const merged = deepMerge(existing, updates);

        // Write back to file
        const yamlContent = yaml.dump(merged, {
            lineWidth: -1,
            quotingType: '"'
        });


        // Ensure directory exists
        const settingsPath = getSettingsFilePath();
        await fs.mkdir(path.dirname(settingsPath), { recursive: true });

        await fs.writeFile(settingsPath, yamlContent, 'utf-8');

        return new Response(JSON.stringify({ success: true, settings: merged }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to save settings:', error);
        return new Response(JSON.stringify({ error: 'Failed to save settings' }), {
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

/**
 * Convert flat dotted keys (e.g., 'r2.publicUrl') into nested objects.
 * This ensures form data with names like 'images.quality' becomes { images: { quality: ... } }
 */
function expandDottedKeys(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
        if (key.includes('.')) {
            const parts = key.split('.');
            let current = result;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!(parts[i] in current)) {
                    current[parts[i]] = {};
                }
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = value;
        } else {
            result[key] = value;
        }
    }

    return result;
}
