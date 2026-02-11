import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getProjectConfigPath } from './config-paths';
import { getRepoPath } from './paths';

type DeployConfig = Record<string, any>;
type ProjectConfig = Record<string, any>;

async function readYamlFile(filePath: string): Promise<ProjectConfig | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return (yaml.load(content) as ProjectConfig) || {};
  } catch {
    return null;
  }
}

function getLegacyConfigPath(): string {
  const repoRoot = getRepoPath();
  return path.join(repoRoot ?? process.cwd(), 'artis.config.yaml');
}

export async function readProjectConfig(): Promise<ProjectConfig> {
  return (await readYamlFile(getProjectConfigPath())) ?? {};
}

export async function readLegacyDeploymentConfig(): Promise<DeployConfig | null> {
  const legacy = await readYamlFile(getLegacyConfigPath());
  return (legacy?.deployment as DeployConfig) ?? null;
}

export function mergeDeployConfig(
  projectDeploy?: DeployConfig,
  legacyDeploy?: DeployConfig,
): DeployConfig {
  if (!projectDeploy && !legacyDeploy) return {};

  const merged: DeployConfig = {
    ...(legacyDeploy || {}),
    ...(projectDeploy || {}),
  };

  const legacyCloudflare = legacyDeploy?.cloudflarePages as DeployConfig | undefined;
  const projectCloudflare = projectDeploy?.cloudflarePages as DeployConfig | undefined;
  if (legacyCloudflare || projectCloudflare) {
    const mergedCloudflare: DeployConfig = {
      ...(legacyCloudflare || {}),
      ...(projectCloudflare || {}),
    };

    if (legacyCloudflare?.customDomain || projectCloudflare?.customDomain) {
      mergedCloudflare.customDomain = {
        ...(legacyCloudflare?.customDomain || {}),
        ...(projectCloudflare?.customDomain || {}),
      };
    }

    merged.cloudflarePages = mergedCloudflare;
  }

  return merged;
}
