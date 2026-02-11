/**
 * custom-domain.ts
 *
 * POST /api/deployment/custom-domain
 * Actions: configure | verify | remove
 * Only calls Cloudflare API when hosting target is Cloudflare Pages.
 */

import type { APIRoute } from 'astro';
import path from 'path';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import { clearConfigCache } from '../../../lib/paths';
import { getProjectConfigPath } from '../../../lib/config-paths';
import {
  mergeDeployConfig,
  readLegacyDeploymentConfig,
  readProjectConfig,
} from '../../../lib/deployment-config';
import {
  isSessionValid,
  loadEncryptedSecrets,
  decryptWithSession,
  getSecretsValidationMessage,
} from '../../../lib/secrets';
import { CloudflareAPI } from '../../../lib/cloudflare-api';
import {
  getApexDomain,
  isApexDomain,
  isValidDomainFormat,
  isWwwSubdomain,
  normalizeHostname,
} from '../../../lib/domain-utils';

async function writeProjectConfig(config: Record<string, unknown>) {
  const configPath = getProjectConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(
    configPath,
    yaml.dump(config, { lineWidth: -1, quotingType: '"' as const }),
    'utf-8',
  );
  clearConfigCache();
}

function getCustomDomainFromConfig(
  config: Record<string, unknown>,
  legacyDeployment?: Record<string, unknown> | null,
) {
  const deploy = mergeDeployConfig(
    config.deploy as Record<string, unknown> | undefined,
    legacyDeployment || undefined,
  );
  const cp = deploy?.cloudflarePages as Record<string, unknown> | undefined;
  const cd = cp?.customDomain as Record<string, unknown> | undefined;
  return {
    projectName: (cp?.projectName as string) || '',
    customDomain: cd,
    fullDeployment: deploy,
  };
}

