import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import { slugify, getDefaultPaths } from '../../lib/image-pipeline';

export const POST: APIRoute = async () => {
    try {
        const paths = getDefaultPaths();
        
        // 1. Get all original files
        let originalFiles: string[] = [];
        try {
            originalFiles = await fs.readdir(paths.originals);
            originalFiles = originalFiles.filter(f => /\.(jpg|jpeg|png|webp|tiff|tif|heic|heif)$/i.test(f));
        } catch (e) {
            return new Response(JSON.stringify({ found: [], error: 'Originals folder not found' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. Get all existing artwork slugs
        let existingSlugs = new Set<string>();
        try {
            const artworkFiles = await fs.readdir(path.join(paths.content, 'artworks'));
            artworkFiles.forEach(f => {
                if (f.endsWith('.yaml')) {
                    existingSlugs.add(path.basename(f, '.yaml'));
                }
            });
        } catch (e) {
            // Folder might not exist yet, that's fine
        }

        // 3. Find files that don't have artwork entries
        const found = originalFiles.filter(file => {
            const slug = slugify(path.basename(file, path.extname(file)));
            return !existingSlugs.has(slug);
        });

        return new Response(JSON.stringify({ found }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Scan failed:', error);
        return new Response(JSON.stringify({ error: 'Scan failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
