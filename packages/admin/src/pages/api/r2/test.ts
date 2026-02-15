/**
 * R2 Connection Test API
 * 
 * POST /api/r2/test
 * Tests the R2 connection with provided or stored credentials from secrets vault.
 */

import type { APIRoute } from 'astro';
import { getR2BucketName, getR2PublicUrl } from '../../../lib/paths';
import { loadEncryptedSecrets, decryptWithSession } from '../../../lib/secrets';

interface R2TestRequest {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json() as Partial<R2TestRequest>;

        // Load credentials from secrets vault
        let accountId = body.accountId;
        let accessKeyId = body.accessKeyId;
        let secretAccessKey = body.secretAccessKey;

        // If not provided in request, try to load from secrets vault
        if (!accountId || !accessKeyId || !secretAccessKey) {
            const encrypted = await loadEncryptedSecrets();
            if (encrypted) {
                const secrets = decryptWithSession(encrypted);
                if (secrets?.r2) {
                    accountId = accountId || secrets.r2.account_id;
                    accessKeyId = accessKeyId || secrets.r2.access_key_id;
                    secretAccessKey = secretAccessKey || secrets.r2.secret_access_key;
                }
            }
        }

        const bucketName = body.bucketName ?? getR2BucketName();
        const publicUrl = body.publicUrl ?? getR2PublicUrl();

        if (!accountId || !bucketName || !publicUrl) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing required fields',
                missingFields: [
                    !accountId && 'accountId',
                    !bucketName && 'bucketName',
                    !publicUrl && 'publicUrl'
                ].filter(Boolean)
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Test the public URL (the actual CDN endpoint that serves images).
        // The S3 API endpoint (accountId.r2.cloudflarestorage.com) requires
        // AWS4-HMAC-SHA256 signed requests and rejects bare HEAD/GET with
        // a TLS handshake failure, so it's not useful for a simple connectivity check.
        const testUrl = publicUrl;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(testUrl, {
                method: 'HEAD',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Any HTTP response (200, 404, 403, etc.) means the endpoint is reachable
            return new Response(JSON.stringify({
                success: true,
                message: `R2 public endpoint is reachable (HTTP ${response.status})`,
                publicUrl: testUrl,
                bucketName,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (fetchError: any) {
            if (fetchError.name === 'AbortError') {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Connection timed out',
                    publicUrl: testUrl
                }), {
                    status: 504,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to reach R2 endpoint',
                details: fetchError.message,
                publicUrl: testUrl
            }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// GET endpoint to check current R2 configuration status
export const GET: APIRoute = async () => {
    const bucketName = getR2BucketName();
    const publicUrl = getR2PublicUrl();

    // Check if credentials exist in secrets vault
    let hasCredentials = false;
    try {
        const encrypted = await loadEncryptedSecrets();
        if (encrypted) {
            const secrets = decryptWithSession(encrypted);
            hasCredentials = !!(secrets?.r2?.account_id && secrets?.r2?.access_key_id && secrets?.r2?.secret_access_key);
        }
    } catch {
        // Vault locked or not initialized
    }

    const hasConfig = !!(hasCredentials && bucketName);

    return new Response(JSON.stringify({
        configured: hasConfig,
        hasCredentials,
        hasBucketName: !!bucketName,
        hasPublicUrl: !!publicUrl
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};
