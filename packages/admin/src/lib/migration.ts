/**
 * Legacy Settings Migration
 *
 * Auto-migrates old settings.yaml structure to the new modular format
 * where settings are split across content/settings/ directory.
 *
 * Legacy structure (pre-Phase 3):
 *   content/settings.yaml contains: pages, identityKit, theme sections
 *
 * New structure (Phase 3+):
 *   content/settings.yaml (site, seo, images, git, deploy, etc.)
 *   content/settings/pages.yaml (enabled, homePage, linking)
 *   content/settings/identity.yaml (identityKit section)
 *   content/settings/theme.yaml (theme name)
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getContentPath } from './paths';
import { getSettingsPath, getSettingsFilePath, getPagesConfigPath, getIdentityConfigPath, getThemeConfigPath } from './config-paths';

/**
 * Detect if the content directory uses legacy settings structure.
 *
 * Returns true if:
 * - content/settings.yaml exists
 * - content/settings/ directory does NOT exist
 *
 * @returns true if legacy structure is detected
 */
export function detectLegacyStructure(): boolean {
  const settingsFile = getSettingsFilePath();
  const settingsDir = getSettingsPath();

  const hasSettingsFile = fs.existsSync(settingsFile);
  const hasSettingsDir = fs.existsSync(settingsDir);

  return hasSettingsFile && !hasSettingsDir;
}

/**
 * Legacy settings structure (sections we extract)
 */
interface LegacySettings {
  pages?: {
    enabled?: Record<string, boolean>;
    homePage?: string;
    linking?: {
      galleryClick?: string;
      collectionClick?: string;
      artPieceBack?: string;
      searchResultClick?: string;
    };
  };
  identityKit?: {
    backgroundColor?: string;
    accentColor?: string;
    textColor?: string;
    invertedTextColor?: string;
    linkColor?: string;
    fonts?: {
      heading?: string;
      body?: string;
    };
    logo?: {
      file?: string;
      width?: number;
    };
    background?: {
      texture?: string;
      textureMode?: string;
    };
  };
  theme?: string;
  [key: string]: unknown;
}

/**
 * Migrate legacy settings.yaml to new modular structure.
 *
 * Extracts the following sections from settings.yaml into separate files:
 * - pages → content/settings/pages.yaml
 * - identityKit → content/settings/identity.yaml
 * - theme → content/settings/theme.yaml
 *
 * The original settings.yaml is modified to remove the migrated sections.
 *
 * @returns Object with migration status and any errors
 */
export function migrateSettings(): { success: boolean; errors: string[]; migrated: string[] } {
  const errors: string[] = [];
  const migrated: string[] = [];

  const settingsFile = getSettingsFilePath();
  const settingsDir = getSettingsPath();

  // Read the legacy settings.yaml
  let settings: LegacySettings;
  try {
    const content = fs.readFileSync(settingsFile, 'utf-8');
    settings = yaml.load(content) as LegacySettings;
  } catch (error) {
    errors.push(`Failed to read settings.yaml: ${error}`);
    return { success: false, errors, migrated };
  }

  // Create the settings directory
  try {
    fs.mkdirSync(settingsDir, { recursive: true });
    console.log(`[Migration] Created directory: ${settingsDir}`);
  } catch (error) {
    errors.push(`Failed to create settings directory: ${error}`);
    return { success: false, errors, migrated };
  }

  // Migrate pages section
  if (settings.pages) {
    const pagesConfig = {
      enabled: settings.pages.enabled || {},
      homePage: settings.pages.homePage || 'gallery',
      linking: settings.pages.linking || {},
    };

    try {
      const pagesPath = getPagesConfigPath();
      const pagesYaml = `# Page Configuration
# Controls which pages are enabled and how they link to each other

# Which pages are enabled for this site
enabled:
${Object.entries(pagesConfig.enabled).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

# Which page serves as the home page (when home is disabled)
homePage: ${pagesConfig.homePage}

# How pages link to each other
# These settings control navigation behavior throughout the site
linking:
${Object.entries(pagesConfig.linking).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`;

      fs.writeFileSync(pagesPath, pagesYaml, 'utf-8');
      console.log(`[Migration] Created: ${pagesPath}`);
      migrated.push('pages');
      delete settings.pages;
    } catch (error) {
      errors.push(`Failed to migrate pages section: ${error}`);
    }
  }

  // Migrate identityKit section
  if (settings.identityKit) {
    try {
      const identityPath = getIdentityConfigPath();
      const identityYaml = yaml.dump({ identityKit: settings.identityKit }, { indent: 2, lineWidth: -1 });

      fs.writeFileSync(identityPath, `# Identity Kit Configuration
# Brand colors, fonts, and logo settings

${identityYaml}`, 'utf-8');
      console.log(`[Migration] Created: ${identityPath}`);
      migrated.push('identityKit');
      delete settings.identityKit;
    } catch (error) {
      errors.push(`Failed to migrate identityKit section: ${error}`);
    }
  }

  // Migrate theme section
  if (settings.theme) {
    try {
      const themePath = getThemeConfigPath();
      fs.writeFileSync(themePath, `# Theme Configuration
# Active theme name

theme: ${settings.theme}
`, 'utf-8');
      console.log(`[Migration] Created: ${themePath}`);
      migrated.push('theme');
      delete settings.theme;
    } catch (error) {
      errors.push(`Failed to migrate theme section: ${error}`);
    }
  }

  // Update the original settings.yaml (remove migrated sections)
  if (migrated.length > 0) {
    try {
      const updatedYaml = yaml.dump(settings, { indent: 2, lineWidth: -1 });
      fs.writeFileSync(settingsFile, updatedYaml, 'utf-8');
      console.log(`[Migration] Updated settings.yaml (removed migrated sections)`);
    } catch (error) {
      errors.push(`Failed to update settings.yaml: ${error}`);
    }
  }

  const success = errors.length === 0 && migrated.length > 0;
  if (success) {
    console.log(`[Migration] Successfully migrated ${migrated.length} section(s): ${migrated.join(', ')}`);
  }

  return { success, errors, migrated };
}

/**
 * Run auto-migration if legacy structure is detected.
 *
 * This function should be called during admin startup to automatically
 * migrate old settings structure to the new modular format.
 *
 * @returns true if migration was performed, false if not needed or failed
 */
export function runAutoMigration(): boolean {
  if (!detectLegacyStructure()) {
    return false;
  }

  console.log('[Migration] Legacy settings structure detected, starting auto-migration...');

  const result = migrateSettings();

  if (!result.success) {
    console.error('[Migration] Auto-migration failed:', result.errors);
    return false;
  }

  console.log('[Migration] Auto-migration completed successfully');
  return true;
}
