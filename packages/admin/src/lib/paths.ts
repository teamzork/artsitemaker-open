/**
 * Centralized Path Configuration
 *
 * ArtSiteMaker uses a "site project" model where all site-specific data
 * (content, themes, credentials) lives in a separate folder.
 *
 * Loading order:
 * 1. Read SITE_PROJECT_PATH from ArtSiteMaker .env
 * 2. Load site project's artis.config.yaml for paths
 * 3. Load site project's .env for credentials (R2, etc.)
 * 4. Fall back to ArtSiteMaker bundled demo-site/ if no site project
 */

import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import {
    checkAndInvalidateCache as sharedCheckAndInvalidateCache,
    resolvePath as sharedResolvePath
} from '@artsitemaker/shared';

// Load ArtSiteMaker root .env first (contains SITE_PROJECT_PATH)
function loadArtSiteMakerRootEnv(): void {
    let current = process.cwd();
    // If we're running from packages/admin, go up two levels
    if (current.includes('/packages/admin')) {
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
    thumbnailsPath?: string;
    backupsPath?: string;
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
let cachedSettings: Record<string, any> | null = null;
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
 * Get the ArtSiteMaker root directory (where root package.json is)
 */
function getArtSiteMakerRoot(): string {
    let current = process.cwd();

    // If we're running from packages/admin, go up two levels
    if (current.includes('/packages/admin')) {
        return path.resolve(current, '../..');
    }

    return current;
}

/**
 * Resolve a path, supporting:
 * - Absolute paths
 * - Paths starting with ~ (home directory)
 * - Relative paths (resolved from given base)
 */
function resolvePath(inputPath: string, basePath: string): string {
    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }

    if (inputPath.startsWith('~')) {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        return path.join(home, inputPath.slice(1));
    }

    // Relative paths are relative to the base path
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

    // 4. Return null if no valid project found
    return null;
}

/**
 * Get the site project path
 * This is where all site-specific data lives
 * 
 * Priority:
 * 1. artis.config.yaml at project root (new bootstrap mechanism)
 * 2. SITE_PROJECT_PATH env var
 * 3. Auto-discovery of user-data/ or content/ folders
 */
export function getSiteProjectPath(): string | null {
    const root = getArtSiteMakerRoot();
    // Priority 1: Check for artis.config.yaml at project root (new bootstrap mechanism)
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
                cachedSettings = null;
                cachedConfigMtime = 0;
                cachedConfigPath = null;
                siteEnvLoaded = false;
                cachedBootstrapMtime = stats.mtimeMs;
            }
        } catch (error) {
            // Ignore stat errors
        }
    } else {
        // Config file was deleted - clear all caches
        if (cachedBootstrapMtime !== 0) {
            cachedSiteProjectPath = null;
            cachedConfig = null;
            cachedSettings = null;
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

    // Priority 1: Check for artis.config.yaml at project root
    if (fs.existsSync(bootstrapPath)) {
        try {
            const content = fs.readFileSync(bootstrapPath, 'utf-8');
            const config = yaml.load(content) as { userDataPath?: string; contentPath?: string; projectName?: string };
            const pathValue = config?.userDataPath || config?.contentPath;

            if (pathValue) {
                const resolved = resolvePath(pathValue, root);
                if (fs.existsSync(resolved)) {
                    // Resolve specific project within user data path
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

    // Priority 2: Check SITE_PROJECT_PATH env var
    const envPath = process.env.SITE_PROJECT_PATH;
    if (envPath) {
        cachedSiteProjectPath = resolvePath(envPath, root);

        // Verify the path exists
        if (fs.existsSync(cachedSiteProjectPath)) {
            // Load the site project's .env
            loadSiteEnv();
            return cachedSiteProjectPath;
        } else {
            console.warn(`Site project path not found: ${cachedSiteProjectPath}`);
            cachedSiteProjectPath = '';
        }
    }

    // Priority 3: Auto-discovery of common folder names
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
 * Load environment variables from the site project's .env
 */
function loadSiteEnv(): void {
    if (siteEnvLoaded) return;

    const siteProject = cachedSiteProjectPath;
    if (!siteProject) return;

    const siteEnvPath = path.join(siteProject, '.env');
    if (fs.existsSync(siteEnvPath)) {
        // Load site .env, but don't override existing env vars
        dotenv.config({ path: siteEnvPath, override: false });
        siteEnvLoaded = true;
    }
}

/**
 * Load configuration from site project's artis.config.yaml
 * Implements smart caching based on file modification time AND file path
 */
function loadConfig(): SiteConfig {
    const siteProject = getSiteProjectPath();

    if (siteProject) {
        // Try site project's config
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
 * Load configuration from artis root artis.config.yaml (bootstrap config).
 */
/**
 * Load settings from settings/settings.yaml (user-facing config)
 * This is the primary source for site content settings (title, tagline, SEO, etc.)
 */
function loadSettings(): Record<string, any> {
    if (cachedSettings) return cachedSettings;

    const contentPath = getUserDataPath();
    const settingsPath = path.join(contentPath, 'settings', 'settings.yaml');

    try {
        if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            cachedSettings = yaml.load(content) as Record<string, any>;
            return cachedSettings || {};
        }
    } catch (error) {
        // Silently fail, will fall back to artis.config.yaml
    }

    cachedSettings = {};
    return cachedSettings;
}

// Image hosting config cache
let cachedImageHostingConfig: Record<string, any> | null = null;

/**
 * Load image hosting configuration from configuration/image-hosting.yaml
 */
function loadImageHostingConfig(): Record<string, any> {
    if (cachedImageHostingConfig) return cachedImageHostingConfig;

    const contentPath = getUserDataPath();
    const configPath = path.join(contentPath, 'configuration', 'image-hosting.yaml');

    try {
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            cachedImageHostingConfig = yaml.load(content) as Record<string, any>;
            return cachedImageHostingConfig || {};
        }
    } catch (error) {
        // Silently fail
    }

    cachedImageHostingConfig = {};
    return cachedImageHostingConfig;
}

// Project config cache
let cachedProjectConfig: Record<string, any> | null = null;

/**
 * Load project configuration from configuration/project-configuration.yaml
 */
function loadProjectConfig(): Record<string, any> {
    if (cachedProjectConfig) return cachedProjectConfig;

    const contentPath = getUserDataPath();
    const configPath = path.join(contentPath, 'configuration', 'project-configuration.yaml');

    try {
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            cachedProjectConfig = yaml.load(content) as Record<string, any>;
            return cachedProjectConfig || {};
        }
    } catch (error) {
        // Silently fail
    }

    cachedProjectConfig = {};
    return cachedProjectConfig;
}

/**
 * Get user data path with backward compatibility.
 * 
 * Resolution priority order:
 * 1. Config file userDataPath (new, preferred)
 * 2. Config file contentPath (deprecated)
 * 3. Site project user-data folder (if exists)
 * 4. Site project content folder (fallback)
 * 5. ArtSiteMaker root user-data folder (if exists)
 * 6. ArtSiteMaker root content folder (fallback)
 * 7. Default fallback (demo-site/user-data)
 * 
 * @returns Absolute path to the user data directory
 */
export function getUserDataPath(): string {
    const siteProject = getSiteProjectPath();
    const config = loadConfig();

    // If siteProject was resolved from artis.config.yaml, it IS the userDataPath
    // (getSiteProjectPath reads userDataPath from the bootstrap config)
    // So just return it directly
    if (siteProject) {
        return siteProject;
    }

    // Everything below is fallback for when no artis.config.yaml exists

    // Priority 5: Check for user-data folder at artis root
    const artSiteMakerUserData = path.join(getArtSiteMakerRoot(), 'user-data');
    if (fs.existsSync(artSiteMakerUserData)) {
        return artSiteMakerUserData;
    }

    // Priority 6: Check for content folder at artis root
    const artSiteMakerContent = path.join(getArtSiteMakerRoot(), 'content');
    if (fs.existsSync(artSiteMakerContent)) {
        return artSiteMakerContent;
    }

    // Priority 7: Fall back to artis bundled demo-site
    const result = path.join(getArtSiteMakerRoot(), 'demo-site', 'user-data');

    // Show deprecation warnings in development
    showDeprecationWarnings(config, result);

    return result;
}

/**
 * Get content path (artworks, collections, settings, pages, footer)
 * 
 * @deprecated Use getUserDataPath() instead. Will be removed in v2.0.
 * @returns Absolute path to the content directory
 */
export const getContentPath = getUserDataPath;

/**
 * Get themes path
 * Returns both site project themes and artis default themes
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

    // Fall back to artis default themes
    return path.join(getArtSiteMakerRoot(), 'themes');
}

/**
 * Get artis default themes path (minimalist, modern)
 * Always returns the artis bundled themes, useful for fallbacks
 */
export function getDefaultThemesPath(): string {
    return path.join(getArtSiteMakerRoot(), 'themes');
}

/**
 * Get files path (processed images: large, medium, small, originals)
 */
export function getFilesPath(): string {
    const siteProject = getSiteProjectPath();
    const config = loadConfig();

    if (config.filesPath) {
        const basePath = siteProject || getArtSiteMakerRoot();
        return resolvePath(config.filesPath, basePath);
    }

    if (siteProject) {
        return path.join(siteProject, 'files');
    }

    // Files are always at artis root
    return path.join(getArtSiteMakerRoot(), 'files');
}

/**
 * Get thumbnails path (admin thumbnails)
 */
export function getThumbnailsPath(): string {
    const siteProject = getSiteProjectPath();
    const config = loadConfig();

    if (config.thumbnailsPath) {
        const basePath = siteProject || getArtSiteMakerRoot();
        return resolvePath(config.thumbnailsPath, basePath);
    }

    if (siteProject) {
        return path.join(siteProject, 'thumbnails');
    }

    return path.join(getArtSiteMakerRoot(), 'thumbnails');
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
 * Returns relative URL path for serving user assets
 * @returns URL path for user assets (e.g., '/user-assets')
 */
export function getUserAssetsBaseUrl(): string {
    return '/user-assets';
}

/**
 * Resolve a user asset path to a full URL
 * @param relativePath - Relative path under user-data/assets (e.g., 'logos/logo.png')
 * @returns Full URL path (e.g., '/user-assets/logos/logo.png')
 */
export function resolveUserAssetUrl(relativePath: string): string {
    if (!relativePath) return '';
    const baseUrl = getUserAssetsBaseUrl();
    const normalizedPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    return `${baseUrl}/${normalizedPath}`;
}

/**
 * Get backups path
 */
export function getBackupsPath(): string {
    const siteProject = getSiteProjectPath();
    const config = loadConfig();

    if (config.backupsPath) {
        const basePath = siteProject || getArtSiteMakerRoot();
        return resolvePath(config.backupsPath, basePath);
    }

    if (siteProject) {
        return path.join(siteProject, 'backups');
    }

    return path.join(getArtSiteMakerRoot(), 'backups');
}

/**
 * Get the artis repo root path
 */
export function getRepoPath(): string {
    return getArtSiteMakerRoot();
}

/**
 * Get site name (for R2 namespace, etc.)
 */
export function getSiteName(): string {
    const config = loadConfig();
    return config.siteName || process.env.SITE_NAME || 'artsitemaker-site';
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
 */
export function getImageBaseUrl(): string {
    const storageMode = getImageStorageMode();
    if (storageMode === 'r2') {
        const publicUrl = getR2PublicUrl();
        const projectPrefix = getR2ProjectPrefix();
        const base = publicUrl.replace(/\/$/, '');
        return `${base}/${projectPrefix}`;
    }

    // For local, we often use absolute paths or relative to root
    return process.env.LOCAL_IMAGES_URL || '';
}

/**
 * Check if a site project is configured
 */
export function hasSiteProject(): boolean {
    return getSiteProjectPath() !== null;
}

/**
 * Clear all cached values (useful for testing)
 */
export function clearConfigCache(): void {
    cachedSiteProjectPath = null;
    cachedConfig = null;
    cachedSettings = null;
    cachedImageHostingConfig = null;
    cachedProjectConfig = null;
    cachedConfigMtime = 0;
    cachedBootstrapMtime = 0;
    cachedConfigPath = null;
    siteEnvLoaded = false;
}

// Export all paths as a convenience object
export const paths = {
    get siteProject() { return getSiteProjectPath(); },
    get userData() { return getUserDataPath(); },
    get content() { return getUserDataPath(); },
    get themes() { return getThemesPath(); },
    get defaultThemes() { return getDefaultThemesPath(); },
    get files() { return getFilesPath(); },
    get thumbnails() { return getThumbnailsPath(); },
    get userAssets() { return getUserAssetsPath(); },
    get contentAssets() { return getUserAssetsPath(); },
    get backups() { return getBackupsPath(); },
    get repo() { return getRepoPath(); },
};

// Export site config getters
export const siteConfig = {
    get name() { return getSiteName(); },
    get imageStorage() { return getImageStorageMode(); },
    get imageBaseUrl() { return getImageBaseUrl(); },
    get hasSiteProject() { return hasSiteProject(); },
};
