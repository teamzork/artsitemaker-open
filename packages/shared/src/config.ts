/**
 * @artsitemaker/shared - Configuration Resolution
 * 
 * This module provides the core logic for resolving the user data path
 * from artis.config.yaml with mtime-based cache invalidation.
 * 
 * ⚠️  Changing userDataPath performs a "Hot Context Switch" of the entire application.
 * All caches (content, settings, assets) will be cleared and reloaded from the new location.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface BootstrapConfig {
    userDataPath?: string;
    contentPath?: string;
    projectName?: string;
}

interface ConfigCache {
    userDataPath: string | null;
    bootstrapMtime: number;
    config: Record<string, unknown> | null;
    configMtime: number;
    configPath: string | null;
}

// Module-level cache - shared across all calls
let cache: ConfigCache = {
    userDataPath: null,
    bootstrapMtime: 0,
    config: null,
    configMtime: 0,
    configPath: null
};

/**
 * Resolve a path that may be absolute, relative, or use ~/
 */
export function resolvePath(inputPath: string, basePath: string): string {
    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }
    if (inputPath.startsWith('~/')) {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        return path.join(home, inputPath.slice(2));
    }
    return path.resolve(basePath, inputPath);
}

/**
 * Clear all cached configuration values.
 * Call this when you know the config has changed.
 */
export function clearConfigCache(): void {
    cache = {
        userDataPath: null,
        bootstrapMtime: 0,
        config: null,
        configMtime: 0,
        configPath: null
    };
}

/**
 * Check if the bootstrap config file has changed and invalidate cache if needed.
 * Returns true if cache was invalidated.
 */
export function checkAndInvalidateCache(bootstrapPath: string): boolean {
    if (fs.existsSync(bootstrapPath)) {
        try {
            const stats = fs.statSync(bootstrapPath);
            if (cache.bootstrapMtime !== stats.mtimeMs) {
                clearConfigCache();
                cache.bootstrapMtime = stats.mtimeMs;
                return true;
            }
        } catch {
            // Ignore stat errors
        }
    } else {
        // Config file was deleted - clear all caches
        if (cache.bootstrapMtime !== 0) {
            clearConfigCache();
            return true;
        }
    }
    return false;
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
function resolveProjectPath(userDataRoot: string, config?: BootstrapConfig): string | null {
    // 1. If the root itself is a project, use it
    if (isProjectRoot(userDataRoot)) {
        return userDataRoot;
    }

    // 2. If config specifies a project name, use it
    if (config?.projectName) {
        const projectPath = path.join(userDataRoot, config.projectName);
        if (fs.existsSync(projectPath)) {
            // We verify it exists, but we also ideally want to check if it has project markers.
            // However, allowing bare directories might be intended for scaffolding.
            // But strict checking is safer.
            if (isProjectRoot(projectPath)) {
                return projectPath;
            } else {
                console.warn(`Project directory '${config.projectName}' exists but is not a valid project root (missing settings.yaml or artisan.config.yaml).`);
                // We might still return it if we assume scaffolding will fix it,
                // but for "path resolution" meant for loading config, we should probably be strict or at least warn.
                // The user request says "checking existence and falling back with a warning or returning null".
                // Let's return null to surface the error.
                return null;
            }
        }
        
        console.warn(`Project '${config.projectName}' not found in ${userDataRoot}`);
        return null;
    }

    // 3. Fallback to 'default' project
    const defaultProject = path.join(userDataRoot, 'default');
    if (fs.existsSync(defaultProject)) {
        return defaultProject;
    }

    // 4. If we found nothing, return null instead of the root
    // The root was already checked in step 1.
    return null;
}

/**
 * Get the user data path from artis.config.yaml
 * 
 * @param artisRoot - The root directory containing artis.config.yaml
 * @returns The resolved user data path, or null if not found
 */
export function getUserDataPathFromConfig(artisRoot: string): string | null {
    const bootstrapPath = path.join(artisRoot, 'artis.config.yaml');
    
    // Check for changes and invalidate if needed
    checkAndInvalidateCache(bootstrapPath);
    
    // Return cached value if valid
    if (cache.userDataPath !== null) {
        return cache.userDataPath;
    }
    
    // Read from config file
    if (fs.existsSync(bootstrapPath)) {
        try {
            const content = fs.readFileSync(bootstrapPath, 'utf-8');
            const config = yaml.load(content) as BootstrapConfig;
            const pathValue = config?.userDataPath || config?.contentPath;
            
            if (pathValue) {
                const resolved = resolvePath(pathValue, artisRoot);
                if (fs.existsSync(resolved)) {
                    // Resolve specific project within user data path
                    const finalPath = resolveProjectPath(resolved, config);
                    if (finalPath) {
                        cache.userDataPath = finalPath;
                        return cache.userDataPath;
                    } else {
                        console.warn(`Could not resolve a valid project in ${resolved}`);
                        if (config.projectName) {
                             console.warn(`Project '${config.projectName}' was requested but not found/valid.`);
                        }
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
    
    return null;
}

/**
 * Get the user data path with fallback to auto-discovery.
 * 
 * @param artisRoot - The root directory containing artis.config.yaml
 * @returns The resolved user data path
 */
export function getUserDataPath(artisRoot: string): string {
    // Try config file first
    const configPath = getUserDataPathFromConfig(artisRoot);
    if (configPath) {
        return configPath;
    }
    
    // Fallback to auto-discovery
    const userDataPath = path.join(artisRoot, 'user-data');
    if (fs.existsSync(userDataPath)) {
        const resolved = resolveProjectPath(userDataPath);
        if (resolved) return resolved;
    }
    
    const contentPath = path.join(artisRoot, 'content');
    if (fs.existsSync(contentPath)) {
        const resolved = resolveProjectPath(contentPath);
        if (resolved) return resolved;
    }
    
    // Last resort: demo-site
    return path.join(artisRoot, 'demo-site', 'user-data');
}

/**
 * Get the current cache state (for debugging)
 */
export function getCacheState(): Readonly<ConfigCache> {
    return { ...cache };
}
