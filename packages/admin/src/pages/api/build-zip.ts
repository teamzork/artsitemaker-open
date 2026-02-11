import type { APIRoute } from 'astro';
import archiver from 'archiver';
import { Readable } from 'stream';
import { buildSite } from '../../lib/build';

function getArchiveName(): string {
    const date = new Date().toISOString().slice(0, 10);
    return `artsitemaker-site-${date}.zip`;
}

export const POST: APIRoute = async () => {
    try {
        const { distPath } = await buildSite();

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('warning', (warning) => {
            if (warning.code !== 'ENOENT') {
                console.warn('Zip warning:', warning);
            }
        });
        archive.on('error', (zipError) => {
            console.error('Zip error:', zipError);
        });
        archive.directory(distPath, false);
        archive.finalize();

        const stream = Readable.toWeb(archive) as ReadableStream;

        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${getArchiveName()}"`,
            },
        });
    } catch (error: any) {
        console.error('Build zip failed:', error);
        
        // Extract more detailed error information
        let errorDetails = (error as Error).message;
        if (error.stdout) {
            errorDetails += '\n\nStdout:\n' + error.stdout;
        }
        if (error.stderr) {
            errorDetails += '\n\nStderr:\n' + error.stderr;
        }
        
        return new Response(JSON.stringify({
            error: 'Build and zip failed.',
            details: errorDetails,
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
