import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getContentPath, getSettingsPath } from '../lib/paths';

// AI training bot user-agents to block
const AI_BOTS = [
    'GPTBot',
    'ChatGPT-User',
    'Google-Extended',
    'CCBot',
    'anthropic-ai',
    'Claude-Web',
    'Bytespider',
    'Diffbot',
    'FacebookBot',
    'cohere-ai',
];

export const GET: APIRoute = async () => {
    let disallowAiTraining = false;
    let siteUrl = '';

    try {
        const content = await fs.readFile(getSettingsPath(), 'utf-8');
        const settings = yaml.load(content) as any;
        disallowAiTraining = settings.seo?.disallowAiTraining === true;
        siteUrl = settings.site?.url || '';
    } catch (e) {
        // Settings not found, use defaults
    }

    // Build robots.txt content
    let robotsTxt = `# robots.txt for ${siteUrl || 'ArtSiteMaker Gallery'}
# Generated dynamically

User-agent: *
Allow: /

# Sitemap
${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml` : '# Sitemap: (configure site URL in settings)'}
`;

    // Add AI bot blocking rules if enabled
    if (disallowAiTraining) {
        robotsTxt += `
# AI Training Bots - Disallowed
# Use of art images from this website for AI training is not permitted without special arrangements.

`;
        for (const bot of AI_BOTS) {
            robotsTxt += `User-agent: ${bot}
Disallow: /

`;
        }
    }

    return new Response(robotsTxt.trim(), {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        }
    });
};
