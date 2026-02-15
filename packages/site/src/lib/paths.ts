/**
 * Centralized Path Configuration for Site Package
 *
 * The site package builds statically and reads content at build time.
 * Uses the same site project model as the admin package.
 */

import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import {
    checkAndInvalidateCache as sharedCheckAndInvalidateCache,
    resolvePath as sharedResolvePath
} from '@artsitemaker/shared';

// Import ArtSiteMakerContext type (also registers global declaration)
import type { ArtSiteMakerContext } from './content';

// Load ArtSiteMaker root .env first (contains SITE_PROJECT_PATH)
function loadArtSiteMakerRootEnv(): void {
    let current = process.cwd();
    // If we're running from packages/site or packages/site-sample, go up two levels
    if (current.includes('/packages/site')) {
        current = path.resolve(current, '../..');
    }
    const rootEnvPath = path.join(current, '.env');
    if (fs.existsSync(rootEnvPath)) {
        dotenv.config({ path: rootEnvPath, override: false });
    }
}

// Load root .env at module initialization
loadArtSiteMakerRootEnv();

// Site project configuration
interface SiteConfig {
    siteName?: string;
    contentPath?: string;        // Deprecated, will be removed in v2.0. Use userDataPath instead.
    userDataPath?: string;        // New preferred field
    themesPath?: string;
    filesPath?: string;
    imageStorage?: 'local' | 'r2';
    r2PublicUrl?: string;
    r2BucketName?: string;
    r2ProjectPrefix?: string;
}

// Cached values
let cachedSiteProjectPath: string | null = null;
let cachedConfig: SiteConfig | null = null;
let cachedConfigMtime: number = 0;
let cachedConfigPath: string | null = null;  // Track which config file was cached
let cachedBootstrapMtime: number = 0;  // Track user-data-path.yaml changes
let siteEnvLoaded = false;
let deprecationWarningsShown = false;

/**
 * Show deprecation warnings in development mode
 */
function showDeprecationWarnings(config: SiteConfig, resolvedPath: string): void {
    if (deprecationWarningsShown) return;
    deprecationWarningsShown = true;

    // Only warn in development
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'dev') return;

    // Warn about deprecated config key
    if (config.contentPath && !config.userDataPath) {
        console.warn('⚠️  DEPRECATION: "contentPath" in artis.config.yaml is deprecated.');
        console.warn('   Please rename to "userDataPath" in your config file.');
        console.warn('   Old: contentPath: /path/to/content');
        console.warn('   New: userDataPath: /path/to/user-data');
    }

    // Warn about old directory name
    if (resolvedPath.includes('/content/') || resolvedPath.endsWith('/content')) {
        const artSiteMakerRoot = getArtSiteMakerRoot();
        const siteProject = getSiteProjectPath();
        const basePath = siteProject || artSiteMakerRoot;
        const userDataEquivalent = resolvedPath.replace(/\/content\/?$/, '/user-data');

        if (!fs.existsSync(userDataEquivalent) && fs.existsSync(resolvedPath)) {
            console.error('❌ DEPRECATION ERROR: Deprecated "/content/" directory structure detected.');
            console.error('   Support for /content-assets URLs has been removed.');
            console.error(`   Migrate to: ${userDataEquivalent}`);
        }
    }
}

/**
 * Check if the site is running in demo mode.
 */
function isDemoSite(): boolean {
    const envFlag = process.env.ARTIS_SAMPLE_SITE || process.env.SITE_SAMPLE;
    if (envFlag && envFlag !== '0' && envFlag !== 'false') {
        return true;
    }

    if (process.env.npm_package_name === '@artsitemaker/site-sample') {
        return true;
    }

    const cwd = process.cwd();
    const sampleSegment = `${path.sep}packages${path.sep}site-sample`;
    return cwd.includes(sampleSegment);
}

/**
 * Get the demo-site root for the demo site.
 */
function getDemoSitePath(): string {
    return path.join(getArtSiteMakerRoot(), 'demo-site');
}

/**
 * Get the ArtSiteMaker root directory
 */
