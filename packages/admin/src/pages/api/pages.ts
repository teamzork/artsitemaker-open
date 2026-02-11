// packages/admin/src/pages/api/pages.ts
import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

// Import page type utilities
// Note: These are compiled at build time, so we inline the types here
interface PageTypeDefinition {
    id: string;
    label: string;
    multiInstance: boolean;
    isCore: boolean;
    isCustom?: boolean;
    defaultEnabled: boolean;
}

const PAGE_TYPES: PageTypeDefinition[] = [
    { id: 'home', label: 'Home Landing Page', multiInstance: false, isCore: true, defaultEnabled: true },
    { id: 'gallery', label: 'Gallery', multiInstance: false, isCore: true, defaultEnabled: true },
    { id: 'slider', label: 'Slider (Lightbox)', multiInstance: false, isCore: true, defaultEnabled: true },
    { id: 'art_piece', label: 'Art Piece Page', multiInstance: true, isCore: false, defaultEnabled: true },
    { id: 'about', label: 'About', multiInstance: false, isCore: true, defaultEnabled: true },
    { id: 'collections_list', label: 'Collections List', multiInstance: false, isCore: false, defaultEnabled: false },
    { id: 'article', label: 'Article / Static Page', multiInstance: true, isCore: false, defaultEnabled: false },
    { id: 'schedule', label: 'Schedule', multiInstance: false, isCore: true, defaultEnabled: false },
    { id: 'contact', label: 'Contact', multiInstance: false, isCore: false, defaultEnabled: false },
    { id: 'search_results', label: 'Search Results', multiInstance: false, isCore: false, defaultEnabled: false },
    { id: 'service', label: 'Service Pages (Terms, Privacy)', multiInstance: true, isCore: false, defaultEnabled: true },
];

// Predefined page IDs - used to detect name collisions with custom pages
const PREDEFINED_PAGE_IDS = new Set(PAGE_TYPES.map(p => p.id));

const HOME_FALLBACK_ORDER = ['home', 'gallery', 'about', 'slider', 'schedule'];

const LINK_FALLBACKS: Record<string, string[]> = {
    galleryClick: ['art_piece', 'slider', 'none'],
    collectionClick: ['gallery', 'none'],
    artPieceBack: ['gallery', 'collections_list', 'history'],
    searchResultClick: ['art_piece', 'slider'],
};

import { getThemesPath, getContentPath } from '../../lib/paths';
import { getPagesConfigPath, getSettingsFilePath, getThemeConfigPath } from '../../lib/config-paths';

// Helper to sync custom pages navigation
async function syncCustomPagesToNav(
    customPages: PageTypeDefinition[],
    showInNav: Record<string, boolean>
): Promise<void> {
    try {
        const settingsPath = getSettingsFilePath();

        // Load existing settings
        let settings: any = {};
        try {
            const content = await fs.readFile(settingsPath, 'utf-8');
            settings = yaml.load(content) as any;
        } catch {
            // File doesn't exist, start fresh
        }

        // Ensure nav config exists
        if (!settings.nav) {
            settings.nav = {
                showLogo: true,
                items: [
                    { label: 'Gallery', href: '/' },
                    { label: 'Slideshow', href: '/slideshow' },
                    { label: 'About', href: '/about' }
                ]
            };
        }

        const navItems = settings.nav.items || [];
        const existingHrefs = new Set(navItems.map((item: any) => item.href));

        // For each custom page with showInNav: true, add to nav if not already there
        for (const customPage of customPages) {
            const href = `/${customPage.id}`;
            const shouldShow = showInNav[customPage.id] !== false;
            const existsInNav = existingHrefs.has(href);

            if (shouldShow && !existsInNav) {
                // Add to navigation
                navItems.push({
                    label: customPage.label,
                    href: href,
                    external: false
                });
            } else if (!shouldShow && existsInNav) {
                // Remove from navigation
                const index = navItems.findIndex((item: any) => item.href === href);
                if (index !== -1) {
                    navItems.splice(index, 1);
                }
            } else if (shouldShow && existsInNav) {
                // Update label if changed
                const navItem = navItems.find((item: any) => item.href === href);
                if (navItem) {
                    navItem.label = customPage.label;
                }
            }
        }

        settings.nav.items = navItems;

        // Write updated settings
        // Write updated settings
        const yamlContent = yaml.dump(settings, {
            lineWidth: -1,
            quotingType: '"'
        });

        await fs.mkdir(path.dirname(settingsPath), { recursive: true });
        await fs.writeFile(settingsPath, yamlContent, 'utf-8');
    } catch (error) {
        console.error('Failed to sync custom pages to navigation:', error);
        // Non-fatal error, continue
    }
}

