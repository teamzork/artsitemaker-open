/**
 * Project State Manager
 * 
 * Detects the current state of the ArtSiteMaker project and determines
 * whether onboarding is needed or which setup steps are incomplete.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
    getContentPath,
    getSiteProjectPath,
    getRepoPath,
    getFilesPath,
    getThemesPath,
    getImageStorageMode,
    hasSiteProject
} from './paths';

// ============================================================================
// Types
// ============================================================================

export type ProjectState =
    | 'FIRST_RUN'      // No content folder exists - needs full onboarding
    | 'DEMO_MODE'      // Using demo-site (demo data)
    | 'SETUP'          // Content exists but configuration incomplete
    | 'READY'          // Configured and ready to use
    | 'NEEDS_DEPLOY';  // Changes pending deployment

export type ThemeSource = 'builtin' | 'custom' | 'repo' | 'none';

export interface ThemeInfo {
    name: string;
    source: ThemeSource;
    path: string;
    isEditable: boolean;  // false for builtin themes
}

export interface StateDetails {
    state: ProjectState;

    // User data info
    hasUserDataFolder: boolean;  // New preferred name
    /** @deprecated Use hasUserDataFolder instead */
    hasContentFolder: boolean;
    usingDemoContent: boolean;
    userDataPath: string;  // New preferred name
    /** @deprecated Use userDataPath instead */
    contentPath: string;

    // Configuration status
    hasSettings: boolean;
    hasArtworks: boolean;
    hasTheme: boolean;

    // Theme details
    themeInfo: ThemeInfo | null;

    // Image status
    hasWorkingImages: boolean;  // Are images available for current storage mode?
    imageIssue: string | null;  // Description of image issue if any

    // Storage info
    imageStorage: 'local' | 'r2' | 'external';
    hasFilesFolder: boolean;

    // Content git info
    contentIsGitRepo: boolean;
    contentGitRemote: string | null;

    // Site project info
    hasSiteProject: boolean;
    siteProjectPath: string | null;

    // Missing requirements for READY state
    missingRequirements: string[];
}

// ============================================================================
// State Detection
// ============================================================================

/**
 * Detect if we're using the bundled demo content (demo-site)
 */
function isDemoContent(contentPath: string): boolean {
    const repoRoot = getRepoPath();
    const demoPath = path.join(repoRoot, 'demo-site', 'user-data');

    // Normalize paths for comparison
    const normalizedContent = path.resolve(contentPath);
    const normalizedDemo = path.resolve(demoPath);

    return normalizedContent === normalizedDemo;
}

/**
 * Check if a directory looks like a project root for state detection.
 */
function isProjectRootCandidate(dirPath: string): boolean {
    return fs.existsSync(path.join(dirPath, 'settings', 'settings.yaml')) ||
        fs.existsSync(path.join(dirPath, 'settings.yaml')) ||
        fs.existsSync(path.join(dirPath, 'configuration', 'project-configuration.yaml'));
}

/**
 * Resolve the effective content root when a settings folder is provided
 * or when the user-data root contains exactly one project.
 */
function resolveContentRoot(contentPath: string): string {
    const normalizedPath = path.resolve(contentPath);

    if (path.basename(normalizedPath) === 'settings' &&
        fs.existsSync(path.join(normalizedPath, 'settings.yaml'))) {
        return path.dirname(normalizedPath);
    }

    if (isProjectRootCandidate(normalizedPath)) {
        return normalizedPath;
    }

    if (!fs.existsSync(normalizedPath)) {
        return normalizedPath;
    }

    try {
        const entries = fs.readdirSync(normalizedPath, { withFileTypes: true });
        const candidates = entries
            .filter(entry => entry.isDirectory())
            .map(entry => path.join(normalizedPath, entry.name))
            .filter(isProjectRootCandidate);

        if (candidates.length === 1) {
            return candidates[0];
        }
    } catch {
        // Fall through to use the original path
    }

    return normalizedPath;
}

/**
 * Check if settings.yaml exists and has required fields
 */
function checkSettings(contentPath: string): { exists: boolean; valid: boolean } {
    const settingsPath = path.join(contentPath, 'settings', 'settings.yaml');
    const legacySettingsPath = path.join(contentPath, 'settings.yaml');
    const resolvedSettingsPath = fs.existsSync(settingsPath) ? settingsPath : legacySettingsPath;

    if (!fs.existsSync(resolvedSettingsPath)) {
        return { exists: false, valid: false };
    }

    try {
        const content = fs.readFileSync(resolvedSettingsPath, 'utf-8');
        const settings = yaml.load(content) as any;

        // Check for required fields
        const hasTitle = settings?.site?.title;
        const hasUrl = settings?.site?.url;

        return { exists: true, valid: !!(hasTitle && hasUrl) };
    } catch {
        return { exists: true, valid: false };
    }
}

/**
 * Check if any artworks exist
 */
function hasArtworks(contentPath: string): boolean {
    const artworksPath = path.join(contentPath, 'artworks');

    if (!fs.existsSync(artworksPath)) {
        return false;
    }

    try {
        const files = fs.readdirSync(artworksPath);
        return files.some(f => f.endsWith('.yaml'));
    } catch {
        return false;
    }
}