function getArtSiteMakerRoot(): string {
    let current = process.cwd();

    // If we're running from any package directory, go up two levels to monorepo root
    if (current.includes('/packages/site') || current.includes('/packages/site-sample') || current.includes('/packages/admin')) {
        return path.resolve(current, '../..');
    }

    return current;
}

/**
 * Resolve a path, supporting ~, absolute, and relative paths
 */
function resolvePath(inputPath: string, basePath: string): string {
    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }

    if (inputPath.startsWith('~')) {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        return path.join(home, inputPath.slice(1));
    }

    return path.resolve(basePath, inputPath);
}

/**
 * Check if a directory looks like a site project (has artis.config.yaml)
 */
function isSiteProject(dirPath: string): boolean {
    if (!fs.existsSync(dirPath)) return false;
    return fs.existsSync(path.join(dirPath, 'artis.config.yaml'));
}

/**
 * Check if a directory is a valid project root
 */
function isProjectRoot(dirPath: string): boolean {
    // Check for core project markers
    return fs.existsSync(path.join(dirPath, 'settings', 'settings.yaml')) ||
           fs.existsSync(path.join(dirPath, 'configuration', 'project-configuration.yaml'));
}

/**
 * Resolve project path within a user data root
 */
/**
 * Resolve project path within a user data root
 */
function resolveProjectPath(userDataRoot: string, projectName?: string): string | null {
    // 1. If the root itself is a project, use it
    if (isProjectRoot(userDataRoot)) {
        return userDataRoot;
    }

    // 2. If config specifies a project name, use it
    if (projectName) {
        const projectPath = path.join(userDataRoot, projectName);
        if (fs.existsSync(projectPath)) {
            if (isProjectRoot(projectPath)) {
                return projectPath;
            } else {
                console.warn(`Project directory '${projectName}' exists but is not a valid project root.`);
                return null;
            }
        }
        
        console.warn(`Project '${projectName}' not found in ${userDataRoot}`);
        return null;
    }

    // 3. Fallback to 'default' project
    const defaultProject = path.join(userDataRoot, 'default');
    if (fs.existsSync(defaultProject)) {
        return defaultProject;
    }

    // 4. If we found nothing, return null
    return null;
}

/**
 * Get the site project path
 * 
 * Priority:
 * 1. Demo site mode (ARTIS_SAMPLE_SITE env var)
 * 2. user-data-path.yaml at project root (new bootstrap mechanism)
 * 3. SITE_PROJECT_PATH environment variable
 * 4. Auto-discovery of user-data/ or content/ folders at artis root
 */