// Helper to get theme name from settings
async function getCurrentThemeName(): Promise<string> {
    // 1. Check settings.yaml (legacy/combined) - Takes Priority
    try {
        const settingsPath = getSettingsFilePath();
        const content = await fs.readFile(settingsPath, 'utf-8');
        const settings = yaml.load(content) as any;
        const themeName =
            settings?.theme?.active ||
            (typeof settings?.theme === 'string' ? settings.theme : null);
        if (typeof themeName === 'string' && themeName.trim()) {
            return themeName.trim();
        }
    } catch {
        // settings.yaml not found or invalid
    }

    // 2. Fallback to independent theme.yaml config
    try {
        const themeConfigPath = getThemeConfigPath();
        const content = await fs.readFile(themeConfigPath, 'utf-8');
        const config = yaml.load(content) as any;
        if (config?.theme && typeof config.theme === 'string') {
            return config.theme.trim();
        }
    } catch {
        // theme.yaml doesn't exist or is invalid
    }

    return 'modern';
}

// Helper to get core page types
function getCorePageTypes(): PageTypeDefinition[] {
    return PAGE_TYPES.filter(p => p.isCore);
}

// Check if at least one core page is enabled
function hasEnabledCorePage(enabled: Record<string, boolean>): boolean {
    return getCorePageTypes().some(p => enabled[p.id] === true);
}

// Get theme's supported pages
async function getThemeSupportedPages(themeName: string): Promise<string[]> {
    try {
        const themePath = path.join(getThemesPath(), themeName, 'theme.yaml');
        const content = await fs.readFile(themePath, 'utf-8');
        const theme = yaml.load(content) as any;
        if (theme.supported_pages && Array.isArray(theme.supported_pages)) {
            return theme.supported_pages;
        }
    } catch (e) {
        // Theme not found or no supported_pages, return all
    }
    return PAGE_TYPES.map(p => p.id);
}

// Load custom pages from content/pages/*.yaml
async function loadCustomPages(): Promise<PageTypeDefinition[]> {
    const customPages: PageTypeDefinition[] = [];
    const pagesDir = path.join(getContentPath(), 'pages');

    try {
        const files = await fs.readdir(pagesDir);

        for (const file of files) {
            if (!file.endsWith('.yaml')) continue;

            const slug = file.replace('.yaml', '');

            // Skip if this slug matches a predefined page type (name collision)
            // Also skip footer.yaml as it's handled separately by the footer editor
            if (PREDEFINED_PAGE_IDS.has(slug) || slug === 'footer') continue;

            try {
                const content = await fs.readFile(path.join(pagesDir, file), 'utf-8');
                const page = yaml.load(content) as any;

                customPages.push({
                    id: slug,
                    label: page.title || slug,
                    multiInstance: false,
                    isCore: false,
                    isCustom: true,
                    defaultEnabled: true
                });
            } catch (e) {
                // Skip files that can't be read/parsed
                console.warn(`Failed to load custom page: ${file}`, e);
            }
        }
    } catch (e) {
        // Directory doesn't exist or can't be read
    }

    return customPages;
}

// Resolve home page fallback
function resolveHomePage(
    designatedHome: string,
    enabled: Record<string, boolean>,
    supportedPages: string[]
): string {
    if (enabled[designatedHome] && supportedPages.includes(designatedHome)) {
        return designatedHome;
    }
    for (const pageId of HOME_FALLBACK_ORDER) {
        if (enabled[pageId] && supportedPages.includes(pageId)) {
            return pageId;
        }
    }
    return 'gallery';
}

