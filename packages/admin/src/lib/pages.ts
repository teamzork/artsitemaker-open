/**
 * Page System Configuration
 *
 * Provides page type registry, enable/disable logic, and helper functions
 * for managing page configuration in the admin panel.
 */

import fs from 'fs';
import yaml from 'js-yaml';
import { getPagesConfigPath } from './config-paths';

/**
 * Metadata for a page type in the registry
 */
export interface PageMetadata {
    id: string;
    name: string;
    isCorePage: boolean;
    multipleInstances: boolean;
    fallbackPriority: number | null;
}

/**
 * Complete registry of all page types in the system.
 *
 * Core pages: At least one must always be enabled.
 * Fallback priority: Used to determine home page when designated home is disabled.
 */
export const PAGE_REGISTRY: Record<string, PageMetadata> = {
    home: {
        id: 'home',
        name: 'Home',
        isCorePage: true,
        multipleInstances: false,
        fallbackPriority: 1,
    },
    gallery: {
        id: 'gallery',
        name: 'Gallery',
        isCorePage: true,
        multipleInstances: false,
        fallbackPriority: 2,
    },
    about: {
        id: 'about',
        name: 'About',
        isCorePage: true,
        multipleInstances: false,
        fallbackPriority: 3,
    },
    slider: {
        id: 'slider',
        name: 'Slider (Lightbox)',
        isCorePage: true,
        multipleInstances: false,
        fallbackPriority: 4,
    },
    schedule: {
        id: 'schedule',
        name: 'Schedule',
        isCorePage: true,
        multipleInstances: false,
        fallbackPriority: 5,
    },
    art_piece: {
        id: 'art_piece',
        name: 'Art Piece Page',
        isCorePage: false,
        multipleInstances: true,
        fallbackPriority: null,
    },
    collections_list: {
        id: 'collections_list',
        name: 'Collections List',
        isCorePage: false,
        multipleInstances: false,
        fallbackPriority: null,
    },
    article: {
        id: 'article',
        name: 'Article',
        isCorePage: false,
        multipleInstances: true,
        fallbackPriority: null,
    },
    contact: {
        id: 'contact',
        name: 'Contact',
        isCorePage: false,
        multipleInstances: false,
        fallbackPriority: null,
    },
    search_results: {
        id: 'search_results',
        name: 'Search Results',
        isCorePage: false,
        multipleInstances: false,
        fallbackPriority: null,
    },
};

/**
 * Pages configuration structure from pages.yaml
 */
export interface PagesConfig {
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
 * Load the pages configuration from pages.yaml.
 *
 * @returns PagesConfig object or null if file doesn't exist
 */
export function loadPagesConfig(): PagesConfig | null {
    const configPath = getPagesConfigPath();
    if (!fs.existsSync(configPath)) {
        return null;
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    return yaml.load(content) as PagesConfig;
}

/**
 * Check if a page type is enabled.
 *
 * Reads from content/settings/pages.yaml enabled section.
 * Returns false for undefined page types or if config doesn't exist.
 *
 * @param pageType - The page type ID to check (e.g., 'home', 'gallery')
 * @returns true if the page is enabled, false otherwise
 */
export function isPageEnabled(pageType: string): boolean {
    if (!(pageType in PAGE_REGISTRY)) {
        return false;
    }
    const config = loadPagesConfig();
    if (!config || !config.enabled) {
        return false;
    }
    return config.enabled[pageType] === true;
}

/**
 * Get the current home page for the site.
 *
 * Returns the configured homePage from pages.yaml if it's enabled.
 * If the configured home page is disabled, falls back through core pages
 * in priority order (home=1, gallery=2, about=3, slider=4, schedule=5).
 *
 * @returns The page type ID to use as home, or 'gallery' as ultimate fallback
 */
export function getHomePage(): string {
    const config = loadPagesConfig();

    if (config?.homePage && isPageEnabled(config.homePage)) {
        return config.homePage;
    }

    const corePagesByPriority = Object.values(PAGE_REGISTRY)
        .filter((page) => page.isCorePage && page.fallbackPriority !== null)
        .sort((a, b) => (a.fallbackPriority ?? 0) - (b.fallbackPriority ?? 0));

    for (const page of corePagesByPriority) {
        if (isPageEnabled(page.id)) {
            return page.id;
        }
    }

    return 'gallery';
}

/**
 * Valid link types for inter-page navigation.
 */
export type LinkType = 'galleryClick' | 'collectionClick' | 'artPieceBack' | 'searchResultClick';

/**
 * Get the target page for a specific link type, respecting enabled state.
 *
 * Reads linking configuration from pages.yaml and resolves the target.
 * If the configured target is disabled, attempts to fall back to home page.
 * Returns null if no valid target can be resolved.
 *
 * @param source - The source page type (not currently used, reserved for future per-source overrides)
 * @param linkType - The type of link (e.g., 'galleryClick', 'collectionClick')
 * @returns The resolved target page type ID, or null if no valid target available
 */
export function getLinkTarget(source: string, linkType: LinkType): string | null {
    const config = loadPagesConfig();
    if (!config || !config.linking) {
        return null;
    }

    const targetPage = config.linking[linkType];
    if (!targetPage) {
        return null;
    }

    if (isPageEnabled(targetPage)) {
        return targetPage;
    }

    const homePage = getHomePage();
    if (isPageEnabled(homePage)) {
        return homePage;
    }

    return null;
}

/**
 * Page types that require content files in content/pages/
 */
export const CONTENT_FILE_PAGES = ['about'] as const;

/**
 * Default content for core page content files
 */
export const CONTENT_FILE_DEFAULTS: Record<string, object> = {
    about: {
        slug: 'about',
        title: 'About',
        template: 'about',
        sortOrder: 1,
        showInNav: true,
        content: '',
    },
};

/**
 * Check if a page type requires a content file in content/pages/
 */
export function requiresContentFile(pageType: string): boolean {
    return CONTENT_FILE_PAGES.includes(pageType as any);
}

/**
 * Check if a content file slug is a core file that cannot be deleted
 */
export function isCoreContentFile(slug: string): boolean {
    return CONTENT_FILE_PAGES.includes(slug as any);
}

/**
 * Get the default content for a core content file
 */
export function getCoreContentFileDefault(slug: string): object | null {
    return CONTENT_FILE_DEFAULTS[slug] || null;
}

/**
 * Validation result for page configuration.
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validate the current page configuration.
 *
 * Checks that:
 * - At least one core page is enabled
 * - The configured homePage points to an enabled page
 *
 * @returns ValidationResult with valid status and any error messages
 */
export function validatePageConfig(): ValidationResult {
    const errors: string[] = [];
    const config = loadPagesConfig();

    if (!config) {
        errors.push(`Pages configuration file not found at: ${getPagesConfigPath()}`);
        return { valid: false, errors };
    }

    const corePages = Object.values(PAGE_REGISTRY).filter((page) => page.isCorePage);
    const enabledCorePages = corePages.filter((page) => config.enabled?.[page.id] === true);

    if (enabledCorePages.length === 0) {
        errors.push('At least one core page must be enabled (home, gallery, about, slider, or schedule)');
    }

    if (config.homePage) {
        if (!(config.homePage in PAGE_REGISTRY)) {
            errors.push(`Home page "${config.homePage}" is not a valid page type`);
        } else if (config.enabled?.[config.homePage] !== true) {
            errors.push(`Home page "${config.homePage}" is disabled`);
        }
    }

    return { valid: errors.length === 0, errors };
}
