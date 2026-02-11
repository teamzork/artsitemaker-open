/**
 * Cloudflare Credentials Test API
 *
 * POST /api/cloudflare/test
 * Tests the Cloudflare API credentials with provided or stored secrets.
 */

import type { APIRoute } from 'astro';
import { loadEncryptedSecrets, decryptWithSession } from '../../../lib/secrets';

interface CloudflareTestRequest {
    accountId?: string;
    apiToken?: string;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = (await request.json()) as CloudflareTestRequest;

        let accountId = body.accountId?.trim() || '';
        let apiToken = body.apiToken?.trim() || '';

        if (!accountId || !apiToken) {
            const encrypted = await loadEncryptedSecrets();
            if (encrypted) {
                const secrets = decryptWithSession(encrypted);
                if (secrets?.cloudflare) {
                    accountId = accountId || secrets.cloudflare.account_id || '';
                    apiToken = apiToken || secrets.cloudflare.api_token || '';
                }
            }
        }

        if (!accountId || !apiToken) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing Cloudflare credentials',
                missingFields: [
                    !accountId && 'accountId',
                    !apiToken && 'apiToken',
                ].filter(Boolean),
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        const data = await res.json();
        if (!res.ok || !data?.success) {
            const errorMessage =
                data?.errors?.[0]?.message ||
                data?.error ||
                `Cloudflare API error (HTTP ${res.status})`;

            return new Response(JSON.stringify({
                success: false,
                error: errorMessage,
            }), {
                status: res.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            accountName: data?.result?.name || null,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
