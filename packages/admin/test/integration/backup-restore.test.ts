import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'path';
import { promisify } from 'util';
import { createMockAPIContext, parseJSONResponse } from '../helpers/mock-astro';

let mockTarEntries: string[] = [];
let mockArchiveFiles: Record<string, string> = {};

const execMock = vi.hoisted(() =>
  vi.fn((command: string, optionsOrCallback: any, maybeCallback?: any) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;

    if (command.startsWith('tar -tzf')) {
      callback?.(null, `${mockTarEntries.join('\n')}\n`, '');
      return {} as any;
    }

    if (command.startsWith('tar -czf')) {
      const match = command.match(/-czf "([^"]+)"/);
      if (match) {
        const destPath = match[1];
        vol.mkdirSync(path.dirname(destPath), { recursive: true });
        vol.writeFileSync(destPath, 'backup');
      }
      callback?.(null, '', '');
      return {} as any;
    }

    if (command.startsWith('tar -xzf')) {
      const match = command.match(/-C "([^"]+)"/);
      const destDir = match?.[1] ?? '/tmp/extract';
      const root = mockTarEntries[0]?.replace(/^\.\/+/, '').split('/')[0] ?? '';

      for (const [entry, content] of Object.entries(mockArchiveFiles)) {
        const normalized = entry.replace(/^\.\/+/, '');
        const relative = normalized.startsWith(`${root}/`)
          ? normalized.slice(root.length + 1)
          : normalized;

        if (!relative) continue;

        const targetPath = path.join(destDir, relative);
        vol.mkdirSync(path.dirname(targetPath), { recursive: true });
        vol.writeFileSync(targetPath, content);
      }

      callback?.(null, '', '');
      return {} as any;
    }

    callback?.(null, '', '');
    return {} as any;
  }),
);

execMock[promisify.custom] = (command: string, options?: any) =>
  new Promise((resolve, reject) => {
    const callback = (error: any, stdout: any, stderr: any) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    };

    if (typeof options === 'function') {
      execMock(command, options);
      return;
    }

    if (options) {
      execMock(command, options, callback);
      return;
    }

    execMock(command, callback);
  });

vi.mock('child_process', () => ({ exec: execMock }));
vi.mock('node:child_process', () => ({ exec: execMock }));

vi.mock('../../src/lib/paths', () => ({
  getBackupsPath: () => '/test/backups',
  getContentPath: () => '/test/content',
}));

let POST: typeof import('../../src/pages/api/backup/[filename]').POST;

describe('Backup Restore API', () => {
  beforeAll(async () => {
    ({ POST } = await import('../../src/pages/api/backup/[filename]'));
  });

  beforeEach(() => {
    mockTarEntries = [];
    mockArchiveFiles = {};

    vol.fromJSON({
      '/test/content/settings.yaml': 'site: test',
      '/test/content/artworks/old.yaml': 'title: old',
      '/test/backups/backup.tar.gz': 'fake',
    });
  });

  it('restores a backup into the content path', async () => {
    mockTarEntries = [
      'user-data/',
      'user-data/settings.yaml',
      'user-data/artworks/',
      'user-data/artworks/new.yaml',
    ];

    mockArchiveFiles = {
      'user-data/settings.yaml': 'site: restored',
      'user-data/artworks/new.yaml': 'title: new',
    };

    const context = createMockAPIContext({
      method: 'POST',
      url: 'http://localhost:4322/api/backup/backup.tar.gz',
    });
    context.params = { filename: 'backup.tar.gz' };

    const response = await POST(context);
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(vol.existsSync('/test/content/artworks/old.yaml')).toBe(false);
    expect(vol.readFileSync('/test/content/settings.yaml', 'utf8')).toContain('restored');
    expect(vol.existsSync('/test/content/artworks/new.yaml')).toBe(true);
  });

  it('rejects unsafe backup entries', async () => {
    mockTarEntries = ['user-data/../evil.yaml'];

    const context = createMockAPIContext({
      method: 'POST',
      url: 'http://localhost:4322/api/backup/backup.tar.gz',
    });
    context.params = { filename: 'backup.tar.gz' };

    const response = await POST(context);
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain('unsafe');
    expect(vol.existsSync('/test/content/artworks/old.yaml')).toBe(true);
  });
});
