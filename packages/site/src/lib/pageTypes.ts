/**
 * Page Type Registry for Theme Engine Integrity
 *
 * Defines all supported page types, their metadata, and utility functions
 * for page enable/disable logic and fallback resolution.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getSettingsPath, getContentPath } from './paths';

export interface PageTypeDefinition {
    id: string;
    label: string;
    multiInstance: boolean;
    isCore: boolean;  // At least one core page must always be enabled
    defaultEnabled: boolean;
    route: string;    // Base route for this page type
}

export const PAGE_TYPES: PageTypeDefinition[] = [
    { id: 'home', label: 'Home', multiInstance: false, isCore: true, defaultEnabled: true, route: '/' },
    { id: 'gallery', label: 'Gallery', multiInstance: false, isCore: true, defaultEnabled: true, route: '/gallery' },
    { id: 'slider', label: 'Slider (Lightbox)', multiInstance: false, isCore: true, defaultEnabled: true, route: '/slideshow' },
    { id: 'art_piece', label: 'Art Piece Page', multiInstance: true, isCore: false, defaultEnabled: true, route: '/gallery/[slug]' },
    { id: 'about', label: 'About', multiInstance: false, isCore: true, defaultEnabled: true, route: '/about' },
    { id: 'collections_list', label: 'Collections List', multiInstance: false, isCore: false, defaultEnabled: false, route: '/collections' },
    { id: 'article', label: 'Article', multiInstance: true, isCore: false, defaultEnabled: false, route: '/articles/[slug]' },
    { id: 'schedule', label: 'Schedule', multiInstance: false, isCore: true, defaultEnabled: false, route: '/schedule' },
    { id: 'contact', label: 'Contact', multiInstance: false, isCore: false, defaultEnabled: false, route: '/contact' },
    { id: 'search_results', label: 'Search Results', multiInstance: false, isCore: false, defaultEnabled: false, route: '/search' },
    { id: 'service', label: 'Service Pages', multiInstance: true, isCore: false, defaultEnabled: true, route: '/service/[slug]' },
];

// Ordered fallback hierarchy for home page designation
export const HOME_FALLBACK_ORDER = ['home', 'gallery', 'about', 'slider', 'schedule'];

// Link target fallback mappings
export const LINK_FALLBACKS: Record<string, string[]> = {
    galleryClick: ['art_piece', 'slider', 'none'],
    collectionClick: ['gallery', 'none'],
    artPieceBack: ['gallery', 'collections_list', 'history'],
    searchResultClick: ['art_piece', 'slider'],
};

export interface PageSettings {
    enabled: Record<string, boolean>;
    homePage: string;
    linking: {
        galleryClick: string;
        collectionClick: string;
        artPieceBack: string;
        searchResultClick: string;
    };
    showInNav?: Record<string, boolean>;
}

/**
 * Get page type definition by ID
 */
export function getPageType(id: string): PageTypeDefinition | undefined {
    return PAGE_TYPES.find(p => p.id === id);
}

/**
 * Get all core page types
 */
export function getCorePageTypes(): PageTypeDefinition[] {
    return PAGE_TYPES.filter(p => p.isCore);
}

/**
 * Check if at least one core page is enabled
 */
export function hasEnabledCorePage(enabled: Record<string, boolean>): boolean {
    return getCorePageTypes().some(p => enabled[p.id] === true);
}

/**
 * Validate page enable/disable request
 * Returns error message if invalid, null if valid
 */
export function validatePageToggle(
    pageId: string,
    newState: boolean,
    currentEnabled: Record<string, boolean>
): string | null {
    const page = getPageType(pageId);
    if (!page) {
        return `Unknown page type: ${pageId}`;
    }

    // If enabling, always allowed
    if (newState) {
        return null;
    }

    // If disabling a core page, check we still have at least one core page
    if (page.isCore) {
        const testEnabled = { ...currentEnabled, [pageId]: false };
        if (!hasEnabledCorePage(testEnabled)) {
            return 'At least one core page type must be enabled.';
        }
    }

    return null;
}

/**
 * Get default page settings with sensible defaults
 */
export function getDefaultPageSettings(): PageSettings {
    const enabled: Record<string, boolean> = {};
    for (const page of PAGE_TYPES) {
        enabled[page.id] = page.defaultEnabled;
    }

    return {
        enabled,
        homePage: 'gallery',
        linking: {
            galleryClick: 'slider',
            collectionClick: 'gallery',
            artPieceBack: 'gallery',
            searchResultClick: 'art_piece',
        },
    };
}

/**
 * Resolve home page based on fallback hierarchy
 * Used when designated home page becomes unavailable
 */
export function resolveHomePage(
    designatedHome: string,
    enabled: Record<string, boolean>,
    supportedPages: string[]
): string {
    // Check if designated home is still available
    if (enabled[designatedHome] && supportedPages.includes(designatedHome)) {
        return designatedHome;
    }

    // Fallback to first available in hierarchy
    for (const pageId of HOME_FALLBACK_ORDER) {
        if (enabled[pageId] && supportedPages.includes(pageId)) {
            return pageId;
        }
    }

    // Should never reach here if validation is correct, but return gallery as ultimate fallback
    return 'gallery';
}

