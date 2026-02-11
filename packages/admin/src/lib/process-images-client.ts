// lib/process-images-client.ts

export interface ProcessImagesResult {
  processedCount: number;
  hasErrors: boolean;
  processedSlugs: string[];
  errors: string[];
}

export interface ProcessingLogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

const STORAGE_KEY = 'artis:processing-log';

interface ProcessImagesOptions {
  showStartToast?: boolean;
  reloadOnComplete?: boolean;
  reloadDelayMs?: number;
}

type ToastVariant = 'default' | 'success' | 'destructive' | 'warning';

interface ToastAction {
  label: string;
  onClick: () => void;
}

function showToast(detail: { 
  title: string; 
  description?: string; 
  variant?: ToastVariant;
  action?: ToastAction;
}) {
  window.dispatchEvent(
    new CustomEvent('artsitemaker:toast', {
      detail,
    }),
  );
}

interface ProcessImagesRequestOptions {
  slugs?: string[];
}

function showProcessingSummaryToasts(processedCount: number, errors: string[]) {
  if (processedCount > 0) {
    showToast({
      title: 'Processing Complete',
      description: `✓ Processed ${processedCount} image${processedCount > 1 ? 's' : ''} successfully`,
      variant: 'success',
    });
  } else if (errors.length === 0) {
    showToast({
      title: 'Nothing to Process',
      description: 'No images waiting to be processed.',
      variant: 'default',
    });
  }

  if (errors.length > 0) {
    // Show the first error message (usually the most important, like "Image server not running")
    const errorMessage = errors[0];
    showToast({
      title: 'Processing Error',
      description: errorMessage,
      variant: 'destructive',
    });
  }
}

async function requestProcessImages(
  options: ProcessImagesRequestOptions = {},
): Promise<ProcessImagesResult> {
  const { slugs } = options;

  const res = await fetch('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slugs && slugs.length > 0 ? { slugs } : {}),
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // Ignore JSON parse errors; fall back to empty data
  }

  const processed = Array.isArray(data.processed) ? data.processed : [];
  const errors = Array.isArray(data.errors) ? data.errors : [];

  const processedSlugs = processed.map((item: any) =>
    typeof item === 'string' ? item : item?.slug ?? String(item),
  );

  return {
    processedCount: processed.length,
    hasErrors: errors.length > 0,
    processedSlugs,
    errors,
  };
}

/**
 * Store log entries in sessionStorage
 */
export function storeProcessingLog(entries: ProcessingLogEntry[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to store processing log:', e);
  }
}

/**
 * Retrieve log entries from sessionStorage
 */
export function getProcessingLog(): ProcessingLogEntry[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to retrieve processing log:', e);
    return [];
  }
}

/**
 * Clear processing log from sessionStorage
 */
export function clearProcessingLog(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear processing log:', e);
  }
}

/**
 * Add a log entry to sessionStorage
 */
function addLogEntry(message: string, type: 'info' | 'success' | 'error'): void {
  const logs = getProcessingLog();
  logs.push({
    timestamp: new Date().toLocaleTimeString(),
    message,
    type,
  });
  storeProcessingLog(logs);
}

/**
 * Client-side helper to trigger the image processing pipeline.
 *
 * - Calls /api/process
 * - Centralizes toast messaging
 * - Stores processing log in sessionStorage
 * - Optionally reloads the page on completion
 */