export function getSiteProjectPath(): string | null {
    const root = getArtSiteMakerRoot();
    const bootstrapPath = path.join(root, 'artis.config.yaml');

    // Check if bootstrap file has changed - ALWAYS check on every call
    // This ensures strict separation when switching between user data folders
    if (fs.existsSync(bootstrapPath)) {
        try {
            const stats = fs.statSync(bootstrapPath);
            // Clear ALL caches if file changed (strict invalidation)
            if (cachedBootstrapMtime !== stats.mtimeMs) {
                cachedSiteProjectPath = null;
                cachedConfig = null;
                cachedConfigMtime = 0;
                cachedConfigPath = null;
                cachedBootstrapMtime = stats.mtimeMs;
                siteEnvLoaded = false;
            }
        } catch (error) {
            // Ignore stat errors
        }
    } else {
        // Config file was deleted - clear all caches
        if (cachedBootstrapMtime !== 0) {
            cachedSiteProjectPath = null;
            cachedConfig = null;
            cachedConfigMtime = 0;
            cachedConfigPath = null;
            cachedBootstrapMtime = 0;
            siteEnvLoaded = false;
        }
    }

    // Return cached value if still valid
    if (cachedSiteProjectPath !== null) {
        return cachedSiteProjectPath || null;
    }

    if (isDemoSite()) {
        const demoSitePath = getDemoSitePath();
        cachedSiteProjectPath = demoSitePath;

        if (fs.existsSync(demoSitePath)) {
            loadSiteEnv();
            return demoSitePath;
        }

        console.warn(`Demo site path not found: ${demoSitePath}`);
        cachedSiteProjectPath = '';
        return null;
    }

    // Priority 2: Check for artis.config.yaml at project root (new bootstrap mechanism)

    if (fs.existsSync(bootstrapPath)) {
        try {
            const content = fs.readFileSync(bootstrapPath, 'utf-8');
            const config = yaml.load(content) as { userDataPath?: string; contentPath?: string; projectName?: string };
            const pathValue = config?.userDataPath || config?.contentPath;

            if (pathValue) {
                const resolved = resolvePath(pathValue, root);
                if (fs.existsSync(resolved)) {
                    const projectPath = resolveProjectPath(resolved, config.projectName);
                    if (projectPath) {
                        cachedSiteProjectPath = projectPath;
                        loadSiteEnv();
                        return cachedSiteProjectPath;
                    } else {
                        console.warn(`Could not resolve a valid project in ${resolved}`);
                    }
                } else {
                    console.warn(`User data path not found: ${resolved}`);
                    console.warn(`Please check artis.config.yaml at ${bootstrapPath}`);
                }
            }
        } catch (error) {
            console.warn('Failed to read artis.config.yaml:', error);
        }
    }

    // Priority 3: Check SITE_PROJECT_PATH env var
    const envPath = process.env.SITE_PROJECT_PATH;
    if (envPath) {
        cachedSiteProjectPath = resolvePath(envPath, root);

        if (fs.existsSync(cachedSiteProjectPath)) {
            loadSiteEnv();
            return cachedSiteProjectPath;
        } else {
            console.warn(`Site project path not found: ${cachedSiteProjectPath}`);
            cachedSiteProjectPath = '';
        }
    }

    // Priority 4: Auto-discovery of common folder names
    if (!cachedSiteProjectPath) {
        const userDataPath = path.join(root, 'user-data');
        const contentPath = path.join(root, 'content');

        if (isSiteProject(userDataPath)) {
            cachedSiteProjectPath = userDataPath;
            loadSiteEnv();
        } else if (isSiteProject(contentPath)) {
            cachedSiteProjectPath = contentPath;
            loadSiteEnv();
        } else if (fs.existsSync(userDataPath)) {
            // Even without artis.config.yaml, use user-data if it exists
            const projectPath = resolveProjectPath(userDataPath);
            if (projectPath) {
                 cachedSiteProjectPath = projectPath;
                 loadSiteEnv();
            } else {
                 cachedSiteProjectPath = '';
            }
        } else {
            cachedSiteProjectPath = '';
        }
    }

    return cachedSiteProjectPath || null;
}

/**
 * Load environment variables from site project's .env
 */
function loadSiteEnv(): void {
    if (siteEnvLoaded) return;

    const siteProject = cachedSiteProjectPath;
    if (!siteProject) return;

    const siteEnvPath = path.join(siteProject, '.env');
    if (fs.existsSync(siteEnvPath)) {
        dotenv.config({ path: siteEnvPath, override: false });
        siteEnvLoaded = true;
    }
}

/**
 * Load configuration from site project's artis.config.yaml
 * Implements smart caching based on file modification time AND file path to support hot-reloading
 */
function loadConfig(): SiteConfig {
    const siteProject = getSiteProjectPath();

    if (siteProject) {
        const configPath = path.join(siteProject, 'artis.config.yaml');
        try {
            if (fs.existsSync(configPath)) {
                // Check if file has changed OR if we're reading from a different config file
                const stats = fs.statSync(configPath);

                // If cache exists, file hasn't changed, AND it's the same config file, return cache
                if (cachedConfig &&
                    cachedConfigMtime === stats.mtimeMs &&
                    cachedConfigPath === configPath) {
                    return cachedConfig;
                }

                // Load fresh config (file changed OR different config file)
                const content = fs.readFileSync(configPath, 'utf-8');
                cachedConfig = yaml.load(content) as SiteConfig;
                cachedConfigMtime = stats.mtimeMs;
                cachedConfigPath = configPath;  // Remember which file this came from
                return cachedConfig;
            }
        } catch (error) {
            console.warn('Failed to load artis.config.yaml:', error);
        }
    }

    cachedConfig = {};
    cachedConfigMtime = 0;
    cachedConfigPath = null;
    return cachedConfig;
}