/**
 * Check if a theme is configured
 * Checks settings/settings.yaml first (canonical source), then settings/theme.yaml as fallback
 */
function hasActiveTheme(contentPath: string): boolean {
    // Check settings/settings.yaml first (canonical source used by theme selector)
    const settingsPath = path.join(contentPath, 'settings', 'settings.yaml');
    if (fs.existsSync(settingsPath)) {
        try {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            const settings = yaml.load(content) as any;
            if (typeof settings?.theme === 'string' && settings.theme) {
                return true;
            }
        } catch {
            // Fall through
        }
    }

    // Fallback: check settings/theme.yaml
    const themeYamlPath = path.join(contentPath, 'settings', 'theme.yaml');
    if (fs.existsSync(themeYamlPath)) {
        try {
            const content = fs.readFileSync(themeYamlPath, 'utf-8');
            const themeConfig = yaml.load(content) as any;
            if (themeConfig?.theme || themeConfig?.active) {
                return true;
            }
        } catch {
            // Fall through
        }
    }

    // Legacy: check root settings.yaml
    const legacySettingsPath = path.join(contentPath, 'settings.yaml');
    if (fs.existsSync(legacySettingsPath)) {
        try {
            const content = fs.readFileSync(legacySettingsPath, 'utf-8');
            const settings = yaml.load(content) as any;
            if (settings?.theme?.active || (typeof settings?.theme === 'string' && settings.theme)) {
                return true;
            }
        } catch {
            // No theme found
        }
    }

    return false;
}

/**
 * Get theme information including source classification
 */
function getThemeInfo(contentPath: string, themesPath: string, repoRoot: string): ThemeInfo | null {
    let themeName: string | null = null;

    // Check settings/settings.yaml first (canonical source used by theme selector)
    const settingsPath = path.join(contentPath, 'settings', 'settings.yaml');
    if (fs.existsSync(settingsPath)) {
        try {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            const settings = yaml.load(content) as any;
            if (typeof settings?.theme === 'string' && settings.theme) {
                themeName = settings.theme;
            }
        } catch { }
    }

    // Fallback: check settings/theme.yaml
    if (!themeName) {
        const themeYamlPath = path.join(contentPath, 'settings', 'theme.yaml');
        if (fs.existsSync(themeYamlPath)) {
            try {
                const content = fs.readFileSync(themeYamlPath, 'utf-8');
                const config = yaml.load(content) as any;
                themeName = config?.theme || config?.active;
            } catch { }
        }
    }

    // Legacy: check root settings.yaml
    if (!themeName) {
        const legacySettingsPath = path.join(contentPath, 'settings.yaml');
        if (fs.existsSync(legacySettingsPath)) {
            try {
                const content = fs.readFileSync(legacySettingsPath, 'utf-8');
                const settings = yaml.load(content) as any;
                themeName = settings?.theme?.active || (typeof settings?.theme === 'string' ? settings.theme : null);
            } catch { }
        }
    }

    if (!themeName) {
        return null;
    }

    // Determine theme source
    const builtinThemePath = path.join(repoRoot, 'themes', themeName);
    const customThemePath = path.join(themesPath, themeName);

    let source: ThemeSource = 'none';
    let themePath = '';
    let isEditable = false;

    if (fs.existsSync(builtinThemePath)) {
        source = 'builtin';
        themePath = builtinThemePath;
        isEditable = false;
    } else if (fs.existsSync(customThemePath)) {
        // Check if it's a git repo (external theme)
        const gitPath = path.join(customThemePath, '.git');
        if (fs.existsSync(gitPath)) {
            source = 'repo';
        } else {
            source = 'custom';
        }
        themePath = customThemePath;
        isEditable = true;
    }

    return {
        name: themeName,
        source,
        path: themePath,
        isEditable
    };
}

/**
 * Check if images are available for the current storage mode
 */
