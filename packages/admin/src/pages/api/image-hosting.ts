/**
 * Image Hosting Config API
 *
 * GET /api/image-hosting - Get configuration/image-hosting.yaml
 * PUT /api/image-hosting - Update configuration/image-hosting.yaml
 */

import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getImageHostingConfigPath } from '../../lib/config-paths';

export const GET: APIRoute = async () => {
  try {
    const configPath = getImageHostingConfigPath();
    const content = await fs.readFile(configPath, 'utf-8');
    const config = yaml.load(content);

    return new Response(JSON.stringify(config), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to load image hosting config:', error);
    return new Response(JSON.stringify({ error: 'Failed to load image hosting config' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const configPath = getImageHostingConfigPath();
    const configDir = path.dirname(configPath);

    // Load existing config
    let existing: any = {};
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      existing = yaml.load(content) as any;
    } catch {
      // File doesn't exist yet
    }

    const updates = await request.json();
    const merged = deepMerge(existing, updates);

    const yamlContent = yaml.dump(merged, {
      lineWidth: -1,
      quotingType: '"'
    });

    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(configPath, yamlContent, 'utf-8');

    return new Response(JSON.stringify({ success: true, config: merged }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to save image hosting config:', error);
    return new Response(JSON.stringify({ error: 'Failed to save image hosting config' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key of Object.keys(source || {})) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}
