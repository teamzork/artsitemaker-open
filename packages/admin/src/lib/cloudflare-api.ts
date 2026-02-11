/**
 * cloudflare-api.ts
 *
 * Cloudflare API client for Pages custom domains and zone/DNS operations.
 * Used when custom domain hosting target is Cloudflare Pages.
 */

import { getApexDomain } from './domain-utils';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export interface CloudflareAPICredentials {
  account_id: string;
  api_token: string;
}

export interface DNSRecord {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
}

export interface ConfigureDomainResult {
  success: boolean;
  dns_records?: DNSRecord[];
  errors?: string[];
  status?: string;
}

export interface DNSStatusResult {
  status: 'pending' | 'active' | 'error' | 'initializing';
  message: string;
  validation_data?: Record<string, unknown>;
}


export class CloudflareAPI {
  private accountId: string;
  private apiToken: string;

  constructor(credentials: CloudflareAPICredentials) {
    this.accountId = credentials.account_id?.trim() || '';
    this.apiToken = credentials.api_token?.trim() || '';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ success: boolean; result?: T; errors?: Array<{ code?: number; message?: string }> }> {
    const url = path.startsWith('http') ? path : `${CF_API_BASE}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json()) as {
      success?: boolean;
      result?: T;
      errors?: Array<{ code?: number; message?: string }>;
    };
    return {
      success: res.ok && !!data.success,
      result: data.result,
      errors: data.errors,
    };
  }

  /**
   * Get Cloudflare zone ID for the domain. Uses apex domain for lookup.
   */
  async getZoneId(domain: string): Promise<string | null> {
    const apex = getApexDomain(domain);
    const { success, result } = await this.request<Array<{ id: string; name: string }>>(
      'GET',
      `/zones?name=${encodeURIComponent(apex)}`
    );
    if (!success || !result?.length) return null;
    return result[0].id ?? null;
  }

  /**
   * Add custom domain(s) to a Cloudflare Pages project.
   * Caller can pass primary + www when addWww is true.
   */
  async configureCustomDomain(
    projectName: string,
    domains: string[]
  ): Promise<ConfigureDomainResult> {
    const errors: string[] = [];
    const dnsRecords: DNSRecord[] = [];

    for (const name of domains) {
      const normalized = name.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
      if (!normalized) continue;

      const { success, result, errors: errs } = await this.request<{
        name?: string;
        status?: string;
        validation_data?: { txt_name?: string; txt_value?: string };
      }>(
        'POST',
        `/accounts/${this.accountId}/pages/projects/${encodeURIComponent(projectName)}/domains`,
        { name: normalized }
      );

      if (!success) {
        const msg = errs?.[0]?.message || `Failed to add domain ${normalized}`;
        errors.push(msg);
        continue;
      }

      if (result?.validation_data?.txt_name && result.validation_data.txt_value) {
        dnsRecords.push({
          type: 'TXT',
          name: (result.validation_data.txt_name as string) || '',
          content: (result.validation_data.txt_value as string) || '',
        });
      }
    }

    return {
      success: errors.length === 0,
      dns_records: dnsRecords.length ? dnsRecords : undefined,
      errors: errors.length ? errors : undefined,
    };
  }

  /**
   * Get current status of a custom domain on the Pages project.
   */
  async getDomainStatus(projectName: string, domainName: string): Promise<DNSStatusResult> {
    const normalized = domainName.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
    const { success, result } = await this.request<{
      status?: string;
      verification_data?: { status?: string; error_message?: string };
      validation_data?: { status?: string; error_message?: string };
    }>(
      'GET',
      `/accounts/${this.accountId}/pages/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(normalized)}`
    );

    if (!success || !result) {
      return { status: 'error', message: 'Domain not found or API error' };
    }

    const status = (result.status || result.verification_data?.status || result.validation_data?.status || 'unknown').toLowerCase();
    const message =
      (result.verification_data as { error_message?: string })?.error_message ||
      (result.validation_data as { error_message?: string })?.error_message ||
      (status === 'active' ? 'Domain is live' : status === 'initializing' || status === 'pending' ? 'DNS propagation in progress' : 'Unknown status');

    const mappedStatus =
      status === 'active'
        ? 'active'
        : status === 'initializing' || status === 'pending'
          ? 'pending'
          : 'error';

    return {
      status: mappedStatus as 'pending' | 'active' | 'error',
      message,
      validation_data: result.validation_data as Record<string, unknown> | undefined,
    };
  }

  /**
   * Remove a custom domain from the Pages project.
   */
  async removeCustomDomain(projectName: string, domain: string): Promise<{ success: boolean; error?: string }> {
    const normalized = domain.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
    const { success, errors } = await this.request(
      'DELETE',
      `/accounts/${this.accountId}/pages/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(normalized)}`
    );
    if (success) return { success: true };
    return {
      success: false,
      error: errors?.[0]?.message || 'Failed to remove domain',
    };
  }
}
