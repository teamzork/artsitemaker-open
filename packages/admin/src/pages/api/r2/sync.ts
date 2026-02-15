/**
 * R2 Image Sync API with Server-Sent Events
 * 
 * GET /api/r2/sync
 * Streams sync progress via SSE and uploads all local images to R2
 */

import type { APIRoute } from 'astro';
import { R2StorageProvider } from '../../../lib/storage/r2-storage';
import { getR2VaultConfig } from '../../../lib/storage/r2-vault';
import {
  checkR2Configuration,
  getAllArtworkSlugs,
  readImageVariants,
} from '../../../lib/r2-sync-helper';
import { clearConfigCache } from '../../../lib/paths';

// SSE event types
interface ProgressEvent {
  type: 'progress';
  current: number;
  total: number;
  slug: string;
  status: 'uploading' | 'success' | 'error';
}

interface ErrorEvent {
  type: 'error';
  message: string;
  slug: string;
}

interface CompleteEvent {
  type: 'complete';
  uploaded: number;
  failed: number;
  errors: Array<{ slug: string; error: string }>;
}

interface InitEvent {
  type: 'init';
  total: number;
}

type SSEEvent = ProgressEvent | ErrorEvent | CompleteEvent | InitEvent;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

function createSSEEvent(data: SSEEvent): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create a ReadableStream that sends a single error event and closes
 */
function createErrorStream(message: string, slug: string = 'config-check'): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          createSSEEvent({
            type: 'error',
            message,
            slug,
          })
        )
      );
      controller.close();
    },
  });
}

/**
 * Create SSE response with proper headers
 */
function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, { headers: SSE_HEADERS });
}

/**
 * Create R2 provider with credentials from secrets vault
 */
async function createR2ProviderFromVault(): Promise<{
  valid: false;
  response: Response;
} | {
  valid: true;
  provider: R2StorageProvider;
}> {
  const configResult = await getR2VaultConfig({
    requireBucketName: true,
    requirePublicUrl: true,
  });

  if (!configResult.ok) {
    if (configResult.reason === 'vault-locked') {
      return {
        valid: false,
        response: createSSEResponse(
          createErrorStream('Secrets Vault is locked. Please unlock it first.')
        ),
      };
    }

    if (
      configResult.reason === 'vault-uninitialized' ||
      configResult.reason === 'credentials-missing' ||
      configResult.reason === 'credentials-incomplete'
    ) {
      return {
        valid: false,
        response: createSSEResponse(
          createErrorStream(
            'R2 credentials not found in Secrets Vault. Please add them in the R2 Storage Credentials section.'
          )
        ),
      };
    }

    const missingList = configResult.missingFields?.join(', ') || 'configuration';
    return {
      valid: false,
      response: createSSEResponse(
        createErrorStream(`R2 not configured. Missing: ${missingList}`)
      ),
    };
  }

  try {
    const provider = new R2StorageProvider({
      type: 'r2',
      r2: configResult.config,
    });
    return { valid: true, provider };
  } catch (e) {
    return {
      valid: false,
      response: createSSEResponse(
        createErrorStream(
          `Failed to initialize R2 provider: ${e instanceof Error ? e.message : 'Unknown error'}`
        )
      ),
    };
  }
}

export const GET: APIRoute = async ({ request: _request }) => {
  clearConfigCache();
  // Check if R2 storage mode is configured
  const configStatus = checkR2Configuration();

  if (!configStatus.configured) {
    const missingList = configStatus.missingFields.join(', ');
    return createSSEResponse(
      createErrorStream(`R2 not configured. Missing: ${missingList}`)
    );
  }

  // Create R2 provider from Secrets Vault
  const providerResult = await createR2ProviderFromVault();
  if (!providerResult.valid) {
    return providerResult.response;
  }

  // Get all artwork slugs with images
  const allSlugs = await getAllArtworkSlugs();
  const slugsToSync = allSlugs.filter((s) => s.hasOriginal);

  if (slugsToSync.length === 0) {
    return createSSEResponse(
      createErrorStream('No artwork images found in local storage', 'no-images')
    );
  }

  // Create main SSE stream for syncing
  const stream = createSyncStream(slugsToSync, providerResult.provider);
  return createSSEResponse(stream);
};

/**
 * Create the main sync stream that processes all artworks
 */
function createSyncStream(
  slugsToSync: Array<{ slug: string; hasOriginal: boolean }>,
  provider: R2StorageProvider
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const total = slugsToSync.length;
      let uploaded = 0;
      let failed = 0;
      const errors: Array<{ slug: string; error: string }> = [];

      // Send init event
      controller.enqueue(encoder.encode(createSSEEvent({ type: 'init', total })));

      // Process each artwork
      for (let i = 0; i < slugsToSync.length; i++) {
        const { slug } = slugsToSync[i];
        const current = i + 1;

        // Send uploading progress
        controller.enqueue(
          encoder.encode(
            createSSEEvent({
              type: 'progress',
              current,
              total,
              slug,
              status: 'uploading',
            })
          )
        );

        try {
          // Read image variants
          const variants = await readImageVariants(slug);

          if (!variants) {
            throw new Error('Failed to read image files');
          }

          // Upload to R2
          await provider.uploadImages(slug, variants);

          uploaded++;

          // Send success progress
          controller.enqueue(
            encoder.encode(
              createSSEEvent({
                type: 'progress',
                current,
                total,
                slug,
                status: 'success',
              })
            )
          );
        } catch (e) {
          failed++;
          const errorMessage = e instanceof Error ? e.message : 'Unknown error';
          errors.push({ slug, error: errorMessage });

          // Send error event
          controller.enqueue(
            encoder.encode(
              createSSEEvent({
                type: 'error',
                message: errorMessage,
                slug,
              })
            )
          );

          // Continue with next artwork despite error
        }

        // Small delay to prevent overwhelming the client with updates
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Send completion event
      controller.enqueue(
        encoder.encode(
          createSSEEvent({
            type: 'complete',
            uploaded,
            failed,
            errors,
          })
        )
      );

      controller.close();
    },

    cancel() {
      // Clean up if client disconnects
      console.log('R2 sync stream cancelled by client');
    },
  });
}
