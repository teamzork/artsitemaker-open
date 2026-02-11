import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import { getFooterPath } from '../../lib/config-paths';


/**
 * GET /api/footer - Get current footer content
 */
export const GET: APIRoute = async () => {
    try {
        const content = await fs.readFile(getFooterPath(), 'utf-8');
        const footer = yaml.load(content) as any;

        return new Response(JSON.stringify(footer), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        // Return empty object if file doesn't exist
        return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

/**
 * PUT /api/footer - Update footer content
 */
export const PUT: APIRoute = async ({ request }) => {
    try {
        const footerData = await request.json();

        // Write to footer.yaml
        const yamlContent = yaml.dump(footerData, {
            lineWidth: -1,
            quotingType: '"'
        });
        await fs.writeFile(getFooterPath(), yamlContent, 'utf-8');

        return new Response(JSON.stringify({ success: true, footer: footerData }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to update footer:', error);
        return new Response(JSON.stringify({ error: 'Failed to update footer' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
