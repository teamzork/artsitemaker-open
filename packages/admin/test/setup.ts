import { vi } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    default: memfs.fs.promises,
    ...memfs.fs.promises,
  };
});

// Mock fs with memfs
vi.mock('fs', async () => {
  const memfs = await import('memfs');
  return {
    default: memfs.fs,
    ...memfs.fs,
  };
});

// Reset filesystem before each test
beforeEach(() => {
  vol.reset();
});

// Mock environment variables
process.env.CONTENT_DIR = '/test/content';
process.env.FILES_DIR = '/test/files';
