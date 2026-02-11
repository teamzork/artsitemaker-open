import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getContentPath } from '../../../lib/paths';
import { getPagesConfigPath, getSettingsFilePath } from '../../../lib/config-paths';
import { isCoreContentFile } from '../../../lib/pages';

export const GET: APIRoute = async ({ params }) => {
    const { slug } = params;

    try {
        const pagePath = path.join(getContentPath(), 'pages', `${slug}.yaml`);
        const content = await fs.readFile(pagePath, 'utf-8');
        const page = yaml.load(content);

        return new Response(JSON.stringify(page), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Page not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const PUT: APIRoute = async ({ params, request }) => {
    const { slug } = params;

    try {
        const pagesDir = path.join(getContentPath(), 'pages');
        const pagePath = path.join(pagesDir, `${slug}.yaml`);

        // Ensure pages directory exists
        await fs.mkdir(pagesDir, { recursive: true });

        // Load existing page
        let existing: any = {};
        try {
            const content = await fs.readFile(pagePath, 'utf-8');
            existing = yaml.load(content) as any;
        } catch {
            // New page
        }

        // Get updates
        const updates = await request.json();
        console.log('📝 Saving page:', slug, JSON.stringify(updates, null, 2));

        // Merge existing data with updates
        const updated = {
            ...existing,
            ...updates,
            content: updates.content === null ? '' : (updates.content !== undefined ? updates.content : existing.content),
            slug: slug, // Preserve slug
        };

        // Write back
        const yamlContent = yaml.dump(updated, { lineWidth: -1 });
        await fs.writeFile(pagePath, yamlContent, 'utf-8');

        return new Response(JSON.stringify({ success: true, page: updated }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('Failed to save page:', e);
        return new Response(JSON.stringify({ error: 'Failed to save page' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// DELETE - Delete page
export const DELETE: APIRoute = async ({ params }) => {
    const { slug } = params;

    if (!slug) {
        return new Response(JSON.stringify({ error: 'Missing page slug' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (isCoreContentFile(slug)) {
        return new Response(JSON.stringify({ error: 'Core pages cannot be deleted' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const pagesDir = path.join(getContentPath(), 'pages');
        const pagePath = path.join(pagesDir, `${slug}.yaml`);

        let page: any = {};
        try {
            const content = await fs.readFile(pagePath, 'utf-8');
            page = (yaml.load(content) || {}) as any;
        } catch {
            return new Response(JSON.stringify({ error: 'Page not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        await fs.unlink(pagePath);

        await cleanupPagesConfig(slug);
        await cleanupNavItems(slug, page?.pageType);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('Failed to delete page:', e);
        return new Response(JSON.stringify({ error: 'Failed to delete page' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

async function cleanupPagesConfig(slug: string): Promise<void> {
    const pagesConfigPath = getPagesConfigPath();

    try {
        const content = await fs.readFile(pagesConfigPath, 'utf-8');
        const pages = (yaml.load(content) || {}) as any;
        let updated = false;

        if (pages.enabled && slug in pages.enabled) {
            delete pages.enabled[slug];
            updated = true;
        }

        if (pages.showInNav && slug in pages.showInNav) {
            delete pages.showInNav[slug];
            updated = true;
        }

        if (!updated) return;

        const yamlContent = yaml.dump(pages, {
            lineWidth: -1,
            quotingType: '"'
        });
        await fs.writeFile(pagesConfigPath, yamlContent, 'utf-8');
    } catch {
        // No pages config to update
    }
}

async function cleanupNavItems(slug: string, pageType?: string): Promise<void> {
    const settingsPath = getSettingsFilePath();
    let settings: any = {};

    try {
        const content = await fs.readFile(settingsPath, 'utf-8');
        settings = (yaml.load(content) || {}) as any;
    } catch {
        return;
    }

    if (!settings?.nav?.items || !Array.isArray(settings.nav.items)) {
        return;
    }

    const hrefsToRemove = new Set<string>([`/${slug}`, `/service/${slug}`]);
    if (pageType === 'service') {
        hrefsToRemove.add(`/service/${slug}`);
    }

    const originalItems = settings.nav.items;
    const filteredItems = originalItems.filter((item: any) => !hrefsToRemove.has(String(item?.href)));

    if (filteredItems.length === originalItems.length) {
        return;
    }

    settings.nav.items = filteredItems;

    const yamlContent = yaml.dump(settings, {
        lineWidth: -1,
        quotingType: '"'
    });
    await fs.writeFile(settingsPath, yamlContent, 'utf-8');
}
