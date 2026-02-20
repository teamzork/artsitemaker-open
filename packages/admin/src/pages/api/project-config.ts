/**
 * Project Config API
 *
 * GET /api/project-config - Get configuration/project-configuration.yaml
 * PUT /api/project-config - Update configuration/project-configuration.yaml
 */

import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getProjectConfigPath } from '../../lib/config-paths';

function jsonResponse(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async () => {
  try {
    const configPath = getProjectConfigPath();
    const content = await fs.readFile(configPath, 'utf-8');
    const config = yaml.load(content);
    return jsonResponse({ config });
  } catch (error) {
    console.error('Failed to load project config:', error);
    return jsonResponse({ error: 'Failed to load project config' }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const configPath = getProjectConfigPath();
    const configDir = path.dirname(configPath);
    await fs.mkdir(configDir, { recursive: true });

    let existing: any = {};
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      existing = yaml.load(content) as any;
    } catch {
      // File doesn't exist, start fresh
    }

    const updates = await request.json();
    const merged = { ...existing, ...updates };
    // Deep merge deploy
    if (updates?.deploy) {
      merged.deploy = { ...(existing.deploy || {}), ...(updates.deploy || {}) };
      if (existing.deploy?.cloudflarePages || updates.deploy?.cloudflarePages) {
        merged.deploy.cloudflarePages = {
          ...(existing.deploy?.cloudflarePages || {}),
          ...(updates.deploy?.cloudflarePages || {}),
        };
        if (
          existing.deploy?.cloudflarePages?.customDomain ||
          updates.deploy?.cloudflarePages?.customDomain
        ) {
          merged.deploy.cloudflarePages.customDomain = {
            ...(existing.deploy?.cloudflarePages?.customDomain || {}),
            ...(updates.deploy?.cloudflarePages?.customDomain || {}),
          };
        }
      }
    }
    // Deep merge auth (preserve passwordHash when saving method/username from form)
    if (updates?.auth) {
      merged.auth = { ...(existing.auth || {}), ...(updates.auth || {}) };
      if (existing.auth?.basic || updates.auth?.basic) {
        merged.auth.basic = {
          ...(existing.auth?.basic || {}),
          ...(updates.auth?.basic || {}),
        };
      }
      if (existing.auth?.github || updates.auth?.github) {
        merged.auth.github = {
          ...(existing.auth?.github || {}),
          ...(updates.auth?.github || {}),
        };
      }
    }

    await fs.writeFile(
      configPath,
      yaml.dump(merged, { lineWidth: -1, quotingType: '"' as const }),
      'utf-8',
    );

    return jsonResponse({ success: true, config: merged });
  } catch (error) {
    console.error('Failed to save project config:', error);
    return jsonResponse({ error: 'Failed to save project config' }, 500);
  }
};
