// packages/admin/src/pages/api/theme-preview/[theme].ts
import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import { getThemesPath } from '../../../lib/paths';

export const GET: APIRoute = async ({ params }) => {
  const themeName = params.theme;

  if (!themeName) {
    return new Response('Theme not specified', { status: 400 });
  }

  const previewPath = path.join(getThemesPath(), themeName, 'assets', 'preview.png');
  
  try {
    const imageBuffer = await fs.readFile(previewPath);
    
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (e) {
    // Return a 404 if preview doesn't exist
    return new Response('Preview not found', { status: 404 });
  }
};



