
import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import { getFilesPath } from '@lib/paths';

export const GET: APIRoute = async ({ params }) => {
    const filePath = params.path;
    if (!filePath) {
        return new Response('Not found', { status: 404 });
    }

    const filesDir = getFilesPath();
    const absolutePath = path.join(filesDir, 'large', filePath);

    if (!absolutePath.startsWith(filesDir)) {
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

        const ext = path.extname(absolutePath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.webp') contentType = 'image/webp';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

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