export async function processImagesWithToasts(
  options: ProcessImagesOptions = {},
): Promise<ProcessImagesResult> {
  const { showStartToast = true, reloadOnComplete = true, reloadDelayMs = 1500 } = options;

  // Clear previous log and start fresh
  clearProcessingLog();
  addLogEntry('Starting batch processing...', 'info');

  if (showStartToast) {
    showToast({
      title: 'Processing Started',
      description: 'Processing images in background...',
      variant: 'default',
      action: {
        label: 'View processing queue',
        onClick: () => {
          const modal = document.getElementById('processing-modal');
          if (modal && typeof (modal as any).open === 'function') {
            (modal as any).open();
          }
        },
      },
    });
  }

  try {
    const result = await requestProcessImages();

    if (result.processedSlugs.length > 0) {
      for (const slug of result.processedSlugs) {
        addLogEntry(`✓ Processed: ${slug}`, 'success');
      }
    } else {
      addLogEntry('No images found to process.', 'info');
    }

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        addLogEntry(`✗ Error: ${error}`, 'error');
      }
    }

    addLogEntry(`Completed! Processed ${result.processedCount} image(s).`, 'success');

    showProcessingSummaryToasts(result.processedCount, result.errors);

    if (reloadOnComplete) {
      setTimeout(() => {
        window.location.reload();
      }, reloadDelayMs);
    }

    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';

    addLogEntry(`Processing failed: ${message}`, 'error');

    showToast({
      title: 'Processing Failed',
      description: `An unexpected error occurred: ${message}`,
      variant: 'destructive',
    });

    throw e instanceof Error ? e : new Error(message);
  }
}

interface ProcessImagesSequentialOptions {
  slugs: string[];
  showStartToast?: boolean;
  reloadOnComplete?: boolean;
  reloadDelayMs?: number;
  onItemStart?: (slug: string) => void;
  onItemSuccess?: (slug: string) => void;
  onItemError?: (slug: string, error: string) => void;
}

/**
 * Process images one at a time with real-time callbacks.
 * Use this when you want to show live progress in a log UI.
 * Also stores logs in sessionStorage for persistence.
 */
export async function processImagesSequentially(
  options: ProcessImagesSequentialOptions,
): Promise<ProcessImagesResult> {
  const {
    slugs,
    showStartToast = true,
    reloadOnComplete = true,
    reloadDelayMs = 1500,
    onItemStart,
    onItemSuccess,
    onItemError,
  } = options;

  // Clear previous log and start fresh
  clearProcessingLog();
  addLogEntry('Starting batch processing...', 'info');
  addLogEntry(`Found ${slugs.length} images to process`, 'info');

  if (showStartToast) {
    showToast({
      title: 'Processing Started',
      description: 'Processing images in background...',
      variant: 'default',
      action: {
        label: 'View processing queue',
        onClick: () => {
          const modal = document.getElementById('processing-modal');
          if (modal && typeof (modal as any).open === 'function') {
            (modal as any).open();
          }
        },
      },
    });
  }

  const processedSlugs: string[] = [];
  const errors: string[] = [];

  for (const slug of slugs) {
    try {
      onItemStart?.(slug);
      addLogEntry(`Processing: ${slug}...`, 'info');

      const result = await requestProcessImages({ slugs: [slug] });

      if (result.processedSlugs.length > 0) {
        for (const processedSlug of result.processedSlugs) {
          processedSlugs.push(processedSlug);
          onItemSuccess?.(processedSlug);
          addLogEntry(`✓ Processed: ${processedSlug}`, 'success');
        }
      } else {
        onItemSuccess?.(slug);
        addLogEntry(`✓ Processed: ${slug}`, 'success');
      }

      if (result.errors.length > 0) {
        for (const error of result.errors) {
          errors.push(error);
          onItemError?.(slug, error);
          addLogEntry(`✗ Error: ${slug} - ${error}`, 'error');
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      errors.push(`${slug}: ${message}`);
      onItemError?.(slug, message);
      addLogEntry(`✗ Error: ${slug} - ${message}`, 'error');
    }
  }

  addLogEntry(`Completed! Processed ${processedSlugs.length} image(s).`, 'success');

  showProcessingSummaryToasts(processedSlugs.length, errors);

  if (reloadOnComplete) {
    setTimeout(() => {
      window.location.reload();
    }, reloadDelayMs);
  }

  return {
    processedCount: processedSlugs.length,
    hasErrors: errors.length > 0,
    processedSlugs,
    errors,
  };
}
