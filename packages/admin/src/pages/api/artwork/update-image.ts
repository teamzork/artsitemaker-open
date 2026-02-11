import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getContentPath, getFilesPath, getThumbnailsPath } from '../../../lib/paths';

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const slug = formData.get('slug') as string;

        if (!file || !slug) {
            return new Response(JSON.stringify({ error: 'File and slug required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const contentPath = getContentPath();
        const filesPath = getFilesPath();
        const thumbnailsPath = getThumbnailsPath();

        // Get artwork to find original file extension
        const artworkPath = path.join(contentPath, 'artworks', `${slug}.yaml`);
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

        // Determine file extension
        const ext = path.extname(file.name).toLowerCase() || '.jpg';
        const destFilename = `${slug}${ext}`;
        const destPath = path.join(filesPath, 'originals', destFilename);

        // Delete old original if different extension
        if (artwork.processing?.originalFile && artwork.processing.originalFile !== destFilename) {
            try {
                await fs.unlink(path.join(filesPath, 'originals', artwork.processing.originalFile));
            } catch {
                // Old file might not exist
            }
        }

        // Save new file
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(destPath, buffer);

        // Update artwork YAML to clear processing (will be updated when reprocessed)
        artwork.processing = {
            originalFile: destFilename,
            originalDimensions: null,
            processedAt: null,
            warnings: [],
            aspectRatio: null,
            padded: false
        };
        artwork.updatedAt = new Date().toISOString();

        await fs.writeFile(artworkPath, yaml.dump(artwork, { lineWidth: -1 }), 'utf-8');

        // Trigger reprocessing
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Process the image via the API
        const sharp = (await import('sharp')).default;
        const image = sharp(destPath);
        const metadata = await image.metadata();

        const LARGE_SIZE = 2400;
        const sizes = { large: LARGE_SIZE, medium: 1200, small: 600, thumb: 150 };

        // Generate all sizes
        for (const [sizeName, targetWidth] of Object.entries(sizes)) {
            const isThumb = sizeName === 'thumb';
            const outputExt = isThumb ? 'png' : 'webp';
            const outputDir = isThumb ? thumbnailsPath : path.join(filesPath, sizeName);
            await fs.mkdir(outputDir, { recursive: true });
            const outputPath = path.join(outputDir, `${slug}.${outputExt}`);

            let processor = sharp(destPath).resize(targetWidth, undefined, {
                withoutEnlargement: false,
                fit: 'inside'
            });

            if (isThumb) {
                await processor.png().toFile(outputPath);
            } else {
                await processor.webp({ quality: 90 }).toFile(outputPath);
            }
        }

        // Update artwork with processing info
        artwork.primary = `${slug}.webp`;
        artwork.processing = {
            originalFile: destFilename,
            originalDimensions: [metadata.width || 0, metadata.height || 0],
            processedAt: new Date().toISOString(),
            warnings: (metadata.width || 0) < LARGE_SIZE ? ['upscaled'] : [],
            aspectRatio: (metadata.width || 1) / (metadata.height || 1),
            padded: false
        };
        artwork.updatedAt = new Date().toISOString();

        await fs.writeFile(artworkPath, yaml.dump(artwork, { lineWidth: -1 }), 'utf-8');

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Update image failed:', error);
        return new Response(JSON.stringify({ error: 'Update image failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