function checkImageAvailability(filesPath: string, imageStorage: string): { hasWorkingImages: boolean; imageIssue: string | null } {
    if (imageStorage === 'local') {
        // Check if large folder has any images
        const largePath = path.join(filesPath, 'large');
        if (!fs.existsSync(largePath)) {
            return { hasWorkingImages: false, imageIssue: 'No processed images found (files/large/)' };
        }
        try {
            const files = fs.readdirSync(largePath);
            const hasImages = files.some(f => f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.png'));
            if (!hasImages) {
                return { hasWorkingImages: false, imageIssue: 'No image files in files/large/' };
            }
            return { hasWorkingImages: true, imageIssue: null };
        } catch {
            return { hasWorkingImages: false, imageIssue: 'Cannot read files/large/ directory' };
        }
    } else if (imageStorage === 'r2') {
        // For R2, we can't easily check without credentials; assume working if configured
        // TODO: Could add an API call to verify
        return { hasWorkingImages: true, imageIssue: null };
    } else if (imageStorage === 'external') {
        // For external, assume working if configured
        return { hasWorkingImages: true, imageIssue: null };
    }

    return { hasWorkingImages: false, imageIssue: 'Unknown storage mode' };
}

/**
 * Check if content folder is a git repository
 */
function checkContentGitStatus(contentPath: string): { isGitRepo: boolean; gitRemote: string | null } {
    const gitPath = path.join(contentPath, '.git');

    if (!fs.existsSync(gitPath)) {
        return { isGitRepo: false, gitRemote: null };
    }

    // Try to read git remote
    const configPath = path.join(gitPath, 'config');
    if (fs.existsSync(configPath)) {
        try {
            const config = fs.readFileSync(configPath, 'utf-8');
            // Simple regex to find remote origin URL
            const match = config.match(/\[remote "origin"\][^\[]*url\s*=\s*(.+)/);
            if (match) {
                return { isGitRepo: true, gitRemote: match[1].trim() };
            }
        } catch { }
    }

    return { isGitRepo: true, gitRemote: null };
}

/**
 * Get detailed project state
 */
export function getProjectStateDetails(): StateDetails {
    const rawContentPath = getContentPath();
    const contentPath = resolveContentRoot(rawContentPath);
    const siteProjectPath = getSiteProjectPath();
    const filesPath = getFilesPath();
    const imageStorage = getImageStorageMode();
    const themesPath = getThemesPath();
    const repoRoot = getRepoPath();

    const hasUserDataFolder = fs.existsSync(contentPath);
    const usingDemoContent = isDemoContent(contentPath);
    // Alias for backward compatibility
    const hasContentFolder = hasUserDataFolder;
    const settingsCheck = hasContentFolder ? checkSettings(contentPath) : { exists: false, valid: false };
    const artworksExist = hasContentFolder ? hasArtworks(contentPath) : false;
    const themeConfigured = hasContentFolder ? hasActiveTheme(contentPath) : false;
    const filesExist = fs.existsSync(filesPath);

    // Get theme info
    const themeInfo = hasContentFolder ? getThemeInfo(contentPath, themesPath, repoRoot) : null;

    // Check image availability
    const { hasWorkingImages, imageIssue } = checkImageAvailability(filesPath, imageStorage);

    // Check if content folder is a git repo
    const { isGitRepo, gitRemote } = checkContentGitStatus(contentPath);

    // Determine missing requirements
    const missingRequirements: string[] = [];

    if (!hasContentFolder) {
        missingRequirements.push('Content folder does not exist');
    }
    if (!settingsCheck.exists) {
        missingRequirements.push('Settings file not found');
    } else if (!settingsCheck.valid) {
        missingRequirements.push('Settings missing required fields (title, URL)');
    }
    if (!artworksExist) {
        missingRequirements.push('No artworks created');
    }
    if (!themeConfigured) {
        missingRequirements.push('No theme configured');
    }

    // Determine state
    let state: ProjectState;

    if (!hasContentFolder) {
        state = 'FIRST_RUN';
    } else if (usingDemoContent) {
        state = 'DEMO_MODE';
    } else if (missingRequirements.length > 0) {
        state = 'SETUP';
    } else {
        // TODO: Check for pending changes for NEEDS_DEPLOY
        state = 'READY';
    }

    return {
        state,
        hasUserDataFolder,
        hasContentFolder, // Deprecated alias
        usingDemoContent,
        userDataPath: contentPath,
        contentPath, // Deprecated alias
        hasSettings: settingsCheck.valid,
        hasArtworks: artworksExist,
        hasTheme: themeConfigured,
        themeInfo,
        hasWorkingImages,
        imageIssue,
        imageStorage: imageStorage as 'local' | 'r2' | 'external',
        hasFilesFolder: filesExist,
        contentIsGitRepo: isGitRepo,
        contentGitRemote: gitRemote,
        hasSiteProject: hasSiteProject(),
        siteProjectPath,
        missingRequirements
    };
}

/**
 * Get just the project state (for quick checks)
 */
export function getProjectState(): ProjectState {
    return getProjectStateDetails().state;
}

/**
 * Check if onboarding is required
 */
export function needsOnboarding(): boolean {
    const state = getProjectState();
    return state === 'FIRST_RUN';
}

/**
 * Check if using demo content
 */
export function isUsingDemoContent(): boolean {
    return getProjectStateDetails().usingDemoContent;
}

/**
 * Get user-friendly state label
 */
export function getStateLabel(state: ProjectState): string {
    switch (state) {
        case 'FIRST_RUN':
            return 'First Run - Setup Required';
        case 'DEMO_MODE':
            return 'Demo Mode';
        case 'SETUP':
            return 'Setup Incomplete';
        case 'READY':
            return 'Ready';
        case 'NEEDS_DEPLOY':
            return 'Changes Pending Deploy';
        default:
            return 'Unknown';
    }
}

/**
 * Get state badge color
 */
export function getStateBadgeColor(state: ProjectState): string {
    switch (state) {
        case 'FIRST_RUN':
            return 'orange';
        case 'DEMO_MODE':
            return 'blue';
        case 'SETUP':
            return 'yellow';
        case 'READY':
            return 'green';
        case 'NEEDS_DEPLOY':
            return 'purple';
        default:
            return 'gray';
    }
}
