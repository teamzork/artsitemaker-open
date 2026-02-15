// packages/admin/src/pages/api/identity/logo.ts
// API endpoint for uploading Identity Kit logo assets
// Stores files in user-data/assets/logos/ and returns relative path

import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getUserAssetsPath } from '../../../lib/paths';
import {
    ALLOWED_IDENTITY_IMAGE_EXTENSIONS,
    ALLOWED_IDENTITY_IMAGE_MIME_TYPES,
    isAllowedImageExtension
} from '../../../lib/image-constants';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOGO_WIDTH = 400; // Max width for processed logos

/**
 * GET /api/identity/logo - List available logo files
 */
export const GET: APIRoute = async () => {
    try {
        const assetsPath = getUserAssetsPath();
        const logosPath = path.join(assetsPath, 'logos');

        // Ensure logos directory exists
        await fs.mkdir(logosPath, { recursive: true });

        // List files in logos directory
        const files = await fs.readdir(logosPath);
        const logos: { filename: string; path: string; url: string }[] = [];

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (isAllowedImageExtension(ext, ALLOWED_IDENTITY_IMAGE_EXTENSIONS)) {
                const relativePath = `logos/${file}`;
                logos.push({
                    filename: file,
                    path: relativePath,
                    url: `/user-assets/${relativePath}`
                });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            logos: logos.sort((a, b) => a.filename.localeCompare(b.filename))
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Failed to list logos:', error);
        return new Response(JSON.stringify({
            error: 'Failed to list logos: ' + (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get('logo') as File | null;

        if (!file) {
            return new Response(JSON.stringify({ error: 'No file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate file type
        if (!ALLOWED_IDENTITY_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IDENTITY_IMAGE_MIME_TYPES)[number])) {
            return new Response(JSON.stringify({
                error: `Invalid file type: ${file.type}. Allowed: PNG, JPG, WebP, SVG`
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return new Response(JSON.stringify({
                error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB`
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get user assets path
        const assetsPath = getUserAssetsPath();
        const logosPath = path.join(assetsPath, 'logos');

        // Ensure logos directory exists
        await fs.mkdir(logosPath, { recursive: true });

        // Generate safe filename
        const originalName = file.name;
        const ext = path.extname(originalName).toLowerCase();
        const baseName = path.basename(originalName, ext);

        if (!isAllowedImageExtension(ext, ALLOWED_IDENTITY_IMAGE_EXTENSIONS)) {
            return new Response(JSON.stringify({
                error: `Invalid file extension: ${ext}`
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Sanitize filename: remove special chars, spaces -> dashes
        const safeBaseName = baseName
            .toLowerCase()
            .replace(/[^a-z0-9\-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        let filename = `${safeBaseName}${ext}`;

        // Check if file exists, add number suffix if needed
        let counter = 1;
        const targetPath = () => path.join(logosPath, filename);

        while (await fileExists(targetPath())) {
            filename = `${safeBaseName}-${counter}${ext}`;
            counter++;
        }

        // Process and write file
        const buffer = Buffer.from(await file.arrayBuffer());

        // SVG files are not processed, just saved as-is
        if (ext === '.svg') {
            await fs.writeFile(targetPath(), buffer);
        } else {
            // Process raster images: resize if needed and optimize
            const image = sharp(buffer);
            const metadata = await image.metadata();

            // Resize if width exceeds max
            if (metadata.width && metadata.width > MAX_LOGO_WIDTH) {
                image.resize(MAX_LOGO_WIDTH, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                });
            }

            // Convert to appropriate format and optimize
            if (ext === '.png') {
                await image.png({ quality: 90, compressionLevel: 9 }).toFile(targetPath());
            } else if (ext === '.webp') {
                await image.webp({ quality: 90 }).toFile(targetPath());
            } else {
                // JPEG
                await image.jpeg({ quality: 90 }).toFile(targetPath());
            }
        }

        // Get final file size
        const stats = await fs.stat(targetPath());
        const relativePath = `logos/${filename}`;

        return new Response(JSON.stringify({
            success: true,
            path: relativePath,
            filename: filename,
            size: stats.size,
            url: `/user-assets/${relativePath}`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Logo upload failed:', error);
        return new Response(JSON.stringify({
            error: 'Upload failed: ' + (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const DELETE: APIRoute = async ({ request }) => {
    try {
        const { path: logoPath } = await request.json();

        if (!logoPath) {
            return new Response(JSON.stringify({ error: 'No logo path provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate path is within logos directory
        if (!logoPath.startsWith('logos/')) {
            return new Response(JSON.stringify({ error: 'Invalid logo path' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get user assets path
        const assetsPath = getUserAssetsPath();
        const filePath = path.join(assetsPath, logoPath);

        // Check if file exists and delete it
        if (await fileExists(filePath)) {
            await fs.unlink(filePath);

            return new Response(JSON.stringify({
                success: true,
                message: 'Logo deleted successfully'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({ error: 'Logo file not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        console.error('Logo deletion failed:', error);
        return new Response(JSON.stringify({
            error: 'Deletion failed: ' + (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// Helper to check if file exists
async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}
