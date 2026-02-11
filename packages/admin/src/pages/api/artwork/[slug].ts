import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getContentPath } from '../../../lib/paths';

// GET - Fetch artwork
export const GET: APIRoute = async ({ params }) => {
    const { slug } = params;

    try {
        const artworkPath = path.join(getContentPath(), 'artworks', `${slug}.yaml`);
        const content = await fs.readFile(artworkPath, 'utf-8');
        const artwork = yaml.load(content);

        return new Response(JSON.stringify(artwork), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Artwork not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// PUT - Update artwork
export const PUT: APIRoute = async ({ params, request }) => {
    const { slug } = params;

    try {
        const artworkPath = path.join(getContentPath(), 'artworks', `${slug}.yaml`);

        // Load existing artwork
        const existingContent = await fs.readFile(artworkPath, 'utf-8');
        const existing = yaml.load(existingContent) as any;

        // Get updates from request
        const updates = await request.json();

        // Merge updates (preserving processing metadata and other fields)
        const updated = {
            ...existing,
            ...updates,
            slug: existing.slug, // Don't allow slug change via this endpoint
            primary: existing.primary, // Preserve image fields
            additional: existing.additional,
            processing: existing.processing,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
        };

        // Write back to file
        const yamlContent = yaml.dump(updated, {
            lineWidth: -1,
            quotingType: '"',
            forceQuotes: false
        });
        await fs.writeFile(artworkPath, yamlContent, 'utf-8');

        return new Response(JSON.stringify({ success: true, artwork: updated }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('Failed to update artwork:', e);
        return new Response(JSON.stringify({ error: 'Failed to update artwork' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// PATCH - Partial update artwork (e.g., toggle published status)
export const PATCH: APIRoute = async ({ params, request }) => {
    const { slug } = params;

    try {
        const artworkPath = path.join(getContentPath(), 'artworks', `${slug}.yaml`);

        // Load existing artwork
        const existingContent = await fs.readFile(artworkPath, 'utf-8');
        const existing = yaml.load(existingContent) as any;

        // Get partial updates from request
        const updates = await request.json();

        // Merge only the provided fields
        const updated = {
            ...existing,
            ...updates,
            slug: existing.slug, // Don't allow slug change
            updatedAt: new Date().toISOString(),
        };

        // Write back to file
        const yamlContent = yaml.dump(updated, {
            lineWidth: -1,
            quotingType: '"',
            forceQuotes: false
        });
        await fs.writeFile(artworkPath, yamlContent, 'utf-8');

        return new Response(JSON.stringify({ success: true, artwork: updated }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('Failed to update artwork:', e);
        return new Response(JSON.stringify({ error: 'Failed to update artwork' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// DELETE - Delete artwork
export const DELETE: APIRoute = async ({ params }) => {
    const { slug } = params;

    try {
        const artworkPath = path.join(getContentPath(), 'artworks', `${slug}.yaml`);

        // Check if file exists
        await fs.access(artworkPath);

        // Delete the YAML file
        await fs.unlink(artworkPath);

        // TODO: Optionally delete associated image files
        // const filesPath = path.resolve(process.cwd(), '../../files');
        // await fs.unlink(path.join(filesPath, 'originals', `${slug}.jpg`));
        // etc.

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('Failed to delete artwork:', e);
        return new Response(JSON.stringify({ error: 'Failed to delete artwork' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