/**
 * Resolve link target based on fallbacks
 * Returns the first available target, or 'none' if none available
 */
export function resolveLinkTarget(
    linkType: keyof typeof LINK_FALLBACKS,
    currentTarget: string,
    enabled: Record<string, boolean>,
    supportedPages: string[]
): string {
    const fallbacks = LINK_FALLBACKS[linkType];
    if (!fallbacks) return currentTarget;

    // Check if current target is still valid
    if (currentTarget === 'none' || currentTarget === 'history') {
        return currentTarget;
    }
    if (enabled[currentTarget] && supportedPages.includes(currentTarget)) {
        return currentTarget;
    }

    // Find first available fallback
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
 * Check if a specific page type is enabled
 */
export async function isPageEnabled(pageId: string): Promise<boolean> {
    try {
        const settingsPath = getSettingsPath();
        if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            const settings = yaml.load(content) as any;

            // If pages section doesn't exist, use defaults
            if (!settings.pages?.enabled) {
                const defaults = getDefaultPageSettings();
                return defaults.enabled[pageId] ?? false;
            }

            return settings.pages.enabled[pageId] ?? false;
        }
    } catch (e) {
        console.error('Failed to check page enabled status:', e);
    }

    // Default to enabled for backward compatibility
    return true;
}

/**
 * Get all page settings including enabled status and linking config
 * Reads from content/settings/pages.yaml (new modular structure)
 * Falls back to settings.yaml for backward compatibility
 */
export async function getPageSettings(): Promise<PageSettings> {
    try {
        const contentPath = getContentPath();
        const pagesConfigPath = path.join(contentPath, 'settings', 'pages.yaml');
        
        // Try new modular structure first
        if (fs.existsSync(pagesConfigPath)) {
            const content = fs.readFileSync(pagesConfigPath, 'utf-8');
            const pagesConfig = yaml.load(content) as any;
            const defaults = getDefaultPageSettings();

            return {
                ...defaults,
                ...pagesConfig,
                enabled: { ...defaults.enabled, ...pagesConfig.enabled },
                linking: { ...defaults.linking, ...pagesConfig.linking },
                showInNav: pagesConfig.showInNav || {}
            };
        }

        // Fallback to old structure in settings.yaml
        const settingsPath = getSettingsPath();
        if (fs.existsSync(settingsPath)) {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            const settings = yaml.load(content) as any;

            const defaults = getDefaultPageSettings();

            return {
                ...defaults,
                ...settings.pages,
                enabled: { ...defaults.enabled, ...settings.pages?.enabled },
                linking: { ...defaults.linking, ...settings.pages?.linking },
                showInNav: settings.pages?.showInNav || {}
            };
        }
    } catch (e) {
        console.error('Failed to load page settings:', e);
    }

    return getDefaultPageSettings();
}

/**
 * Map navigation href to page type ID
 * Handles home page routing (when gallery is home, '/' maps to 'gallery')
 */
export function getPageTypeFromHref(href: string, homePage: string = 'gallery'): string | null {
    // Handle home page case
    if (href === '/') {
        return homePage === 'home' ? 'home' : homePage;
    }

    // Map hrefs to page types
    const hrefToPageType: Record<string, string> = {
        '/gallery': 'gallery',
        '/slideshow': 'slider',
        '/about': 'about',
        '/schedule': 'schedule',
        '/contact': 'contact',
        '/collections': 'collections_list',
        '/search': 'search_results',
    };

    return hrefToPageType[href] || null;
}

/**
 * Filter navigation items based on showInNav setting
 */
export async function filterNavigationItems(
    navItems: Array<{ label: string; href: string; external?: boolean }>
): Promise<Array<{ label: string; href: string; external?: boolean }>> {
    const pageSettings = await getPageSettings();
    const { showInNav = {}, homePage } = pageSettings;

    return navItems.filter(item => {
        // External links are always shown
        if (item.external) {
            return true;
        }

        // Map href to page type for predefined pages
        const pageType = getPageTypeFromHref(item.href, homePage);
        
        if (pageType) {
            // This is a predefined page - check its showInNav setting
            return showInNav[pageType] !== false;
        }
        
        // Not a predefined page - check if it's a custom page
        // Custom pages have hrefs like /techniques, /contact-us, etc.
        if (item.href.startsWith('/') && !item.href.startsWith('//')) {
            const customPageSlug = item.href.substring(1); // Remove leading /
            
            // Check showInNav setting for custom page (defaults to true)
            return showInNav[customPageSlug] !== false;
        }
        
        // Fallback: show the item
        return true;
    });
}

/**
 * Check if search functionality should be available
 * (Search inputs should be hidden when search_results page is disabled)
 */
export async function isSearchEnabled(): Promise<boolean> {
    return isPageEnabled('search_results');
}

/**
 * Get set of predefined page IDs that have their own dedicated routes
 * Used to filter out predefined pages from custom page routes
 */
export function getPredefinedPageIds(): Set<string> {
    return new Set(PAGE_TYPES.map(page => page.id));
}
