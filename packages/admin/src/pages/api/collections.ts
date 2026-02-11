
import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getContentPath } from '../../lib/paths';

export const GET: APIRoute = async () => {
    try {
        const contentPath = getContentPath();
        const collectionsPath = path.join(contentPath, 'collections');
        
        try {
            await fs.access(collectionsPath);
        } catch {
             return new Response(JSON.stringify([]), { status: 200, headers: {'Content-Type': 'application/json'} });
        }

        const files = await fs.readdir(collectionsPath);
        const collections = [];

        for (const file of files) {
            if (file.endsWith('.yaml')) {
                const content = await fs.readFile(path.join(collectionsPath, file), 'utf-8');
                collections.push(yaml.load(content));
            }
        }
        
        return new Response(JSON.stringify(collections), { status: 200, headers: {'Content-Type': 'application/json'} });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to list collections' }), { status: 500 });
    }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { title, slug } = await request.json();
    
    if (!title || !slug) {
      return new Response(JSON.stringify({ error: 'Title and slug are required' }), { status: 400 });
    }
    
    const contentPath = getContentPath();
    const collectionsPath = path.join(contentPath, 'collections');
    
    // Ensure directory exists
    try {
      await fs.access(collectionsPath);
    } catch {
      await fs.mkdir(collectionsPath, { recursive: true });
    }
    
    const filePath = path.join(collectionsPath, `${slug}.yaml`);
    
    // Check if exists
    try {
        await fs.access(filePath);
        return new Response(JSON.stringify({ error: 'Collection already exists' }), { status: 409 });
    } catch {}

    const collectionData = {
        title,
        slug,
        createdAt: new Date().toISOString()
    };
    
    await fs.writeFile(filePath, yaml.dump(collectionData), 'utf-8');
    
    return new Response(JSON.stringify({ success: true, collection: collectionData }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Failed to create collection' }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request }) => {
    try {
        const { slug, title } = await request.json();
        
        if (!slug || !title) {
            return new Response(JSON.stringify({ error: 'Slug and title are required' }), { status: 400 });
        }

        const contentPath = getContentPath();
        const filePath = path.join(contentPath, 'collections', `${slug}.yaml`);

        let data: any = {};
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            data = yaml.load(content);
        } catch {
            return new Response(JSON.stringify({ error: 'Collection not found' }), { status: 404 });
        }

        data.title = title;
        
        await fs.writeFile(filePath, yaml.dump(data), 'utf-8');

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to update collection' }), { status: 500 });
    }
}

export const DELETE: APIRoute = async ({ request }) => {
    try {
        const { slug } = await request.json();
        if (!slug) return new Response(JSON.stringify({ error: 'Slug required' }), { status: 400 });

        const contentPath = getContentPath();
        const filePath = path.join(contentPath, 'collections', `${slug}.yaml`);
        
        await fs.unlink(filePath);
        
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to delete collection' }), { status: 500 });
    }
}