/**
 * Load settings from settings/settings.yaml (user-facing config)
 * This is the primary source for site content settings (title, tagline, SEO, etc.)
 */
function loadSettings(): Record<string, any> {
    const contentPath = getUserDataPath();
    const settingsPath = path.join(contentPath, 'settings', 'settings.yaml');

    try {
        if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            const settings = yaml.load(content) as Record<string, any>;
            return settings || {};
        }
    } catch (error) {
        // Silently fail, will fall back to artis.config.yaml
    }

    return {};
}

/**
 * Load image hosting configuration from configuration/image-hosting.yaml
 */
function loadImageHostingConfig(): Record<string, any> {
    const contentPath = getUserDataPath();
    const configPath = path.join(contentPath, 'configuration', 'image-hosting.yaml');

    try {
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            const config = yaml.load(content) as Record<string, any>;
            return config || {};
        }
    } catch (error) {
        // Silently fail
    }

    return {};
}

/**
 * Get site name from config or environment
 */
function getSiteName(): string {
    const config = loadConfig();
    return config.siteName || process.env.SITE_NAME || 'artsitemaker-site';
}

/**
 * Get user data path with backward compatibility.
 * 
 * Resolution priority order:
 * 1. Preview context userDataPath (new)
 * 2. Preview context contentPath (deprecated)
 * 3. Config file userDataPath (new, preferred)
 * 4. Config file contentPath (deprecated)
 * 5. Site project user-data folder (if exists)
 * 6. Site project content folder (fallback)
 * 7. Demo site mode
 * 8. ArtSiteMaker root user-data folder (if exists)
 * 9. ArtSiteMaker root content folder (fallback)
 * 10. Default fallback (demo-site/user-data)
 * 
 * @returns Absolute path to the user data directory
 */
export function getUserDataPath(): string {
    // Priority 1: Preview context userDataPath (new)
    if (globalThis.__ARTSITEMAKER_PREVIEW__?.userDataPath) {
        return globalThis.__ARTSITEMAKER_PREVIEW__.userDataPath;
    }

    // Priority 2: Preview context contentPath (deprecated)
    if (globalThis.__ARTSITEMAKER_PREVIEW__?.contentPath) {
        return globalThis.__ARTSITEMAKER_PREVIEW__.contentPath;
    }

    const siteProject = getSiteProjectPath();
    const config = loadConfig();

    // If siteProject was resolved from artis.config.yaml, it IS the userDataPath
    // (getSiteProjectPath reads userDataPath from the bootstrap config)
    // So just return it directly
    if (siteProject) {
        return siteProject;
    }

    // Everything below is fallback for when no artis.config.yaml exists

    // Priority 7: Demo site mode
    if (isDemoSite()) {
        const demoUserData = path.join(getArtSiteMakerRoot(), 'demo-site', 'user-data');
        if (fs.existsSync(demoUserData)) {
            return demoUserData;
        }
        return demoUserData;
    }

    // Priority 8: Check for user-data folder at ArtSiteMaker root
    const artSiteMakerUserData = path.join(getArtSiteMakerRoot(), 'user-data');
    if (fs.existsSync(artSiteMakerUserData)) {
        return artSiteMakerUserData;
    }

    // Priority 9: Check for content folder at ArtSiteMaker root (fallback)
    const artSiteMakerContent = path.join(getArtSiteMakerRoot(), 'content');
    if (fs.existsSync(artSiteMakerContent)) {
        return artSiteMakerContent;
    }

    // Priority 10: Fall back to ArtSiteMaker bundled demo-site
    const result = path.join(getArtSiteMakerRoot(), 'demo-site', 'user-data');

    // Show deprecation warnings in development
    showDeprecationWarnings(config, result);

    return result;
}

/**
 * Get content path with preview context support.
 * 
 * @deprecated Use getUserDataPath() instead. Will be removed in v2.0.
 * @returns Absolute path to the content directory
 */
export const getContentPath = getUserDataPath;

/**
 * Get themes path
 */
