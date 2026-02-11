#!/usr/bin/env node
/**
 * Migrate Theme Assets to User Data
 *
 * Moves fonts, logos, and textures from current theme to user-data/assets/
 * and updates settings.yaml with identityKit configuration.
 *
 * Usage: pnpm migrate:theme-assets
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';



const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

/**
 * Helper function to find a font file by family name
 * @param {string[]} fontFiles - Array of available font files
 * @param {string} familyName - Font family name to match
 * @returns {string|null} - Matching font file or null
 */
function findFontFile(fontFiles, familyName) {
    const normalizedName = familyName.toLowerCase().replace(/\s+/g, '');
    return fontFiles.find(f => f.toLowerCase().includes(normalizedName)) || null;
}

async function migrateThemeAssets() {
    console.log('🔄 Migrating theme assets to user-data...\n');

    const yaml = await import('js-yaml');

    try {
        // 1. Load current settings
        const settingsPath = path.join(projectRoot, 'user-data', 'settings', 'settings.yaml');
        let settings;

        try {
            const settingsContent = await fs.readFile(settingsPath, 'utf-8');
            settings = yaml.load(settingsContent);
        } catch (e) {
            console.error('❌ Could not load user-data/settings/settings.yaml');
            console.error('   Make sure you have a user-data/settings directory with settings.yaml');
            process.exit(1);
        }

        const currentTheme = settings.theme || 'modern';
        console.log(`📌 Current theme: ${currentTheme}\n`);

        // 2. Check if theme has assets (try theme first, then recommended-assets)
        let themeAssetsPath = path.join(projectRoot, 'themes', currentTheme, 'assets');
        let usingRecommendedAssets = false;

        try {
            await fs.access(themeAssetsPath);
        } catch (e) {
            // Try recommended-assets instead
            const recommendedPath = path.join(projectRoot, 'themes', 'recommended-assets', currentTheme);
            try {
                await fs.access(recommendedPath);
                themeAssetsPath = recommendedPath;
                usingRecommendedAssets = true;
                console.log(`ℹ️  Using recommended assets from themes/recommended-assets/${currentTheme}\n`);
            } catch (e2) {
                console.log(`ℹ️  Theme '${currentTheme}' has no assets. Nothing to migrate.`);
                process.exit(0);
            }
        }

        // 3. Create user-data asset directories
        const userAssetsPath = path.join(projectRoot, 'user-data', 'assets');
        await fs.mkdir(path.join(userAssetsPath, 'fonts'), { recursive: true });
        await fs.mkdir(path.join(userAssetsPath, 'logos'), { recursive: true });
        await fs.mkdir(path.join(userAssetsPath, 'textures'), { recursive: true });

        console.log('✓ Created user-data/assets directories\n');

        // 4. Copy fonts
        const themeFontsPath = path.join(themeAssetsPath, 'fonts');
        let copiedFonts = [];

        try {
            const fontFiles = await fs.readdir(themeFontsPath);
            for (const file of fontFiles) {
                if (file.endsWith('.woff2') || file.endsWith('.woff') || file.endsWith('.ttf')) {
                    await fs.copyFile(
                        path.join(themeFontsPath, file),
                        path.join(userAssetsPath, 'fonts', file)
                    );
                    copiedFonts.push(file);
                    console.log(`  ✓ Copied font: ${file}`);
                }
            }
        } catch (e) {
            console.log('  ℹ️  No fonts directory in theme');
        }

        // 5. Copy logos
        const themeLogosPath = path.join(themeAssetsPath, 'logos');
        let copiedLogos = [];

        try {
            const logoFiles = await fs.readdir(themeLogosPath);
            for (const file of logoFiles) {
                if (file.match(/\.(png|jpg|jpeg|svg|webp)$/i)) {
                    await fs.copyFile(
                        path.join(themeLogosPath, file),
                        path.join(userAssetsPath, 'logos', file)
                    );
                    copiedLogos.push(file);
                    console.log(`  ✓ Copied logo: ${file}`);
                }
            }
        } catch (e) {
            console.log('  ℹ️  No logos directory in theme');
        }

        // 6. Copy textures
        const themeTexturesPath = path.join(themeAssetsPath, 'textures');
        let copiedTextures = [];

        try {
            const textureFiles = await fs.readdir(themeTexturesPath);
            for (const file of textureFiles) {
                if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
                    await fs.copyFile(
                        path.join(themeTexturesPath, file),
                        path.join(userAssetsPath, 'textures', file)
                    );
                    copiedTextures.push(file);
                    console.log(`  ✓ Copied texture: ${file}`);
                }
            }
        } catch (e) {
            console.log('  ℹ️  No textures directory in theme');
        }

        console.log('');

        // 7. Load theme.yaml to get default references
        const themeYamlPath = path.join(projectRoot, 'themes', currentTheme, 'theme.yaml');
        let themeConfig;

        try {
            const themeContent = await fs.readFile(themeYamlPath, 'utf-8');
            themeConfig = yaml.load(themeContent);
        } catch (e) {
            console.warn('⚠️  Could not load theme.yaml, skipping automatic configuration');
            themeConfig = {};
        }

        // 8. Update identityKit in settings
        if (!settings.identityKit) {
            settings.identityKit = {};
        }

        // Configure fonts
        if (copiedFonts.length > 0 && themeConfig.fonts) {
            console.log('📝 Configuring fonts in identityKit...');

            // Find heading font - use recommendedFont for name hint if file is null
            const headingFontName = themeConfig.fonts.heading?.recommendedFont ||
                (themeConfig.fonts.heading?.file ?
                    themeConfig.fonts.heading.family : null);
            const headingFontFile = themeConfig.fonts.heading?.file ||
                (themeConfig.fonts.heading?.recommendedFont ?
                    findFontFile(copiedFonts, themeConfig.fonts.heading.recommendedFont) : null);

            if (headingFontFile && headingFontName) {
                const fontFile = path.basename(headingFontFile);
                if (copiedFonts.includes(fontFile)) {
                    settings.identityKit.fonts = settings.identityKit.fonts || {};
                    settings.identityKit.fonts.heading = {
                        family: headingFontName,
                        file: `fonts/${fontFile}`,
                        weight: themeConfig.fonts.heading.weight || 700
                    };
                    console.log(`  ✓ Set heading font: ${headingFontName}`);
                }
            }

            // Find body font - use recommendedFont for name hint if file is null
            const bodyFontName = themeConfig.fonts.body?.recommendedFont ||
                (themeConfig.fonts.body?.file ?
                    themeConfig.fonts.body.family : null);
            const bodyFontFile = themeConfig.fonts.body?.file ||
                (themeConfig.fonts.body?.recommendedFont ?
                    findFontFile(copiedFonts, themeConfig.fonts.body.recommendedFont) : null);

            if (bodyFontFile && bodyFontName) {
                const fontFile = path.basename(bodyFontFile);
                if (copiedFonts.includes(fontFile)) {
                    settings.identityKit.fonts = settings.identityKit.fonts || {};
                    settings.identityKit.fonts.body = {
                        family: bodyFontName,
                        file: `fonts/${fontFile}`,
                        weight: themeConfig.fonts.body.weight || 400
                    };
                    console.log(`  ✓ Set body font: ${bodyFontName}`);
                }
            }
        }

        // Configure logo
        if (copiedLogos.length > 0 && themeConfig.logo?.file) {
            const logoFile = path.basename(themeConfig.logo.file);
            if (copiedLogos.includes(logoFile)) {
                settings.identityKit.logo = {
                    file: `logos/${logoFile}`,
                    width: themeConfig.logo.width || 126
                };
                console.log(`  ✓ Set logo: ${logoFile}`);
            }
        }

        // Configure background texture
        if (copiedTextures.length > 0 && themeConfig.background?.texture) {
            const textureFile = path.basename(themeConfig.background.texture);
            if (copiedTextures.includes(textureFile)) {
                settings.identityKit.background = {
                    texture: `textures/${textureFile}`,
                    textureMode: themeConfig.background.textureMode || 'tile'
                };
                console.log(`  ✓ Set background texture: ${textureFile}`);
            }
        }

        // 9. Save updated settings
        const updatedSettings = yaml.dump(settings, {
            indent: 2,
            lineWidth: -1,
            noRefs: true
        });

        await fs.writeFile(settingsPath, updatedSettings, 'utf-8');
        console.log('\n✓ Updated user-data/settings.yaml with identityKit configuration');

        // 10. Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration Complete!');
        console.log('='.repeat(60));
        console.log(`\nMigrated from: ${usingRecommendedAssets ? 'recommended-assets/' : 'theme/'}${currentTheme}`);
        console.log(`  Fonts:    ${copiedFonts.length} files`);
        console.log(`  Logos:    ${copiedLogos.length} files`);
        console.log(`  Textures: ${copiedTextures.length} files`);
        console.log('\nNext steps:');
        console.log('  1. Review user-data/settings.yaml identityKit section');
        console.log('  2. Run: pnpm dev');
        console.log('  3. Verify your site looks correct');
        console.log('  4. You can now switch themes without losing your branding!\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

// Run migration
migrateThemeAssets();
