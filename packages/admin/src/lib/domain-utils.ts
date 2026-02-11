import { getDomain } from 'tldts';

const PSL_OPTIONS = { allowPrivateDomains: true };

export function normalizeHostname(input: string): string {
  if (!input) return '';
  const stripped = input.toLowerCase().trim().replace(/^https?:\/\//, '');
  const withoutPath = stripped.split('/')[0].split('?')[0].split('#')[0];
  const withoutPort = withoutPath.replace(/:\d+$/, '');
  return withoutPort.replace(/\.+$/, '');
}

export function getApexDomain(hostname: string): string {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return '';
  return getDomain(normalized, PSL_OPTIONS) ?? normalized;
}

export function isApexDomain(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  const apex = getDomain(normalized, PSL_OPTIONS);
  return apex !== null && normalized === apex;
}

export function isWwwSubdomain(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  const apex = getApexDomain(normalized);
  return !!apex && normalized === `www.${apex}`;
}

export function isValidDomainFormat(domain: string): boolean {
  const normalized = normalizeHostname(domain);
  if (!normalized || normalized.length > 253) return false;
  const label = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
  return label.test(normalized);
}