function jsonResponse(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as {
      action: 'configure' | 'verify' | 'remove';
      domain?: string;
      addWww?: boolean;
      hostingTarget?: 'cloudflare_pages' | 'elsewhere';
      enabled?: boolean;
    };

    const action = body.action;
    if (!action || !['configure', 'verify', 'remove'].includes(action)) {
      return jsonResponse({ success: false, error: 'Invalid action' }, 400);
    }

    const config = await readProjectConfig();
    const legacyDeployment = await readLegacyDeploymentConfig();
    const { projectName, customDomain, fullDeployment } = getCustomDomainFromConfig(
      config,
      legacyDeployment,
    );

    const domain = (body.domain ?? (customDomain as Record<string, unknown>)?.domain ?? '').toString().trim();
    const normalizedDomain = normalizeHostname(domain);
    const hostingTarget = (body.hostingTarget ?? (customDomain as Record<string, unknown>)?.hostingTarget ?? 'cloudflare_pages') as string;
    const addWww = !!body.addWww;
    const enabled = body.enabled ?? (customDomain as Record<string, unknown>)?.enabled;

    if (action !== 'remove' && !domain) {
      return jsonResponse({ success: false, error: 'Domain is required' }, 400);
    }

    if (!isValidDomainFormat(domain) && action !== 'remove') {
      return jsonResponse({ success: false, error: 'Invalid domain format' }, 400);
    }

    const now = new Date().toISOString();
    const isAlreadyAddedError = (message: string) =>
      /already\s+added/i.test(message);
    const updateCustomDomain = (updates: Record<string, unknown>) => {
      const deploy = (fullDeployment || {}) as Record<string, unknown>;
      const cp = (deploy.cloudflarePages || {}) as Record<string, unknown>;
      const cd = (cp.customDomain || {}) as Record<string, unknown>;
      return {
        ...config,
        deploy: {
          ...deploy,
          cloudflarePages: {
            ...cp,
            customDomain: { ...cd, ...updates },
          },
        },
      };
    };

    // —— Remove —————————————————————————————————————————————————————————————
    if (action === 'remove') {
      if (hostingTarget !== 'cloudflare_pages' || !projectName || !domain) {
        const merged = updateCustomDomain({
          enabled: false,
          domain: '',
          dns_status: 'not_configured',
          last_checked: now,
          error_message: null,
        });
        await writeProjectConfig(merged);
        return jsonResponse({ success: true, message: 'Custom domain removed' });
      }

      if (!isSessionValid()) {
        return jsonResponse(
          { success: false, error: getSecretsValidationMessage('vault_locked'), requiresUnlock: true },
          401
        );
      }

      const encrypted = await loadEncryptedSecrets();
      if (!encrypted) {
        return jsonResponse({ success: false, error: getSecretsValidationMessage('vault_not_found') }, 400);
      }
      const secrets = decryptWithSession(encrypted) as { cloudflare?: { account_id?: string; api_token?: string } };
      if (!secrets?.cloudflare?.account_id || !secrets.cloudflare.api_token) {
        return jsonResponse({ success: false, error: getSecretsValidationMessage('cloudflare_token_missing') }, 400);
      }

      const api = new CloudflareAPI(secrets.cloudflare as { account_id: string; api_token: string });
      const removeResult = await api.removeCustomDomain(projectName, domain);
      if (!removeResult.success) {
        return jsonResponse({ success: false, error: removeResult.error }, 400);
      }

      const merged = updateCustomDomain({
        enabled: false,
        domain: '',
        dns_status: 'not_configured',
        last_checked: now,
        error_message: null,
      });
      await writeProjectConfig(merged);
      return jsonResponse({ success: true, message: 'Custom domain removed' });
    }

    // —— Verify (only for Cloudflare Pages) —————————————————————————————————
    if (action === 'verify') {
      if (hostingTarget !== 'cloudflare_pages') {
        return jsonResponse({
          success: true,
          status: 'not_configured',
          message: 'Domain is for hosting elsewhere; no verification needed.',
        });
      }

      if (!isSessionValid()) {
        return jsonResponse(
          { success: false, error: getSecretsValidationMessage('vault_locked'), requiresUnlock: true },
          401
        );
      }

      if (!projectName) {
        return jsonResponse({ success: false, error: 'Project name is required. Save Cloudflare Pages settings first.' }, 400);
      }

      const encrypted = await loadEncryptedSecrets();
      if (!encrypted) {
        return jsonResponse({ success: false, error: getSecretsValidationMessage('vault_not_found') }, 400);
      }
      const secrets = decryptWithSession(encrypted) as { cloudflare?: { account_id?: string; api_token?: string } };
      if (!secrets?.cloudflare?.account_id || !secrets.cloudflare.api_token) {
        return jsonResponse({ success: false, error: getSecretsValidationMessage('cloudflare_token_missing') }, 400);
      }

      const api = new CloudflareAPI(secrets.cloudflare as { account_id: string; api_token: string });
      const statusResult = await api.getDomainStatus(projectName, domain);

      const merged = updateCustomDomain({
        enabled: enabled !== false,
        domain,
        hostingTarget,
        addWww: !!addWww,
        dns_status: statusResult.status === 'active' ? 'active' : statusResult.status === 'pending' ? 'pending' : 'error',
        last_checked: now,
        error_message: statusResult.status === 'error' ? statusResult.message : null,
      });
      await writeProjectConfig(merged);

      return jsonResponse({
        success: true,
        status: statusResult.status,
        message: statusResult.message,
      });
    }

    // —— Configure —————————————————————————————————————————————————────────—
    if (action === 'configure') {
      if (hostingTarget !== 'cloudflare_pages') {
        const merged = updateCustomDomain({
          enabled: !!enabled,
          domain,
          addWww: !!addWww,
          hostingTarget: 'elsewhere',
          dns_status: 'not_configured',
          last_checked: now,
          error_message: null,
        });
        await writeProjectConfig(merged);
        return jsonResponse({
          success: true,
          message: 'Domain saved for hosting elsewhere. Add the CNAME/ALIAS record at your host.',
        });
      }

      if (!isSessionValid()) {
        return jsonResponse(
          { success: false, error: getSecretsValidationMessage('vault_locked'), requiresUnlock: true },
          401
        );
      }

      if (!projectName) {
        return jsonResponse({ success: false, error: 'Project name is required. Save Cloudflare Pages settings first.' }, 400);
      }

      const encrypted = await loadEncryptedSecrets();
      if (!encrypted) {
        return jsonResponse({ success: false, error: getSecretsValidationMessage('vault_not_found') }, 400);
      }
      const secrets = decryptWithSession(encrypted) as { cloudflare?: { account_id?: string; api_token?: string } };
      if (!secrets?.cloudflare?.account_id || !secrets.cloudflare.api_token) {
        return jsonResponse({ success: false, error: getSecretsValidationMessage('cloudflare_token_missing') }, 400);
      }

      const api = new CloudflareAPI(secrets.cloudflare as { account_id: string; api_token: string });

      const zoneId = await api.getZoneId(normalizedDomain || domain);
      if (!zoneId) {
        return jsonResponse({ success: false, error: 'Domain not found in your Cloudflare account. Add the site in Cloudflare first.' }, 400);
      }

      const domainsToAdd = [normalizedDomain || domain];
      const apex = getApexDomain(normalizedDomain || domain);
      const isApex = isApexDomain(normalizedDomain) || isWwwSubdomain(normalizedDomain);
      if (addWww && isApex && !(normalizedDomain || domain).startsWith('www.')) {
        domainsToAdd.push(`www.${apex}`);
      }

      const configureResult = await api.configureCustomDomain(projectName, domainsToAdd);

      if (!configureResult.success) {
        const errors = configureResult.errors ?? [];
        const alreadyAdded = errors.length > 0 && errors.every(isAlreadyAddedError);
        if (alreadyAdded) {
          const merged = updateCustomDomain({
            enabled: true,
            domain,
            addWww: !!addWww,
            hostingTarget: 'cloudflare_pages',
            dns_status: 'pending',
            last_checked: now,
            error_message: null,
          });
          await writeProjectConfig(merged);
          return jsonResponse({
            success: true,
            message: 'Domain already added — verifying DNS…',
            dns_records: configureResult.dns_records,
          });
        }

        const merged = updateCustomDomain({
          enabled: !!enabled,
          domain,
          addWww: !!addWww,
          hostingTarget: 'cloudflare_pages',
          dns_status: 'error',
          last_checked: now,
          error_message: configureResult.errors?.join(' ') || 'Configuration failed',
        });
        await writeProjectConfig(merged);
        return jsonResponse({
          success: false,
          error: configureResult.errors?.join(' ') || 'Failed to add domain',
        }, 400);
      }

      const merged = updateCustomDomain({
        enabled: true,
        domain,
        addWww: !!addWww,
        hostingTarget: 'cloudflare_pages',
        dns_status: 'pending',
        last_checked: now,
        error_message: null,
      });
      await writeProjectConfig(merged);

      return jsonResponse({
        success: true,
        message: 'Custom domain(s) added. DNS may take up to 24 hours to propagate.',
        dns_records: configureResult.dns_records,
      });
    }

    return jsonResponse({ success: false, error: 'Invalid action' }, 400);
  } catch (err) {
    console.error('Custom domain API error:', err);
    return jsonResponse(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      500
    );
  }
};
