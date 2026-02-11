/**
 * System Init API
 * 
 * POST /api/system/init
 * Initialize the project with sample content, fresh start, or import.
 */

import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getRepoPath, clearConfigCache } from '../../../lib/paths';

type InitMode = 'demo' | 'fresh' | 'import';

interface InitRequest {
    mode: InitMode;
    importPath?: string;  // For import mode
}

/**
 * Copy directory recursively
 */
function copyDirSync(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Create minimal settings.yaml for fresh start
 */
function createFreshSettings(): string {
    return `site:
  title: My Portfolio
  tagline: Artist Portfolio
  url: http://localhost:4321
  language: en
seo:
  description: My artist portfolio
  keywords:
    - art
    - portfolio
images:
  sizes:
    large: 2124
    medium: 1062
    small: 531
  quality: 85
theme:
  active: minimalist
`;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json() as InitRequest;
        const { mode, importPath } = body;

        if (!mode || !['demo', 'fresh', 'import'].includes(mode)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid mode. Must be "demo", "fresh", or "import".'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const repoRoot = getRepoPath();
        const contentDest = path.join(repoRoot, 'content');

        // Check if content already exists
        if (fs.existsSync(contentDest)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Content folder already exists. Delete it first or use a different location.'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        switch (mode) {
            case 'demo': {
                // Copy demo-site/user-data to /content
                const demoSrc = path.join(repoRoot, 'demo-site', 'user-data');

                if (!fs.existsSync(demoSrc)) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: 'Demo content not found at demo-site/user-data'
                    }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                copyDirSync(demoSrc, contentDest);

                // Also copy files if they exist
                const filesSrc = path.join(repoRoot, 'demo-site', 'files');
                const filesDest = path.join(repoRoot, 'files');
                if (fs.existsSync(filesSrc) && !fs.existsSync(filesDest)) {
                    copyDirSync(filesSrc, filesDest);
                }

                break;
            }

            case 'fresh': {
                // Create empty content structure
                fs.mkdirSync(contentDest, { recursive: true });
                fs.mkdirSync(path.join(contentDest, 'artworks'), { recursive: true });
                fs.mkdirSync(path.join(contentDest, 'collections'), { recursive: true });
                fs.mkdirSync(path.join(contentDest, 'pages'), { recursive: true });
                fs.mkdirSync(path.join(contentDest, 'settings'), { recursive: true });

                // Create core page content files
                fs.writeFileSync(
                    path.join(contentDest, 'pages', 'about.yaml'),
                    yaml.dump({
                        slug: 'about',
                        title: 'About',
                        template: 'about',
                        sortOrder: 1,
                        showInNav: true,
                        content: '',
                    }),
                    'utf-8'
                );

                // Create minimal settings
                fs.writeFileSync(
                    path.join(contentDest, 'settings', 'settings.yaml'),
                    createFreshSettings(),
                    'utf-8'
                );

                // Create pages/components directory for footer
                fs.mkdirSync(path.join(contentDest, 'pages', 'components'), { recursive: true });

                // Create empty footer
                fs.writeFileSync(
                    path.join(contentDest, 'pages', 'components', 'footer.yaml'),
                    'sections: []\n',
                    'utf-8'
                );

                break;
            }

            case 'import': {
                if (!importPath) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: 'Import path is required for import mode'
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Validate import path exists
                if (!fs.existsSync(importPath)) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: `Import path not found: ${importPath}`
                    }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Create symlink instead of copying
                fs.symlinkSync(importPath, contentDest, 'dir');

                break;
            }
        }

        // Clear cached paths so new content is picked up
        clearConfigCache();

        return new Response(JSON.stringify({
            success: true,
            mode,
            contentPath: contentDest,
            message: `Project initialized with ${mode} content`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
