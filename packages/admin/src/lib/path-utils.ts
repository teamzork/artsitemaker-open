import os from 'os';
import path from 'path';

/**
 * Resolve a user-provided path, expanding "~" and handling relative paths.
 */
export function resolveUserPath(inputPath: string): string {
  const trimmed = inputPath.trim();

  if (trimmed.startsWith('~/')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }

  if (trimmed.startsWith('~')) {
    return path.join(os.homedir(), trimmed.slice(1));
  }

  if (!path.isAbsolute(trimmed)) {
    return path.resolve(trimmed);
  }

  return trimmed;
}
