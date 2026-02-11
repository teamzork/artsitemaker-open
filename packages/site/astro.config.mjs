import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

/**
 * Get user data path for both dev and build
 * Supports both user-data (new) and content (deprecated) directory names
 * Priority:
 * 1. user-data-path.yaml bootstrap file
 * 2. Auto-discovery of user-data or content folders
 */

// Cache for performance - but always validate on each call
let cachedUserDataPath = null;
let cachedBootstrapMtime = 0;

function getUserDataPath() {
    // Try to resolve artis root (when running from packages/site)
    const artisRoot = path.resolve(process.cwd(), '../..');
    const bootstrapPath = path.join(artisRoot, 'artis.config.yaml');
    
    // ALWAYS check if bootstrap file has changed (no skipping)
    // This ensures live switching between user data folders works
    if (fs.existsSync(bootstrapPath)) {
        try {
            const stats = fs.statSync(bootstrapPath);
            // Clear cache if file changed OR if this is the first read
            if (cachedBootstrapMtime !== stats.mtimeMs) {
                cachedUserDataPath = null;
                cachedBootstrapMtime = stats.mtimeMs;
            }
        } catch (error) {
            // Ignore stat errors
        }
    } else {
        // Config file was deleted - clear cache
        if (cachedBootstrapMtime !== 0) {
            cachedUserDataPath = null;
            cachedBootstrapMtime = 0;
        }
    }
    
    // Return cached value if still valid
    if (cachedUserDataPath !== null) {
        return cachedUserDataPath;
    }
    
    // Priority 1: Check artis.config.yaml bootstrap file
    if (fs.existsSync(bootstrapPath)) {
        try {
            const content = fs.readFileSync(bootstrapPath, 'utf-8');
            const config = yaml.load(content);
            const pathValue = config?.userDataPath || config?.contentPath;
            
            if (pathValue) {
                // Resolve relative paths from artis root
                let resolved;
                if (path.isAbsolute(pathValue)) {
                    resolved = pathValue;
                } else if (pathValue.startsWith('~/')) {
                    const home = process.env.HOME || process.env.USERPROFILE || '';
                    resolved = path.join(home, pathValue.slice(2));
                } else {
                    resolved = path.resolve(artisRoot, pathValue);
                }
                
                if (fs.existsSync(resolved)) {
                    cachedUserDataPath = resolved;
                    return cachedUserDataPath;
                }
            }
        } catch (error) {
            console.warn('Failed to read artis.config.yaml:', error);
        }
    }
    
    // Priority 2: Auto-discovery
    const possiblePaths = [
        // Check user-data first (new naming)
        path.resolve(process.cwd(), '../..', 'user-data'),
        path.resolve(process.cwd(), '..', '..', 'user-data'),
        path.resolve(process.cwd(), 'user-data'),
        // Fallback to content (deprecated naming)
        path.resolve(process.cwd(), '../..', 'content'),
        path.resolve(process.cwd(), '..', '..', 'content'),
        path.resolve(process.cwd(), 'content'),
    ];
    
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

/** @deprecated Use getUserDataPath() instead */
const getContentPath = getUserDataPath;

/**
 * Vite plugin to serve user assets during development
 * Serves both /user-assets/* and /content-assets/* from user-data/assets/*
 */
function serveUserAssets() {
    return {
        name: 'serve-user-assets',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                // Support both /user-assets/* (new) and /content-assets/* (deprecated)
                if (req.url && (req.url.startsWith('/user-assets/') || req.url.startsWith('/content-assets/'))) {
                    const userDataPath = getUserDataPath();
                    if (!userDataPath) {
                        return next();
                    }
                    
                    const prefix = req.url.startsWith('/user-assets/') ? '/user-assets/' : '/content-assets/';
                    const assetPath = req.url.substring(prefix.length);
                    // Prevent directory traversal
                    const sanitizedPath = assetPath.replace(/\.\.\//g, '').replace(/\\/g, '');
                    const filePath = path.join(userDataPath, 'assets', sanitizedPath);
                    
                    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                        let contentType = 'application/octet-stream';
                        if (filePath.endsWith('.png')) contentType = 'image/png';
                        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
                        else if (filePath.endsWith('.webp')) contentType = 'image/webp';
                        else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
                        else if (filePath.endsWith('.woff2')) contentType = 'font/woff2';
                        else if (filePath.endsWith('.woff')) contentType = 'font/woff';
                        else if (filePath.endsWith('.ttf')) contentType = 'font/ttf';
                        
                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Cache-Control', 'public, max-age=3600');
                        fs.createReadStream(filePath).pipe(res);
                        return;
                    }
                }
                next();
            });
        }
    };
}

/** @deprecated Use serveUserAssets() instead */
const serveContentAssets = serveUserAssets;

/**
 * Vite plugin to copy user assets to the build output
 * Copies user-data/assets/* to dist/user-assets/* for static builds
 * Also copies to dist/content-assets/* for backward compatibility during migration
 */
