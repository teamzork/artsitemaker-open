import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import {
    processImage,
    getDefaultPaths,
    DEFAULT_CONFIG
} from '../../../lib/image-pipeline';

const paths = getDefaultPaths();

// POST - Add additional images
export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const files = formData.getAll('files') as File[];
        const slug = formData.get('slug') as string;

        if (!files.length || !slug) {
            return new Response(JSON.stringify({ error: 'Files and slug required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Load artwork
        const artworkPath = path.join(paths.content, 'artworks', `${slug}.yaml`);
        let artwork: any;
        try {
            const content = await fs.readFile(artworkPath, 'utf-8');
            artwork = yaml.load(content) as any;
        } catch {
            return new Response(JSON.stringify({ error: 'Artwork not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Initialize additional array if needed
        if (!artwork.additional) {
            artwork.additional = [];
        }

        const addedImages: { file: string; title: string }[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = path.extname(file.name).toLowerCase() || '.jpg';
            const additionalSlug = `${slug}-add-${artwork.additional.length + i + 1}`;
            const destFilename = `${additionalSlug}${ext}`;
            const destPath = path.join(paths.originals, destFilename);

            // Save original
            const buffer = Buffer.from(await file.arrayBuffer());
            await fs.mkdir(paths.originals, { recursive: true });
            await fs.writeFile(destPath, buffer);

            // Process using centralized pipeline (file-based)
            const result = await processImage(
                destPath,
                additionalSlug,
                DEFAULT_CONFIG,
                { files: paths.files, thumbnails: paths.thumbnails }
            );

            // Create image object with auto-generated title
            // processImage returns files as { large: 'slug.webp', ... }
            const imageObj = {
                file: `${additionalSlug}.webp`,
                title: `Detail ${artwork.additional.length + i + 1}`
            };

            // Add to artwork
            artwork.additional.push(imageObj);
            addedImages.push(imageObj);
        }

        artwork.updatedAt = new Date().toISOString();
        await fs.writeFile(artworkPath, yaml.dump(artwork, { lineWidth: -1 }), 'utf-8');

        return new Response(JSON.stringify({ success: true, added: addedImages }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Add additional images failed:', error);
        return new Response(JSON.stringify({ error: 'Add additional images failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// DELETE - Remove additional image
export const DELETE: APIRoute = async ({ request }) => {
    try {
        const { slug, index } = await request.json();

        if (!slug || index === undefined) {
            return new Response(JSON.stringify({ error: 'Slug and index required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Load artwork
        const artworkPath = path.join(paths.content, 'artworks', `${slug}.yaml`);
        let artwork: any;
        try {
            const content = await fs.readFile(artworkPath, 'utf-8');
            artwork = yaml.load(content) as any;
        } catch {
            return new Response(JSON.stringify({ error: 'Artwork not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!artwork.additional || index >= artwork.additional.length) {
            return new Response(JSON.stringify({ error: 'Invalid index' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get the image to remove - handle both old string and new object format
        const imageToRemove = artwork.additional[index];
        const filename = typeof imageToRemove === 'string' ? imageToRemove : imageToRemove.file;
        const baseSlug = filename.replace('.webp', '');

        // Remove from array
        artwork.additional.splice(index, 1);
        artwork.updatedAt = new Date().toISOString();

        await fs.writeFile(artworkPath, yaml.dump(artwork, { lineWidth: -1 }), 'utf-8');

        // Optionally delete files (commented out for safety)
        // const sizes = ['large', 'medium', 'small'];
        // for (const size of sizes) {
        //   try { await fs.unlink(path.join(paths.files, size, `${baseSlug}.webp`)); } catch {}
        // }
        // try { await fs.unlink(path.join(paths.thumbnails, `${baseSlug}.png`)); } catch {}

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Remove additional image failed:', error);
        return new Response(JSON.stringify({ error: 'Remove additional image failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// PUT - Update additional image title
export const PUT: APIRoute = async ({ request }) => {
    try {
        const { slug, index, title } = await request.json();

        if (!slug || index === undefined || title === undefined) {
            return new Response(JSON.stringify({ error: 'Slug, index, and title required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Load artwork
        const artworkPath = path.join(paths.content, 'artworks', `${slug}.yaml`);
        let artwork: any;
        try {
            const content = await fs.readFile(artworkPath, 'utf-8');
            artwork = yaml.load(content) as any;
        } catch {
            return new Response(JSON.stringify({ error: 'Artwork not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!artwork.additional || index >= artwork.additional.length) {
            return new Response(JSON.stringify({ error: 'Invalid index' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Handle both old string and new object format
        const current = artwork.additional[index];
        if (typeof current === 'string') {
            // Convert old format to new format
            artwork.additional[index] = { file: current, title };
        } else {
            // Update title in existing object
            artwork.additional[index].title = title;
        }

        artwork.updatedAt = new Date().toISOString();
        await fs.writeFile(artworkPath, yaml.dump(artwork, { lineWidth: -1 }), 'utf-8');

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Update additional image title failed:', error);
        return new Response(JSON.stringify({ error: 'Update title failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
