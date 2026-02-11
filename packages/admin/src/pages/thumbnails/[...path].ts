
import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import { getThumbnailsPath } from '@lib/paths';

export const GET: APIRoute = async ({ params }) => {
    const filePath = params.path;
    if (!filePath) {
        return new Response('Not found', { status: 404 });
    }

    const thumbnailsDir = getThumbnailsPath();
    const absolutePath = path.join(thumbnailsDir, filePath);

    // Security check: ensure the path is inside the thumbnails directory
    // Prevent directory traversal attacks
    if (!absolutePath.startsWith(thumbnailsDir)) {
        return new Response('Forbidden', { status: 403 });
    }

    try {
        const fileHandle = await fs.open(absolutePath, 'r');
        const stat = await fileHandle.stat();
        if (!stat.isFile()) {
            await fileHandle.close();
            return new Response('Not found', { status: 404 });
        }
        const fileBuffer = await fileHandle.readFile();
        await fileHandle.close();

        // Determine content type based on extension (simple version)
        const ext = path.extname(absolutePath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.webp') contentType = 'image/webp';
        else if (ext === '.gif') contentType = 'image/gif';

        return new Response(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        return new Response('Not found', { status: 404 });
    }
};