function copyUserAssets() {
    return {
        name: 'copy-user-assets',
        enforce: 'post',
        async closeBundle() {
            try {
                const userDataPath = getUserDataPath();
                
                if (!userDataPath) {
                    console.log('⚠️  User data path not found, skipping user-assets copy');
                    return;
                }
                
                const assetsSource = path.join(userDataPath, 'assets');
                
                if (!fs.existsSync(assetsSource)) {
                    console.log('ℹ️  No user-data/assets directory found, skipping copy');
                    return;
                }
                
                // Copy files recursively helper
                function copyRecursive(src, dest) {
                    const entries = fs.readdirSync(src, { withFileTypes: true });
                    
                    for (const entry of entries) {
                        const srcPath = path.join(src, entry.name);
                        const destPath = path.join(dest, entry.name);
                        
                        if (entry.isDirectory()) {
                            fs.mkdirSync(destPath, { recursive: true });
                            copyRecursive(srcPath, destPath);
                        } else {
                            fs.copyFileSync(srcPath, destPath);
                        }
                    }
                }
                
                // Copy to new location (user-assets)
                const userAssetsDest = path.resolve(process.cwd(), 'dist', 'user-assets');
                fs.mkdirSync(userAssetsDest, { recursive: true });
                copyRecursive(assetsSource, userAssetsDest);
                console.log('✓ Copied user assets to dist/user-assets');
                
                // Also copy to old location (content-assets) for backward compatibility
                const contentAssetsDest = path.resolve(process.cwd(), 'dist', 'content-assets');
                fs.mkdirSync(contentAssetsDest, { recursive: true });
                copyRecursive(assetsSource, contentAssetsDest);
                console.log('✓ Copied user assets to dist/content-assets (backward compatibility)');
            } catch (error) {
                console.error('Failed to copy user assets:', error);
            }
        }
    };
}

/** @deprecated Use copyUserAssets() instead */
const copyContentAssets = copyUserAssets;

/**
 * Vite plugin to serve local images (files) during development
 * Replaces the need for symlinks in public/ folder
 * Serves /small/*, /medium/*, /large/*, /originals/*, /thumbnails/* from files/*
 */
function serveLocalImages() {
    return {
        name: 'serve-local-images',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const variants = ['/small/', '/medium/', '/large/', '/originals/', '/thumbnails/'];
                const matchingVariant = variants.find(v => req.url && req.url.startsWith(v));
                
                if (matchingVariant) {
                    // Find files directory (at artis root)
                    const possibleFilesPaths = [
                        path.resolve(process.cwd(), '../..', 'files'),
                        path.resolve(process.cwd(), '..', '..', 'files'),
                        path.resolve(process.cwd(), 'files'),
                    ];
                    
                    let filesPath = null;
                    for (const p of possibleFilesPaths) {
                        if (fs.existsSync(p)) {
                            filesPath = p;
                            break;
                        }
                    }
                    
                    if (!filesPath) {
                        // Try inside site project if configured?
                        // For now default to standard artis layout
                        return next();
                    }
                    
                    const variantName = matchingVariant.replace(/\//g, '');
                    const assetPath = req.url.substring(matchingVariant.length);
                    // Prevent directory traversal
                    const sanitizedPath = assetPath.replace(/\.\.\//g, '').replace(/\\/g, '');
                    const filePath = path.join(filesPath, variantName, sanitizedPath);
                    
                    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                        let contentType = 'application/octet-stream';
                        if (filePath.endsWith('.png')) contentType = 'image/png';
                        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
                        else if (filePath.endsWith('.webp')) contentType = 'image/webp';
                        else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
                        
                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Cache-Control', 'public, max-age=3600');
                        fs.createReadStream(filePath).pipe(res);
                        return;
                    }
                }
                next();
            });
        }
    };
}

/**
 * Dev-only watcher for custom pages to refresh static routes.
 * Sends a custom HMR event that the client UI can react to.
 */
function watchCustomPages() {
    return {
        name: 'watch-custom-pages',
        apply: 'serve',
        configureServer(server) {
            const userDataPath = getUserDataPath();
            if (!userDataPath) return;

            const pagesDir = path.join(userDataPath, 'pages');
            if (!fs.existsSync(pagesDir)) return;

            const pagesGlob = path.join(pagesDir, '*.yaml');
            server.watcher.add(pagesGlob);

            const routePath = path.resolve(process.cwd(), 'src/pages/[slug].astro');

            function notify(file, action) {
                if (!file.endsWith('.yaml')) return;
                if (!file.startsWith(pagesDir)) return;

                const slug = path.basename(file, '.yaml');
                const routeModule = server.moduleGraph.getModuleById(routePath);
                if (routeModule) {
                    server.moduleGraph.invalidateModule(routeModule);
                }

                server.ws.send({
                    type: 'custom',
                    event: 'artis:custom-pages',
                    data: { slug, action }
                });
            }

            server.watcher.on('add', (file) => notify(file, 'add'));
            server.watcher.on('change', (file) => notify(file, 'change'));
            server.watcher.on('unlink', (file) => notify(file, 'unlink'));
        }
    };
}

export default defineConfig({
  output: 'static',
  integrations: [tailwind()],

  vite: {
    define: {
      'import.meta.env.IMAGE_BASE_URL': JSON.stringify(
        process.env.IMAGE_BASE_URL || 'https://images.artsitemaker.com/artsitemaker'
      )
    },
    plugins: [serveUserAssets(), serveLocalImages(), watchCustomPages(), copyUserAssets()]
  },

  build: {
    assets: 'assets'
  }
});
