import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getThemesPath } from '../../lib/paths';

export const PUT: APIRoute = async ({ request }) => {
    try {
        const { themeName, updates } = await request.json();

        if (!themeName) {
            return new Response(JSON.stringify({ error: 'Theme name required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const themePath = path.join(getThemesPath(), themeName, 'theme.yaml');

        // Load existing theme
        let existing: any = {};
        try {
            const content = await fs.readFile(themePath, 'utf-8');
            existing = yaml.load(content) as any;
        } catch {
            return new Response(JSON.stringify({ error: 'Theme not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Deep merge updates
        const merged = deepMerge(existing, updates);

        // Write back
        const yamlContent = yaml.dump(merged, { lineWidth: -1 });
        await fs.writeFile(themePath, yamlContent, 'utf-8');

        return new Response(JSON.stringify({ success: true, theme: merged }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to save theme:', error);
        return new Response(JSON.stringify({ error: 'Failed to save theme' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

function deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key of Object.keys(source)) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }

    return result;
}
