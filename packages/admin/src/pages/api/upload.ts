import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getContentPath } from '../../lib/paths';
import { getSettingsFilePath } from '../../lib/config-paths';
import { slugify, validateUpload, processImageFromBuffer } from '../../lib/image-pipeline';

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const files = formData.getAll('images');
        const publishOnImport = formData.get('publishOnImport') === 'true';

        const results = {
            uploaded: [] as { filename: string; slug: string; size: number }[],
            errors: [] as string[]
        };

        const contentPath = getContentPath();

        // Load settings to get newArtworkOrder preference
        let settings: any = {};
        try {
            const settingsPath = getSettingsFilePath();
            const settingsContent = await fs.readFile(settingsPath, 'utf-8');
            settings = yaml.load(settingsContent) as any;
        } catch (e) {
            // Use defaults if settings not found
        }

        const newArtworkOrder = settings.gallery?.newArtworkOrder || 'end';

        // Ensure artworks directory exists
        const artworksPath = path.join(contentPath, 'artworks');
        await fs.mkdir(artworksPath, { recursive: true });

        // Get existing artworks to determine sortOrder
        let existingArtworks: { slug: string; sortOrder: number; path: string }[] = [];
        try {
            const artworkFiles = await fs.readdir(artworksPath);
            for (const file of artworkFiles) {
                if (file.endsWith('.yaml')) {
                    const content = await fs.readFile(path.join(artworksPath, file), 'utf-8');
                    const artwork = yaml.load(content) as any;
                    existingArtworks.push({
                        slug: artwork.slug,
                        sortOrder: artwork.sortOrder || 0,
                        path: path.join(artworksPath, file)
                    });
                }
            }
            existingArtworks.sort((a, b) => a.sortOrder - b.sortOrder);
        } catch (e) {
            // No existing artworks
        }

        // Calculate starting sortOrder for new artworks
        let nextSortOrder: number;
        if (newArtworkOrder === 'beginning') {
            // New artworks get lowest numbers, shift existing up
            nextSortOrder = 1;
            // We'll shift existing artworks after we count how many new ones we're adding
        } else {
            // Add to end - find max sortOrder
            const maxOrder = existingArtworks.reduce((max, a) => Math.max(max, a.sortOrder), 0);
            nextSortOrder = maxOrder + 1;
        }

        // Count valid files first (for shifting calculation)
        const validFiles: File[] = [];
        for (const file of files) {
            if (!(file instanceof File)) continue;

            const validation = validateUpload(file);
            if (!validation.valid) continue;

            const slug = slugify(path.basename(file.name, path.extname(file.name)));
            const artworkPath = path.join(artworksPath, `${slug}.yaml`);
            try {
                await fs.access(artworkPath);
                // Already exists, skip
            } catch {
                validFiles.push(file);
            }
        }

        // If adding to beginning, shift existing artworks
        if (newArtworkOrder === 'beginning' && validFiles.length > 0) {
            for (const existing of existingArtworks) {
                try {
                    const content = await fs.readFile(existing.path, 'utf-8');
                    const artwork = yaml.load(content) as any;
                    artwork.sortOrder = (artwork.sortOrder || 0) + validFiles.length;
                    await fs.writeFile(existing.path, yaml.dump(artwork, { lineWidth: -1 }), 'utf-8');
                } catch (e) {
                    console.error(`Failed to shift artwork ${existing.slug}:`, e);
                }
            }
        }

        let currentSortOrder = nextSortOrder;

        for (const file of files) {
            if (!(file instanceof File)) continue;

            try {
                // Validate file
                const validation = validateUpload(file);
                if (!validation.valid) {
                    results.errors.push(`${file.name}: ${validation.error}`);
                    continue;
                }

                // Generate slug for the filename
                const slug = slugify(path.basename(file.name, path.extname(file.name)));

                // Check if artwork already exists
                const artworkPath = path.join(artworksPath, `${slug}.yaml`);
                try {
                    await fs.access(artworkPath);
                    results.errors.push(`${file.name}: Artwork ${slug} already exists`);
                    continue;
                } catch {
                    // Doesn't exist, proceed with upload
                }

                // Process image and upload to storage (R2 or local)
                const buffer = Buffer.from(await file.arrayBuffer());
                const processResult = await processImageFromBuffer(buffer, slug);

                // Create artwork YAML
                const baseName = path.basename(file.name, path.extname(file.name));
                const title = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                const artwork = {
                    slug,
                    title,
                    year: null,
                    medium: null,
                    dimensions: null,
                    description: null,
                    collection: null,
                    tags: [],
                    sortOrder: currentSortOrder++,
                    sold: false,
                    price: null,
                    currency: 'USD',
                    inquireOnly: false,
                    primary: `${slug}.webp`,
                    processing: {
                        originalFile: file.name,
                        originalDimensions: processResult.dimensions.original,
                        processedAt: new Date().toISOString(),
                        warnings: processResult.warnings,
                        aspectRatio: processResult.aspectRatio,
                        padded: processResult.padded
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    published: publishOnImport
                };

                await fs.writeFile(artworkPath, yaml.dump(artwork, { lineWidth: -1 }), 'utf-8');

                results.uploaded.push({
                    filename: file.name,
                    slug,
                    size: file.size
                });

            } catch (e) {
                console.error(`Failed to upload ${file.name}:`, e);
                results.errors.push(`${file.name}: ${(e as Error).message}`);
            }
        }

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Upload failed:', error);
        return new Response(JSON.stringify({ error: 'Upload failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
