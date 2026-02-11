/**
 * Settings File API
 *
 * POST /api/settings-file - Read settings.yaml from a provided content path
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

    // Support new configuration structure: settings are now in settings/settings.yaml
    // Try new path first, fall back to legacy path
    let settingsPath: string;
    if (resolvedPath.endsWith('.yaml')) {
      settingsPath = resolvedPath;
    } else {
      // Try new path: content/settings/settings.yaml
      const newPath = path.join(resolvedPath, 'settings', 'settings.yaml');
      const legacyPath = path.join(resolvedPath, 'settings.yaml');

      try {
        await fs.access(newPath);
        settingsPath = newPath;
      } catch {
        // Fall back to legacy path
        settingsPath = legacyPath;
      }
    }

    const content = await fs.readFile(settingsPath, 'utf-8');
    const settings = yaml.load(content);

    return new Response(
      JSON.stringify({ settings, path: resolvedPath }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Failed to load settings file:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load settings file' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
