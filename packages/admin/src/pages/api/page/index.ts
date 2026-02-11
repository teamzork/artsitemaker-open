import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getContentPath } from '../../../lib/paths';

/**
 * POST /api/page
 * Create a new page content file
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { slug, title, showInNav, showInFooter, showInCopyright } = body;

        // Validate slug
        if (!slug || typeof slug !== 'string') {
            return new Response(JSON.stringify({
                error: 'Slug is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate slug format: lowercase alphanumeric + hyphens, 2-50 chars
        const slugRegex = /^[a-z0-9-]{2,50}$/;
        const normalizedSlug = slug.trim().toLowerCase();
        
        if (!slugRegex.test(normalizedSlug)) {
            return new Response(JSON.stringify({
                error: 'Slug must be 2-50 characters, lowercase letters, numbers, and hyphens only'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate title
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return new Response(JSON.stringify({
                error: 'Title is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const pagesDir = path.join(getContentPath(), 'pages');
        const pagePath = path.join(pagesDir, `${normalizedSlug}.yaml`);

        // Check if page already exists
        try {
            await fs.access(pagePath);
            return new Response(JSON.stringify({
                error: `Page "${normalizedSlug}" already exists`
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch {
            // File doesn't exist, proceed with creation
        }

        // Create pages directory if it doesn't exist
        await fs.mkdir(pagesDir, { recursive: true });

        // Create minimal page content
        const pageData = {
            slug: normalizedSlug,
            title: title.trim(),
            template: 'default',
            sortOrder: 0,
            showInNav: showInNav === true,
            showInFooter: showInFooter === true,
            showInCopyright: showInCopyright === true,
            content: '',
        };

        // Write the YAML file
        const yamlContent = yaml.dump(pageData, { lineWidth: -1 });
        await fs.writeFile(pagePath, yamlContent, 'utf-8');

        return new Response(JSON.stringify({
            success: true,
            slug: normalizedSlug,
            message: `Page "${normalizedSlug}" created successfully`
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Failed to create page:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Failed to create page'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
