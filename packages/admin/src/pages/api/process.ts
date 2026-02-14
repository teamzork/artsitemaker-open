import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import {
    slugify,
    generateSizesFromPath,
    getDefaultPaths,
    type ProcessingResult
} from '../../lib/image-pipeline';
import { checkImageServer } from '../../lib/image-server-check';
import { getSettingsFilePath } from '../../lib/config-paths';

const paths = getDefaultPaths();

export const POST: APIRoute = async ({ request }) => {
    try {
        // Check if image server is running (only for local storage)
        const imageStorage = process.env.IMAGE_STORAGE || 'local';
        if (imageStorage === 'local') {
            const serverStatus = await checkImageServer();
            if (!serverStatus.isRunning) {
                return new Response(JSON.stringify({
                    processed: [],
                    errors: [
                        'Image server is not running on port 3001. Start it with: npx serve files -p 3001 --cors'
                    ]
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Load settings to get publishOnImport preference
        let settings: any = {};
        try {
            const settingsPath = getSettingsFilePath();
            const settingsContent = await fs.readFile(settingsPath, 'utf-8');
            settings = yaml.load(settingsContent) as any;
        } catch (e) {
            // Use defaults if settings not found
        }

        const publishOnImport = settings.gallery?.publishOnImport === true;

        const body = await request.json().catch(() => ({}));
        const slugsToProcess: string[] = body.slugs || []; // Empty means process all

        // Get list of originals to process
        let files: string[] = [];

        try {
            files = await fs.readdir(paths.originals);
            files = files.filter(f => /\.(jpg|jpeg|png|webp|tiff|tif|heic|heif)$/i.test(f));
        } catch (e) {
            return new Response(JSON.stringify({
                processed: [],
                errors: ['No originals folder found']
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Filter if specific slugs requested
        // Normalize requested slugs (slugify removes trailing dashes, so normalize for comparison)
        if (slugsToProcess.length > 0) {
            const normalizedSlugs = slugsToProcess.map(s => slugify(s));
            files = files.filter(f => {
                const slug = slugify(path.basename(f, path.extname(f)));
                return normalizedSlugs.includes(slug);
            });
        }

        const processed: ProcessingResult[] = [];
        const errors: string[] = [];

        for (const file of files) {
            const inputPath = path.join(paths.originals, file);
            const ext = path.extname(file);
            const baseName = path.basename(file, ext);
            const slug = slugify(baseName);

            try {
                // Process image using centralized pipeline
                const result = await generateSizesFromPath(inputPath, slug);

                // Update or Create artwork YAML
                // Try to find existing artwork file - check both normalized slug and original slug variations
                const artworkDir = path.join(paths.content, 'artworks');
                let artworkPath = path.join(artworkDir, `${slug}.yaml`);
                let artwork: any = {};
                
                try {
                    const artworkContent = await fs.readFile(artworkPath, 'utf-8');
                    artwork = yaml.load(artworkContent) as any;
                } catch (e) {
                    // Try to find artwork file with different slug variations (e.g., trailing dash)
                    // This handles cases where artwork slug doesn't match slugified filename
                    try {
                        const artworkFiles = await fs.readdir(artworkDir);
                        const matchingFile = artworkFiles.find(f => {
                            if (!f.endsWith('.yaml')) return false;
                            const fileSlug = path.basename(f, '.yaml');
                            // Check if slugifying the file slug matches our slug
                            return slugify(fileSlug) === slug;
                        });
                        
                        if (matchingFile) {
                            artworkPath = path.join(artworkDir, matchingFile);
                            const artworkContent = await fs.readFile(artworkPath, 'utf-8');
                            artwork = yaml.load(artworkContent) as any;
                        } else {
                            throw e; // Re-throw if no match found
                        }
                    } catch (e2) {
                        // YAML file doesn't exist, create default entry
                        const title = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        artwork = {
                            slug,
                            title,
                            year: null,
                            medium: null,
                            dimensions: null,
                            description: null,
                            collection: null,
                            tags: [],
                            sortOrder: 999, // Will be placed at the end
                            sold: false,
                            price: null,
                            currency: 'USD',
                            inquireOnly: false,
                            createdAt: new Date().toISOString(),
                            published: publishOnImport
                        };
                    }
                }
                
                // Ensure artwork slug matches the processed slug (normalize it)
                // This fixes cases where artwork has trailing dash but slugify removes it
                const oldSlug = artwork.slug;
                const slugChanged = oldSlug && slugify(oldSlug) !== slug;
                const oldArtworkPath = slugChanged ? artworkPath : null;
                
                if (slugChanged) {
                    // Update slug to normalized version
                    artwork.slug = slug;
                    // Update artwork path to use normalized slug
                    artworkPath = path.join(artworkDir, `${slug}.yaml`);
                }

                artwork.primary = `${slug}.webp`;
                artwork.processing = {
                    originalFile: file,
                    originalDimensions: result.dimensions.original,
                    processedAt: new Date().toISOString(),
                    warnings: result.warnings,
                    aspectRatio: result.aspectRatio,
                    padded: result.padded
                };
                artwork.updatedAt = new Date().toISOString();

                // Write to normalized slug filename
                await fs.writeFile(artworkPath, yaml.dump(artwork, { lineWidth: -1 }), 'utf-8');
                
                // If slug changed, delete old artwork file if it exists and is different
                if (slugChanged && oldArtworkPath && oldArtworkPath !== artworkPath) {
                    try {
                        await fs.unlink(oldArtworkPath);
                    } catch {
                        // Old file might not exist, that's fine
                    }
                }

                processed.push(result);

            } catch (e) {
                console.error(`Failed to process ${file}:`, e);
                errors.push(`${file}: ${(e as Error).message}`);
            }
        }

        return new Response(JSON.stringify({ processed, errors }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Processing failed:', error);
        return new Response(JSON.stringify({ error: 'Processing failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
