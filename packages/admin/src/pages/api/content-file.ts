
import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import { getContentPath } from '../../lib/paths';

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const { filename } = await request.json();

    if (!filename) {
      return new Response(JSON.stringify({ error: 'Filename is required' }), { status: 400 });
    }

    // Security check: simple filename only, no paths
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return new Response(JSON.stringify({ error: 'Invalid filename' }), { status: 400 });
    }

    const contentPath = getContentPath();
    const filePath = path.join(contentPath, filename);

    // Check if file exists and is a file (not dir)
    try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            return new Response(JSON.stringify({ error: 'Target is not a file' }), { status: 400 });
        }
    } catch {
        return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
    }

    // Delete
    await fs.unlink(filePath);

    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('Delete failed:', error);
    return new Response(JSON.stringify({ error: 'Delete failed' }), { status: 500 });
  }
};