export function getThemesPath(): string {
    const siteProject = getSiteProjectPath();
    const config = loadConfig();

    if (config.themesPath) {
        const basePath = siteProject || getArtSiteMakerRoot();
        return resolvePath(config.themesPath, basePath);
    }

    if (siteProject) {
        const siteThemes = path.join(siteProject, 'themes');
        if (fs.existsSync(siteThemes)) {
            return siteThemes;
        }
    }

    // If running from admin (preview mode), use site package's public themes
    const artSiteMakerRoot = getArtSiteMakerRoot();
    if (process.cwd().includes('/packages/admin')) {
        const sitePublicThemes = path.join(artSiteMakerRoot, 'packages/site/public/themes');
        if (fs.existsSync(sitePublicThemes)) {
            return sitePublicThemes;
        }
    }

    return path.join(artSiteMakerRoot, 'themes');
}

/**
 * Get artis default themes path
 */
export function getDefaultThemesPath(): string {
    return path.join(getArtSiteMakerRoot(), 'themes');
}

export function getSettingsPath(): string {
    return path.join(getUserDataPath(), 'settings', 'settings.yaml');
}

/**
 * Get theme config path
 */
export function getThemeConfigPath(themeName: string): string {
    // First try site project themes
    const siteThemePath = path.join(getThemesPath(), themeName, 'theme.yaml');
    if (fs.existsSync(siteThemePath)) {
        return siteThemePath;
    }

    // Fall back to artis default themes
    return path.join(getDefaultThemesPath(), themeName, 'theme.yaml');
}

/**
 * Get image storage mode
 * Priority: image-hosting.yaml > settings.yaml (legacy) > artis.config.yaml (backward compat) > env var > default
 * 
 * CANONICAL: imageStorage should be in configuration/image-hosting.yaml.
 * Falls back to settings.yaml and artis.config.yaml for backward compatibility.
 */
export function getImageStorageMode(): 'local' | 'r2' | 'external' {
    // Priority 1: image-hosting.yaml (canonical)
    const imageHostingConfig = loadImageHostingConfig();
    if (imageHostingConfig.imageStorage) {
        return imageHostingConfig.imageStorage;
    }

    // Priority 2: settings.yaml (legacy)
    const settings = loadSettings();
    if (settings.imageStorage) {
        return settings.imageStorage;
    }

    // Priority 3: artis.config.yaml (backward compat)
    const config = loadConfig();
    if (config.imageStorage) {
        return config.imageStorage;
    }

    // Priority 4: Environment variable
    const envStorage = process.env.IMAGE_STORAGE;
    if (envStorage === 'r2' || envStorage === 'local' || envStorage === 'external') {
        return envStorage;
    }

    return 'local'; // Default
}

/**
 * Get R2 public URL
 * Priority: image-hosting.yaml > settings.yaml (legacy) > artis.config.yaml (backward compat) > env var
 */
export function getR2PublicUrl(): string {
    // Priority 1: image-hosting.yaml (canonical)
    const imageHostingConfig = loadImageHostingConfig();
    if (imageHostingConfig.r2?.publicUrl) return imageHostingConfig.r2.publicUrl;

    // Priority 2: settings.yaml (legacy)
    const settings = loadSettings();
    if (settings.r2?.publicUrl) return settings.r2.publicUrl;

    // Priority 3: artis.config.yaml (backward compat)
    const config = loadConfig();
    if (config.r2PublicUrl) return config.r2PublicUrl;

    // Priority 4: Environment variable
    return process.env.R2_PUBLIC_URL || '';
}

/**
 * Get R2 bucket name
 * Priority: image-hosting.yaml > settings.yaml (legacy) > artis.config.yaml (backward compat) > env var
 */
export function getR2BucketName(): string {
    // Priority 1: image-hosting.yaml (canonical)
    const imageHostingConfig = loadImageHostingConfig();
    if (imageHostingConfig.r2?.bucketName) return imageHostingConfig.r2.bucketName;

    // Priority 2: settings.yaml (legacy)
    const settings = loadSettings();
    if (settings.r2?.bucketName) return settings.r2.bucketName;

    // Priority 3: artis.config.yaml (backward compat)
    const config = loadConfig();
    if (config.r2BucketName) return config.r2BucketName;

    // Priority 4: Environment variable
    return process.env.R2_BUCKET_NAME || '';
}

