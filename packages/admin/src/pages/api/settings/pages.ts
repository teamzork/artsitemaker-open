import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import { getPagesConfigPath } from '../../../lib/config-paths';
import {
    loadPagesConfig,
    validatePageConfig,
    PAGE_REGISTRY,
    type PagesConfig,
    type ValidationResult,
} from '../../../lib/pages';

interface PagesAPIResponse {
    config: PagesConfig | null;
    validation: ValidationResult;
    registry: typeof PAGE_REGISTRY;
}

interface PagesAPIPutResponse {
    success: boolean;
    config?: PagesConfig;
    validation?: ValidationResult;
    error?: string;
}

export const GET: APIRoute = async () => {
    try {
        const config = loadPagesConfig();
        const validation = validatePageConfig();

        const response: PagesAPIResponse = {
            config,
            validation,
            registry: PAGE_REGISTRY,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Failed to load page settings:', error);
        return new Response(JSON.stringify({ error: 'Failed to load page settings' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

export const PUT: APIRoute = async ({ request }) => {
    try {
        const updates = (await request.json()) as Partial<PagesConfig>;

        let existing = loadPagesConfig();
        if (!existing) {
            existing = {
                enabled: {},
                homePage: 'gallery',
                linking: {
                    galleryClick: 'slider',
                    collectionClick: 'gallery',
                    artPieceBack: 'slider',
                    searchResultClick: 'art_piece',
                },
            };
        }

        const merged: PagesConfig = {
            enabled: { ...existing.enabled, ...updates.enabled },
            homePage: updates.homePage ?? existing.homePage,
            linking: { ...existing.linking, ...updates.linking },
        };

        const corePages = Object.values(PAGE_REGISTRY).filter((page) => page.isCorePage);
        const enabledCorePages = corePages.filter((page) => merged.enabled[page.id] === true);
        const errors: string[] = [];

        if (enabledCorePages.length === 0) {
            errors.push(
                'At least one core page must be enabled (home, gallery, about, slider, or schedule)'
            );
        }

        if (merged.homePage) {
            if (!(merged.homePage in PAGE_REGISTRY)) {
                errors.push(`Home page "${merged.homePage}" is not a valid page type`);
            } else if (merged.enabled[merged.homePage] !== true) {
                errors.push(`Home page "${merged.homePage}" is disabled`);
            }
        }

        if (errors.length > 0) {
            const response: PagesAPIPutResponse = {
                success: false,
                validation: { valid: false, errors },
                error: errors.join('; '),
            };
            return new Response(JSON.stringify(response), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const yamlContent = yaml.dump(merged, {
            lineWidth: -1,
            quotingType: '"',
        });
        await fs.writeFile(getPagesConfigPath(), yamlContent, 'utf-8');

        const response: PagesAPIPutResponse = {
            success: true,
            config: merged,
            validation: { valid: true, errors: [] },
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Failed to save page settings:', error);
        return new Response(JSON.stringify({ error: 'Failed to save page settings' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
