/**
 * Storage Logger
 *
 * Centralized structured logging for storage diagnostics and failures.
 */

type StorageLogLevel = 'info' | 'warn' | 'error';

type StorageLogDetails = Record<string, unknown>;

function log(level: StorageLogLevel, event: string, details: StorageLogDetails = {}) {
  const payload = { event, ...details };
  if (level === 'info') {
    console.info('[Storage]', payload);
    return;
  }
  if (level === 'warn') {
    console.warn('[Storage]', payload);
    return;
  }
  console.error('[Storage]', payload);
}

export function logStorageInfo(event: string, details?: StorageLogDetails) {
  log('info', event, details);
}

export function logStorageWarning(event: string, details?: StorageLogDetails) {
  log('warn', event, details);
}

export function logStorageError(event: string, details?: StorageLogDetails) {
  log('error', event, details);
}
