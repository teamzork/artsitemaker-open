import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getContentPath } from '../../../lib/paths';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { slug, collection } = await request.json();

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug is required' }), { status: 400 });
    }

    const contentPath = getContentPath();
    const artworkPath = path.join(contentPath, 'artworks', `${slug}.yaml`);

    let content;
    try {
      content = await fs.readFile(artworkPath, 'utf-8');
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Artwork not found' }), { status: 404 });
    }

    const artwork = yaml.load(content) as any;
    
    // Update collection
    artwork.collection = collection || null; // standardizing null for uncategorized if empty string passed

    // Save back
    await fs.writeFile(artworkPath, yaml.dump(artwork), 'utf-8');

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    console.error('Failed to move artwork:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