// Resolve link target with fallback
function resolveLinkTarget(
    linkType: string,
    currentTarget: string,
    enabled: Record<string, boolean>,
    supportedPages: string[]
): string {
    const fallbacks = LINK_FALLBACKS[linkType];
    if (!fallbacks) return currentTarget;

    if (currentTarget === 'none' || currentTarget === 'history') {
        return currentTarget;
    }
    if (enabled[currentTarget] && supportedPages.includes(currentTarget)) {
        return currentTarget;
    }

    for (const target of fallbacks) {
        if (target === 'none' || target === 'history') {
            return target;
        }
        if (enabled[target] && supportedPages.includes(target)) {
            return target;
        }
    }

    return 'none';
}

/**
 * GET /api/pages - Get current page settings with theme support info
 */
export const GET: APIRoute = async () => {
    try {
        const themeName = await getCurrentThemeName();
        const themeSupportedPages = await getThemeSupportedPages(themeName);

        // Load custom pages from content/pages/*.yaml
        const customPages = await loadCustomPages();

        // Merge predefined and custom pages
        const allPageTypes = [...PAGE_TYPES, ...customPages];

        // Custom pages are always "supported" (not restricted by theme)
        const supportedPages = [...themeSupportedPages, ...customPages.map(p => p.id)];

        // Get pages config from content/settings/pages.yaml
        let pages: any = null;
        try {
            const pagesConfigPath = getPagesConfigPath();
            const content = await fs.readFile(pagesConfigPath, 'utf-8');
            pages = yaml.load(content) as any;
        } catch {
            // File doesn't exist, use defaults
        }

        // Use defaults if no config found
        if (!pages) {
            const defaultEnabled = Object.fromEntries(allPageTypes.map(p => [p.id, p.defaultEnabled]));
            pages = {
                enabled: defaultEnabled,
                homePage: 'gallery',
                linking: {
                    galleryClick: 'slider',
                    collectionClick: 'gallery',
                    artPieceBack: 'gallery',
                    searchResultClick: 'art_piece',
                },
                // Default showInNav: true for enabled single-instance pages
                showInNav: Object.fromEntries(
                    allPageTypes
                        .filter(p => !p.multiInstance && defaultEnabled[p.id])
                        .map(p => [p.id, true])
                )
            };
        }

        // Ensure enabled exists and has defaults for custom pages
        if (!pages.enabled) {
            pages.enabled = {};
        }
        // Initialize default enabled state for custom pages (default: true)
        customPages.forEach(customPage => {
            if (pages.enabled[customPage.id] === undefined) {
                pages.enabled[customPage.id] = true;
            }
        });

        // Ensure showInNav exists and has defaults for enabled single-instance pages
        if (!pages.showInNav) {
            pages.showInNav = {};
        }
        // Initialize defaults for enabled single-instance pages that don't have showInNav set
        allPageTypes.forEach(pageType => {
            if (!pageType.multiInstance && pages.enabled[pageType.id] && pages.showInNav[pageType.id] === undefined) {
                pages.showInNav[pageType.id] = true;
            }
        });

        return new Response(JSON.stringify({
            pageTypes: allPageTypes,
            pages,
            supportedPages,
            themeName,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to load page settings:', error);
        return new Response(JSON.stringify({ error: 'Failed to load page settings' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

/**
 * PUT /api/pages - Update page settings with validation
 */
export const PUT: APIRoute = async ({ request }) => {
    try {
        const updates = await request.json();

        const themeName = await getCurrentThemeName();
        const themeSupportedPages = await getThemeSupportedPages(themeName);

        // Load custom pages to include in supported list
        const customPages = await loadCustomPages();
        const supportedPages = [...themeSupportedPages, ...customPages.map(p => p.id)];

        // Load existing pages config from content/settings/pages.yaml
        let pages: any = {};
        try {
            const pagesConfigPath = getPagesConfigPath();
            const content = await fs.readFile(pagesConfigPath, 'utf-8');
            pages = yaml.load(content) as any;
        } catch {
            // File doesn't exist, start fresh
        }

        // Initialize pages config if not exists
        if (!pages.enabled) {
            pages.enabled = Object.fromEntries(PAGE_TYPES.map(p => [p.id, p.defaultEnabled]));
        }
        if (!pages.homePage) {
            pages.homePage = 'gallery';
        }
        if (!pages.linking) {
            pages.linking = {
                galleryClick: 'slider',
                collectionClick: 'gallery',
                artPieceBack: 'gallery',
                searchResultClick: 'art_piece',
            };
        }
        if (!pages.showInNav) {
            pages.showInNav = {};
        }

        // Handle page enable/disable updates
        if (updates.enabled) {
            const newEnabled = { ...pages.enabled, ...updates.enabled };

            // Validate: at least one core page must be enabled
            if (!hasEnabledCorePage(newEnabled)) {
                return new Response(JSON.stringify({
                    error: 'At least one core page type must be enabled.',
                    field: 'enabled'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            pages.enabled = newEnabled;
        }

        // Handle home page update
        if (updates.homePage) {
            const enabled = pages.enabled;
            // Validate home page is enabled and supported
            const resolvedHome = resolveHomePage(updates.homePage, enabled, supportedPages);
            if (resolvedHome !== updates.homePage) {
                // Requested home page not available, use fallback but warn
                pages.homePage = resolvedHome;
            } else {
                pages.homePage = updates.homePage;
            }
        }

        // Handle linking updates with fallback resolution
        if (updates.linking) {
            const enabled = pages.enabled;
            const currentLinking = pages.linking || {};

            for (const [key, value] of Object.entries(updates.linking)) {
                const resolved = resolveLinkTarget(key, value as string, enabled, supportedPages);
                currentLinking[key] = resolved;
            }

            pages.linking = currentLinking;
        }

        // Handle showInNav updates
        if (updates.showInNav) {
            pages.showInNav = { ...pages.showInNav, ...updates.showInNav };

            // Sync custom pages to navigation
            await syncCustomPagesToNav(customPages, pages.showInNav);
        }

        // Ensure directory exists
        const pagesConfigPath = getPagesConfigPath();
        const settingsDir = path.dirname(pagesConfigPath);
        await fs.mkdir(settingsDir, { recursive: true });

        // Write updated pages config to content/settings/pages.yaml
        const yamlContent = yaml.dump(pages, {
            lineWidth: -1,
            quotingType: '"'
        });
        await fs.writeFile(pagesConfigPath, yamlContent, 'utf-8');

        return new Response(JSON.stringify({
            success: true,
            pages,
            supportedPages
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to update page settings:', error);
        return new Response(JSON.stringify({ error: 'Failed to update page settings' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

/**
 * POST /api/pages/validate-theme-switch - Check theme switch impact
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        const { newTheme } = await request.json();

        // Load current pages config
        let pages: any = {};
        try {
            const pagesConfigPath = getPagesConfigPath();
            const content = await fs.readFile(pagesConfigPath, 'utf-8');
            pages = yaml.load(content) as any;
        } catch {
            // Use defaults
        }

        // Load custom pages (they remain supported across theme switches)
        const customPages = await loadCustomPages();

        const currentEnabled = pages.enabled || {};
        const themeSupportedPages = await getThemeSupportedPages(newTheme);
        const newSupportedPages = [...themeSupportedPages, ...customPages.map(p => p.id)];

        // Find pages that will become unsupported
        const affectedPages: string[] = [];
        for (const [pageId, isEnabled] of Object.entries(currentEnabled)) {
            if (isEnabled && !newSupportedPages.includes(pageId)) {
                const pageType = PAGE_TYPES.find(p => p.id === pageId);
                if (pageType) {
                    affectedPages.push(pageType.label);
                }
            }
        }

        // Check if home page will be affected
        const currentHome = pages.homePage || 'gallery';
        const newHome = resolveHomePage(currentHome, currentEnabled, newSupportedPages);
        const homePageAffected = currentHome !== newHome;

        return new Response(JSON.stringify({
            affectedPages,
            homePageAffected,
            currentHome,
            newHome,
            newSupportedPages,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to validate theme switch:', error);
        return new Response(JSON.stringify({ error: 'Failed to validate theme switch' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
