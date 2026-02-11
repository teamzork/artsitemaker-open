/**
 * Configuration Paths Utility Library
 *
 * Centralized path resolution for configuration files (settings, secrets, deployment).
 * All functions check preview context first before falling back to default paths.
 */

import fs from 'fs';
import path from 'path';
import { getContentPath, getSiteProjectPath } from './paths';

function getPreviewContentPath(): string | null {
  const preview = (globalThis as any).__ARTSITEMAKER_PREVIEW__;
  if (!preview) return null;
  if (preview.mode === 'demo') return null;
  return preview.contentPath || null;
}

/**
 * Get the settings path with preview context support.
 *
 * Resolution priority:
 * 1. Preview context (globalThis.__ARTSITEMAKER_PREVIEW__.contentPath) - for admin previews
 * 2. Default content path from paths.ts
 *
 * @returns Absolute path to the settings directory (content/settings)
 */
export function getSettingsPath(): string {
  const previewContentPath = getPreviewContentPath();
  const contentPath = previewContentPath || getContentPath();
  return path.join(contentPath, 'settings');
}

/**
 * Get the main settings.yaml file path with preview context support.
 *
 * @returns Absolute path to settings/settings.yaml (or legacy settings.yaml if present)
 */
export function getSettingsFilePath(): string {
  const previewContentPath = getPreviewContentPath();
  const contentPath = previewContentPath || getContentPath();
  const newPath = path.join(contentPath, 'settings', 'settings.yaml');
  const legacyPath = path.join(contentPath, 'settings.yaml');

  if (fs.existsSync(newPath)) return newPath;
  if (fs.existsSync(legacyPath)) return legacyPath;

  return newPath;
}

/**
 * Get the configuration path with preview context support.
 *
 * Configuration files are stored in content/configuration/ directory and contain
 * system-level settings (project config, image hosting, secrets).
 *
 * @returns Absolute path to the configuration directory (content/configuration)
 */
export function getConfigurationPath(): string {
  const previewContentPath = getPreviewContentPath();
  const contentPath = previewContentPath || getContentPath();
  return path.join(contentPath, 'configuration');
}

/**
 * Get the project configuration file path.
 *
 * @returns Absolute path to configuration/project-configuration.yaml
 */
export function getProjectConfigPath(): string {
  return path.join(getConfigurationPath(), 'project-configuration.yaml');
}

/**
 * Get the image hosting configuration file path.
 *
 * @returns Absolute path to configuration/image-hosting.yaml
 */
export function getImageHostingConfigPath(): string {
  return path.join(getConfigurationPath(), 'image-hosting.yaml');
}

/**
 * Get the secrets configuration path with preview context support.
 *
 * Secrets are stored in content/configuration/ directory and contain encrypted
 * credential data managed by the secrets vault.
 *
 * @returns Absolute path to the configuration directory (content/configuration)
 */
export function getSecretsPath(): string {
  return getConfigurationPath();
}

/**
 * Get the encrypted secrets vault file path.
 *
 * @returns Absolute path to configuration/secrets.yaml.enc
 */
export function getSecretsVaultPath(): string {
  return path.join(getConfigurationPath(), 'secrets.yaml.enc');
}

/**
 * Get the deployment configuration path with preview context support.
 *
 * Deployment config is stored in content/configuration/project-configuration.yaml
 * under the deploy section.
 *
 * @returns Absolute path to the project config file (content/configuration/project-configuration.yaml)
 */
export function getDeploymentConfigPath(): string {
  return getProjectConfigPath();
}

/**
 * Get the pages configuration path with preview context support.
 *
 * @returns Absolute path to the pages config file (content/settings/pages.yaml)
 */
export function getPagesConfigPath(): string {
  return path.join(getSettingsPath(), 'pages.yaml');
}

/**
 * Get the identity kit configuration path with preview context support.
 *
 * @returns Absolute path to the identity config file (content/settings/identity.yaml)
 */
export function getIdentityConfigPath(): string {
  return path.join(getSettingsPath(), 'identity.yaml');
}

/**
 * Get the theme configuration path with preview context support.
 *
 * @returns Absolute path to the theme config file (content/settings/theme.yaml)
 */
export function getThemeConfigPath(): string {
  return path.join(getSettingsPath(), 'theme.yaml');
}

/**
 * Get the footer configuration path with preview context support.
 *
 * @returns Absolute path to the footer config file (content/pages/components/footer.yaml)
 */
export function getFooterPath(): string {
  const previewContentPath = getPreviewContentPath();
  const contentPath = previewContentPath || getContentPath();
  return path.join(contentPath, 'pages', 'components', 'footer.yaml');
}
