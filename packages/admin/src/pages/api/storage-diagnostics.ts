import type { APIRoute } from 'astro';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getStorageDiagnostics } from '../../lib/storage/storage-diagnostics';
import { createR2ClientFromVault } from '../../lib/storage/r2-vault';
import { logStorageWarning, logStorageError } from '../../lib/storage/storage-logger';

export const GET: APIRoute = async () => {
  try {
    const diagnostics = await getStorageDiagnostics();

    return new Response(JSON.stringify({ diagnostics }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logStorageError('storage-diagnostics-failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify({
        error: 'Failed to load storage diagnostics',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};

export const POST: APIRoute = async () => {
  try {
    const diagnostics = await getStorageDiagnostics();

    if (diagnostics.storageMode === 'local') {
      const missingPaths: string[] = [];
      if (!diagnostics.local.filesPathExists) missingPaths.push('filesPath');
      if (!diagnostics.local.thumbnailsPathExists) missingPaths.push('thumbnailsPath');

      const userDataValid = diagnostics.userDataStructure.valid;
      const ok = missingPaths.length === 0 && userDataValid;

      return new Response(
        JSON.stringify({
          diagnostics,
          check: {
            ok,
            status: ok ? 'ok' : 'error',
            type: 'local',
            reason: ok
              ? 'local-ok'
              : missingPaths.length > 0
                ? 'local-path-missing'
                : 'user-data-invalid',
            missingPaths,
            counts: diagnostics.local.variantCounts,
            userData: diagnostics.userDataStructure.summary,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (diagnostics.storageMode !== 'r2') {
      return new Response(
        JSON.stringify({
          diagnostics,
          check: {
            ok: false,
            status: 'skipped',
            type: diagnostics.storageMode,
            reason: 'storage-mode-not-r2',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const clientResult = await createR2ClientFromVault({
      requireBucketName: true,
    });

    if (!clientResult.ok) {
      logStorageWarning('storage-diagnostics-r2-client-failed', {
        reason: clientResult.reason,
        missingFields: clientResult.missingFields ?? [],
      });

      return new Response(
        JSON.stringify({
          diagnostics,
          check: {
            ok: false,
            status: 'error',
            type: 'r2',
            reason: clientResult.reason,
            missingFields: clientResult.missingFields ?? [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const { client, config } = clientResult;
    const prefix = config.projectPrefix ? `${config.projectPrefix}/` : undefined;
    const startTime = Date.now();

    try {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucketName,
          Prefix: prefix,
          MaxKeys: 1,
        }),
      );

      const durationMs = Date.now() - startTime;
      const keyCount = response.KeyCount ?? response.Contents?.length ?? 0;

      return new Response(
        JSON.stringify({
          diagnostics,
          check: {
            ok: true,
            status: 'ok',
            type: 'r2',
            durationMs,
            keyCount,
            bucketName: config.bucketName,
            prefix: prefix ?? null,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      logStorageError('storage-diagnostics-r2-check-failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return new Response(
        JSON.stringify({
          diagnostics,
          check: {
            ok: false,
            status: 'error',
            type: 'r2',
            reason: 'r2-request-failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    logStorageError('storage-diagnostics-check-failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify({
        error: 'Failed to run storage diagnostics check',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
