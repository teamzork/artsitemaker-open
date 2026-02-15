import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import react from '@astrojs/react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(
    import.meta.url));

// Custom Vite plugin to resolve path aliases contextually
function contextualAliasResolver() {
    return {
        name: 'contextual-alias-resolver',
        enforce: 'pre',
        async resolveId(source, importer, options) {
            if (!importer) return null;

            const isSiteImporter = importer.includes('/packages/site/');
            const isAdminImporter = importer.includes('/packages/admin/');

            let resolvedPath = null;

            // Resolve @layouts, @components, @lib based on which package is importing
            if (source.startsWith('@layouts/')) {
                const relativePath = source.replace('@layouts/', '');
                if (isSiteImporter) {
                    resolvedPath = path.resolve(__dirname, '../site/src/layouts', relativePath);
                } else if (isAdminImporter) {
                    resolvedPath = path.resolve(__dirname, 'src/layouts', relativePath);
                }
            } else if (source.startsWith('@components/')) {
                const relativePath = source.replace('@components/', '');
                if (isSiteImporter) {
                    resolvedPath = path.resolve(__dirname, '../site/src/components', relativePath);
                } else if (isAdminImporter) {
                    resolvedPath = path.resolve(__dirname, 'src/components', relativePath);
                }
            } else if (source.startsWith('@lib/')) {
                const relativePath = source.replace('@lib/', '');
                if (isSiteImporter) {
                    resolvedPath = path.resolve(__dirname, '../site/src/lib', relativePath);
                } else if (isAdminImporter) {
                    resolvedPath = path.resolve(__dirname, 'src/lib', relativePath);
                }
            }

            // If we resolved a path, let Vite handle extension resolution by using this.resolve
            if (resolvedPath) {
                // Try common extensions
                const extensions = ['', '.ts', '.js', '.tsx', '.jsx', '.astro'];
                for (const ext of extensions) {
                    const fullPath = resolvedPath + ext;
                    try {
                        const fs = await
                        import ('fs');
                        if (fs.existsSync(fullPath)) {
                            return fullPath;
                        }
                    } catch (e) {
                        // Continue trying other extensions
                    }
                }
            }

            return null;
        }
    };
}

