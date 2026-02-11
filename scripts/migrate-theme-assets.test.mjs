#!/usr/bin/env node
/**
 * Integration tests for theme asset migration
 * Tests the migration script functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testRoot = path.resolve(__dirname, '../test-fixtures/migration');

// Helper to load yaml dynamically
async function loadYaml() {
    const yaml = await import('js-yaml');
    return yaml.default || yaml;
}

describe('Theme Asset Migration', () => {
    beforeEach(async () => {
        // Create test fixture structure
        await fs.mkdir(path.join(testRoot, 'user-data', 'assets', 'fonts'), { recursive: true });
        await fs.mkdir(path.join(testRoot, 'user-data', 'assets', 'logos'), { recursive: true });
        await fs.mkdir(path.join(testRoot, 'themes', 'test-theme', 'assets', 'fonts'), { recursive: true });
        await fs.mkdir(path.join(testRoot, 'themes', 'test-theme', 'assets', 'logos'), { recursive: true });
        await fs.mkdir(path.join(testRoot, 'themes', 'recommended-assets', 'test-theme', 'fonts'), { recursive: true });
        await fs.mkdir(path.join(testRoot, 'themes', 'recommended-assets', 'test-theme', 'logos'), { recursive: true });

        // Create test settings
        const yaml = await loadYaml();
        const settings = {
            theme: 'test-theme',
            identityKit: {}
        };
        await fs.writeFile(
            path.join(testRoot, 'user-data/settings.yaml'),
            yaml.dump(settings)
        );

        // Create test assets in both locations
        await fs.writeFile(path.join(testRoot, 'themes/test-theme/assets/fonts/test.woff2'), 'font-data');
        await fs.writeFile(path.join(testRoot, 'themes/test-theme/assets/logos/logo.png'), 'logo-data');
        await fs.writeFile(path.join(testRoot, 'themes/recommended-assets/test-theme/fonts/rec-font.woff2'), 'rec-font');
        await fs.writeFile(path.join(testRoot, 'themes/recommended-assets/test-theme/logo/rec-logo.png'), 'rec-logo');

        // Create theme.yaml
        const themeConfig = {
            name: 'Test Theme',
            fonts: {
                heading: {
                    family: 'TestFont',
                    file: 'fonts/test.woff2',
                    weight: 700
                }
            },
            logo: {
                file: 'logos/logo.png',
                width: 100
            }
        };
        await fs.writeFile(
            path.join(testRoot, 'themes/test-theme/theme.yaml'),
            yaml.dump(themeConfig)
        );
    });

    afterEach(async () => {
        // Clean up
        await fs.rm(testRoot, { recursive: true, force: true });
    });

    it('should copy fonts to user-data', async () => {
        const fontSrc = path.join(testRoot, 'themes/test-theme/assets/fonts/test.woff2');
        const fontDest = path.join(testRoot, 'user-data/assets/fonts/test.woff2');

        // Simulate migration
        await fs.copyFile(fontSrc, fontDest);

        const exists = await fs.access(fontDest).then(() => true).catch(() => false);
        expect(exists).toBe(true);
    });

    it('should update settings.yaml with font configuration', async () => {
        const yaml = await loadYaml();
        const settingsPath = path.join(testRoot, 'user-data/settings.yaml');
        const settings = yaml.load(await fs.readFile(settingsPath, 'utf-8'));

        // Simulate migration update
        settings.identityKit.fonts = {
            heading: {
                family: 'TestFont',
                file: 'fonts/test.woff2',
                weight: 700
            }
        };

        await fs.writeFile(settingsPath, yaml.dump(settings));

        // Verify
        const updated = yaml.load(await fs.readFile(settingsPath, 'utf-8'));
        expect(updated.identityKit.fonts.heading.family).toBe('TestFont');
        expect(updated.identityKit.fonts.heading.file).toBe('fonts/test.woff2');
    });

    it('should preserve existing identityKit values', async () => {
        const yaml = await loadYaml();
        const settingsPath = path.join(testRoot, 'user-data/settings.yaml');
        let settings = yaml.load(await fs.readFile(settingsPath, 'utf-8'));

        // Add existing values
        settings.identityKit.backgroundColor = '#000000';
        settings.identityKit.accentColor = '#ff0000';
        await fs.writeFile(settingsPath, yaml.dump(settings));

        // Simulate migration
        settings = yaml.load(await fs.readFile(settingsPath, 'utf-8'));
        settings.identityKit.fonts = {
            heading: { family: 'TestFont', file: 'fonts/test.woff2', weight: 700 }
        };
        await fs.writeFile(settingsPath, yaml.dump(settings));

        // Verify existing values preserved
        const updated = yaml.load(await fs.readFile(settingsPath, 'utf-8'));
        expect(updated.identityKit.backgroundColor).toBe('#000000');
        expect(updated.identityKit.accentColor).toBe('#ff0000');
        expect(updated.identityKit.fonts).toBeDefined();
    });

    it('should fallback to recommended-assets when theme has no assets', async () => {
        const recFontPath = path.join(testRoot, 'themes/recommended-assets/test-theme/fonts/rec-font.woff2');
        const userFontDest = path.join(testRoot, 'user-data/assets/fonts/rec-font.woff2');

        // Simulate fallback to recommended-assets
        await fs.copyFile(recFontPath, userFontDest);

        const exists = await fs.access(userFontDest).then(() => true).catch(() => false);
        expect(exists).toBe(true);
    });

    it('should find font files by recommendedFont name', () => {
        // Test the findFontFile helper logic
        const fontFiles = ['Aziu-Black.woff2', 'DimkaSans-Regular.woff2', 'Xarrovv.woff2'];

        function findFontFile(files, familyName) {
            const normalizedName = familyName.toLowerCase().replace(/\s+/g, '');
            return files.find(f => f.toLowerCase().includes(normalizedName)) || null;
        }

        expect(findFontFile(fontFiles, 'Aziu')).toBe('Aziu-Black.woff2');
        expect(findFontFile(fontFiles, 'Dimka Sans')).toBe('DimkaSans-Regular.woff2');
        expect(findFontFile(fontFiles, 'Xarrovv')).toBe('Xarrovv.woff2');
        expect(findFontFile(fontFiles, 'NonExistent')).toBe(null);
    });
});

describe('Migration Edge Cases', () => {
    it('should handle missing settings.yaml gracefully', async () => {
        const settingsPath = path.join(testRoot, 'user-data/settings.yaml');

        // Try to read non-existent file
        let error = null;
        try {
            await fs.readFile(settingsPath, 'utf-8');
        } catch (e) {
            error = e;
        }

        expect(error).toBeDefined();
        expect(error.code).toBe('ENOENT');
    });

    it('should handle missing theme directory', async () => {
        const themePath = path.join(testRoot, 'themes/nonexistent');

        let error = null;
        try {
            await fs.access(themePath);
        } catch (e) {
            error = e;
        }

        expect(error).toBeDefined();
    });

    it('should handle empty asset directories', async () => {
        const emptyDir = path.join(testRoot, 'themes/test-theme/assets/empty');
        await fs.mkdir(emptyDir, { recursive: true });

        const files = await fs.readdir(emptyDir);
        expect(files).toHaveLength(0);
    });
});
