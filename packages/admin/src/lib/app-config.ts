import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

interface AppProjectMetaData {
  displayName?: string;
  shortDescription?: string;
}

interface AppConfig {
  projectMetaData?: AppProjectMetaData;
}

const DEFAULT_APP_META: Required<AppProjectMetaData> = {
  displayName: 'ArtSiteMaker Admin',
  shortDescription: 'Content Management',
};

let cachedConfig: AppConfig | null = null;
let cachedConfigMtime = 0;

function getAppConfigPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const adminRoot = path.resolve(currentDir, '../..');
  return path.join(adminRoot, 'app-config.yaml');
}

function loadAppConfig(): AppConfig {
  const configPath = getAppConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      const stats = fs.statSync(configPath);
      if (cachedConfig && cachedConfigMtime === stats.mtimeMs) {
        return cachedConfig;
      }

      const content = fs.readFileSync(configPath, 'utf-8');
      cachedConfig = yaml.load(content) as AppConfig;
      cachedConfigMtime = stats.mtimeMs;
      return cachedConfig || {};
    }
  } catch (error) {
    console.warn('Failed to load app-config.yaml:', error);
  }

  cachedConfig = {};
  cachedConfigMtime = 0;
  return cachedConfig;
}

export function getAppMeta() {
  const config = loadAppConfig();
  const meta = config.projectMetaData || {};
  return {
    displayName: meta.displayName || DEFAULT_APP_META.displayName,
    shortDescription: meta.shortDescription || DEFAULT_APP_META.shortDescription,
  };
}

export function getAppDisplayName(): string {
  return getAppMeta().displayName;
}

export function getAppShortDescription(): string {
  return getAppMeta().shortDescription;
}