// Custom Vite plugin to serve site public assets
function serveSitePublic() {
    return {
        name: 'serve-site-public',
        async configureServer(server) {
            const fs = await
            import ('fs');
            const sitePublicPath = path.resolve(__dirname, '../site/public');
            const demoFilesPath = path.resolve(__dirname, '../../demo-site/files');
            const demoUserAssetsPath = path.resolve(__dirname, '../../demo-site/user-data/assets');

            // Get user data path using bootstrap config with mtime checking
            // This ensures the admin picks up config changes without restart
            const yaml = await import('js-yaml');
            
            let cachedUserDataPath = null;
            let cachedBootstrapMtime = 0;
            
            function getUserDataPath() {
                const artSiteMakerRoot = path.resolve(__dirname, '../..');
                const bootstrapPath = path.join(artSiteMakerRoot, 'artis.config.yaml');
                
                // ALWAYS check if bootstrap file has changed
                if (fs.existsSync(bootstrapPath)) {
                    try {
                        const stats = fs.statSync(bootstrapPath);
                        if (cachedBootstrapMtime !== stats.mtimeMs) {
                            cachedUserDataPath = null;
                            cachedBootstrapMtime = stats.mtimeMs;
                        }
                    } catch (error) {
                        // Ignore stat errors
                    }
                } else {
                    if (cachedBootstrapMtime !== 0) {
                        cachedUserDataPath = null;
                        cachedBootstrapMtime = 0;
                    }
                }
                
                if (cachedUserDataPath !== null) {
                    return cachedUserDataPath;
                }
                
                // Read from artis.config.yaml
                if (fs.existsSync(bootstrapPath)) {
                    try {
                        const content = fs.readFileSync(bootstrapPath, 'utf-8');
                        const config = yaml.load(content);
                        const pathValue = config?.userDataPath || config?.contentPath;
                        
                        if (pathValue) {
                            let resolved;
                            if (path.isAbsolute(pathValue)) {
                                resolved = pathValue;
                            } else if (pathValue.startsWith('~/')) {
                                const home = process.env.HOME || process.env.USERPROFILE || '';
                                resolved = path.join(home, pathValue.slice(2));
                            } else {
                                resolved = path.resolve(artSiteMakerRoot, pathValue);
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
                
                // Fallback to auto-discovery
                const rootUserData = path.join(artSiteMakerRoot, 'user-data');
                const rootContent = path.join(artSiteMakerRoot, 'content');
                cachedUserDataPath = fs.existsSync(rootUserData) ? rootUserData :
                    fs.existsSync(rootContent) ? rootContent :
                    path.join(artSiteMakerRoot, 'demo-site', 'user-data');
                return cachedUserDataPath;
            }
            
            const userDataPath = getUserDataPath();
            const userAssetsPath = path.join(userDataPath, 'assets');

            server.middlewares.use((req, res, next) => {
                // Serve /themes/* from site's public directory
                if (req.url && req.url.startsWith('/themes/')) {
                    const filePath = path.join(sitePublicPath, req.url);
                    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                        // Determine content type
                        let contentType = 'application/octet-stream';
                        if (filePath.endsWith('.css')) contentType = 'text/css';
                        else if (filePath.endsWith('.js')) contentType = 'text/javascript';
                        else if (filePath.endsWith('.png')) contentType = 'image/png';
                        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
                        else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
                        else if (filePath.endsWith('.woff2')) contentType = 'font/woff2';
                        else if (filePath.endsWith('.woff')) contentType = 'font/woff';
                        else if (filePath.endsWith('.ttf')) contentType = 'font/ttf';

                        res.setHeader('Content-Type', contentType);
                        fs.createReadStream(filePath).pipe(res);
                        return;
                    }
                }

                // Serve demo images from demo-site/files for /demo routes
                // Match patterns like /large/*, /medium/*, /small/*, /thumb/*
                if (req.url && /^\/(large|medium|small|thumb)\//.test(req.url)) {
                    const filePath = path.join(demoFilesPath, req.url);
                    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                        // Determine content type
                        let contentType = 'application/octet-stream';
                        if (filePath.endsWith('.webp')) contentType = 'image/webp';
                        else if (filePath.endsWith('.png')) contentType = 'image/png';
                        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';

                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Cache-Control', 'public, max-age=31536000');
                        fs.createReadStream(filePath).pipe(res);
                        return;
                    }
                }

                // Serve demo thumbnails: map /thumbnails/* to demo-site/files/thumb/*
                if (req.url && req.url.startsWith('/thumbnails/')) {
                    const filename = req.url.substring('/thumbnails/'.length);
                    const filePath = path.join(demoFilesPath, 'thumb', filename);
                    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                        let contentType = 'application/octet-stream';
                        if (filePath.endsWith('.png')) contentType = 'image/png';
                        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
                        else if (filePath.endsWith('.webp')) contentType = 'image/webp';

                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Cache-Control', 'public, max-age=31536000');
                        fs.createReadStream(filePath).pipe(res);
                        return;
                    }
                }

                // Serve demo user assets: map /demo-user-assets/* to demo-site/user-data/assets/*
                if (req.url && req.url.startsWith('/demo-user-assets/')) {
                    const assetPath = req.url.substring('/demo-user-assets/'.length);
                    // Prevent directory traversal
                    const sanitizedPath = assetPath.replace(/\.\.\//g, '').replace(/\\/g, '');
                    const filePath = path.join(demoUserAssetsPath, sanitizedPath);

                    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                        let contentType = 'application/octet-stream';
                        if (filePath.endsWith('.png')) contentType = 'image/png';
                        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
                        else if (filePath.endsWith('.webp')) contentType = 'image/webp';
                        else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
                        else if (filePath.endsWith('.gif')) contentType = 'image/gif';

                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Cache-Control', 'public, max-age=31536000');
                        fs.createReadStream(filePath).pipe(res);
                        return;
                    }
                }

                // Serve user assets: map /user-assets/* to user-data/assets/*
                if (req.url && req.url.startsWith('/user-assets/')) {
                    const assetPath = req.url.substring('/user-assets/'.length);
                    // Prevent directory traversal
                    const sanitizedPath = assetPath.replace(/\.\.\//g, '').replace(/\\/g, '');
                    const filePath = path.join(userAssetsPath, sanitizedPath);

                    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                        let contentType = 'application/octet-stream';
                        if (filePath.endsWith('.png')) contentType = 'image/png';
                        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
                        else if (filePath.endsWith('.webp')) contentType = 'image/webp';
                        else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
                        else if (filePath.endsWith('.gif')) contentType = 'image/gif';

                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Cache-Control', 'public, max-age=31536000');
                        fs.createReadStream(filePath).pipe(res);
                        return;
                    }
                }

                next();
            });
        }
    };
}

export default defineConfig({
    output: 'server',
    adapter: node({
        mode: 'standalone'
    }),
    integrations: [tailwind(), react()],

    server: {
        port: parseInt(process.env.PORT) || 4322,
        host: process.env.HOST || 'localhost'
    },

    vite: {
        clearScreen: false,
        optimizeDeps: {
            include: ['@radix-ui/react-toast']
        },
        plugins: [contextualAliasResolver(), serveSitePublic()],
        define: {
            'import.meta.env.REPO_PATH': JSON.stringify(
                process.env.REPO_PATH || '/var/artis/repo'
            ),
            'import.meta.env.FILES_PATH': JSON.stringify(
                process.env.FILES_PATH || '/var/artis/files'
            ),
            'import.meta.env.IMAGE_BASE_URL': JSON.stringify(
                process.env.IMAGE_BASE_URL || 'https://images.artsitemaker.com/artsitemaker'
            )
        }
    }
});
