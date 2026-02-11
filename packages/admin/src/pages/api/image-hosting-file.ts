/**
 * Image Hosting Config File API
 *
 * POST /api/image-hosting-file - Read configuration/image-hosting.yaml
 * from a provided content path.
 */

import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { resolveUserPath } from '../../lib/path-utils';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { path: inputPath } = await request.json();

    if (!inputPath || typeof inputPath !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Path is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const resolvedPath = resolveUserPath(inputPath);
    const configPath = resolvedPath.endsWith('.yaml')
      ? resolvedPath
      : path.join(resolvedPath, 'configuration', 'image-hosting.yaml');

    try {
      await fs.access(configPath);
    } catch {
      return new Response(
        JSON.stringify({ config: {}, missing: true, path: resolvedPath }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const content = await fs.readFile(configPath, 'utf-8');
    const config = yaml.load(content);

    return new Response(
      JSON.stringify({ config, path: resolvedPath }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Failed to load image hosting config file:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load image hosting config file' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