/**
 * Get the R2 project prefix (folder within bucket)
 * Priority: image-hosting.yaml > settings.yaml (legacy) > artis.config.yaml (backward compat) > env var > site name
 */
export function getR2ProjectPrefix(): string {
    // Priority 1: image-hosting.yaml (canonical)
    const imageHostingConfig = loadImageHostingConfig();
    if (imageHostingConfig.r2?.projectFolder) return imageHostingConfig.r2.projectFolder;

    // Priority 2: settings.yaml (legacy)
    const settings = loadSettings();
    if (settings.r2?.projectFolder) return settings.r2.projectFolder;

    // Priority 3: artis.config.yaml (backward compat)
    const config = loadConfig();
    if (config.r2ProjectPrefix) return config.r2ProjectPrefix;

    // Priority 4: Environment variable
    if (process.env.R2_PROJECT_PREFIX) return process.env.R2_PROJECT_PREFIX;

    // Priority 5: Fallback to site name
    return getSiteName();
}

/**
 * Get the base URL for images based on storage mode
 *
 * Resolution priority:
 * 1. Preview context override (globalThis.__ARTSITEMAKER_PREVIEW__.imageBaseUrl)
 * 2. R2 storage URL (if imageStorage is 'r2')
 * 3. Local images URL from environment
 */
export function getImageBaseUrl(): string {
    // Priority 1: Preview context override
    if (globalThis.__ARTSITEMAKER_PREVIEW__?.imageBaseUrl !== undefined) {
        return globalThis.__ARTSITEMAKER_PREVIEW__.imageBaseUrl;
    }

    const storageMode = getImageStorageMode();
    if (storageMode === 'r2') {
        const publicUrl = getR2PublicUrl();
        const projectPrefix = getR2ProjectPrefix();
        const base = publicUrl.replace(/\/$/, '');
        return `${base}/${projectPrefix}`;
    }

    return process.env.LOCAL_IMAGES_URL || '';
}

/**
 * Get user assets path (user-managed assets like logos)
 * @returns Absolute path to user assets directory
 */
export function getUserAssetsPath(): string {
    return path.join(getUserDataPath(), 'assets');
}

/**
 * Get the base URL for user assets
 * Allows preview override via globalThis.__ARTSITEMAKER_PREVIEW__
 * @returns URL path for user assets (e.g., '/user-assets')
 */
export function getUserAssetsBaseUrl(): string {
    // Priority 1: Preview context userAssetsBaseUrl (new)
    if (globalThis.__ARTSITEMAKER_PREVIEW__?.userAssetsBaseUrl !== undefined) {
        return globalThis.__ARTSITEMAKER_PREVIEW__.userAssetsBaseUrl;
    }
    return '/user-assets';
}

/**
 * Resolve a user asset path to a full URL
 * Identity assets (logos, backgrounds, fonts) are ALWAYS stored locally in user-data/assets,
 * regardless of the imageStorage mode. This ensures identity assets are never loaded from R2.
 * 
 * @param relativePath - Relative path under user-data/assets (e.g., 'logos/logo.png')
 * @returns Local virtual path (e.g., '/user-assets/logos/logo.png')
 */
export function resolveUserAssetUrl(relativePath: string): string {
    if (!relativePath) return '';

    const normalizedPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

    // Always return local virtual path: /user-assets/logos/logo.png
    // This is served by Vite middleware in dev, and copied to dist/ in builds
    // Identity assets are NEVER synced to R2, so we always use local paths
    const baseUrl = getUserAssetsBaseUrl();
    return `${baseUrl}/${normalizedPath}`;
}


/**
 * Clear cached values
 */
export function clearConfigCache(): void {
    cachedSiteProjectPath = null;
    cachedConfig = null;
    cachedConfigMtime = 0;
    cachedBootstrapMtime = 0;
    cachedConfigPath = null;
    siteEnvLoaded = false;
}
export const siteConfig = {
    get name() { return getSiteName(); },
    get imageStorage() { return getImageStorageMode(); },
    get imageBaseUrl() { return getImageBaseUrl(); },
    get userAssetsBaseUrl() { return getUserAssetsBaseUrl(); },
};
