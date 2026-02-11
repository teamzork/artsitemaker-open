import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAPIContext, parseJSONResponse } from '../helpers/mock-astro';
import { GET, POST } from '../../src/pages/api/storage-diagnostics';

const getStorageDiagnostics = vi.fn();
const createR2ClientFromVault = vi.fn();

vi.mock('../../src/lib/storage/storage-diagnostics', () => ({
  getStorageDiagnostics,
}));

vi.mock('../../src/lib/storage/r2-vault', () => ({
  createR2ClientFromVault,
}));

vi.mock('../../src/lib/storage/storage-logger', () => ({
  logStorageWarning: vi.fn(),
  logStorageError: vi.fn(),
}));

const diagnosticsFixture = {
  timestamp: '2024-01-01T00:00:00.000Z',
  siteName: 'Test Site',
  storageMode: 'r2',
  imageBaseUrl: 'https://images.example/test-site',
  userDataStructure: {
    valid: true,
    errors: [],
    warnings: [],
    summary: { errorCount: 0, warningCount: 0 },
  },
  local: {
    filesPath: '/test/files',
    thumbnailsPath: '/test/thumbs',
    publicUrl: 'http://localhost:4322',
    filesPathExists: true,
    thumbnailsPathExists: true,
    variantCounts: {
      originals: 2,
      large: 2,
      medium: 2,
      small: 2,
      thumbnails: 2,
    },
  },
  r2: {
    bucketName: 'test-bucket',
    publicUrl: 'https://r2.example',
    projectPrefix: 'test-site',
    configMissingFields: [],
    vault: {
      status: 'ready',
      missingFields: [],
    },
  },
};

describe('Storage Diagnostics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns diagnostics payload on GET', async () => {
    getStorageDiagnostics.mockResolvedValue(diagnosticsFixture);

    const response = await GET(createMockAPIContext());
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.diagnostics.storageMode).toBe('r2');
    expect(data.diagnostics.r2.bucketName).toBe('test-bucket');
  });

  it('skips checks when storage mode is external', async () => {
    getStorageDiagnostics.mockResolvedValue({
      ...diagnosticsFixture,
      storageMode: 'external',
    });

    const response = await POST(createMockAPIContext({ method: 'POST' }));
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.check.status).toBe('skipped');
    expect(createR2ClientFromVault).not.toHaveBeenCalled();
  });

  it('returns local check details when storage mode is local', async () => {
    getStorageDiagnostics.mockResolvedValue({
      ...diagnosticsFixture,
      storageMode: 'local',
    });

    const response = await POST(createMockAPIContext({ method: 'POST' }));
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.check.type).toBe('local');
    expect(data.check.ok).toBe(true);
    expect(data.check.counts.originals).toBe(2);
  });

  it('returns user-data validation errors during local checks', async () => {
    getStorageDiagnostics.mockResolvedValue({
      ...diagnosticsFixture,
      storageMode: 'local',
      userDataStructure: {
        valid: false,
        errors: [{ level: 'error', code: 'missing-root', message: 'Missing', targetPath: 'root' }],
        warnings: [],
        summary: { errorCount: 1, warningCount: 0 },
      },
    });

    const response = await POST(createMockAPIContext({ method: 'POST' }));
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.check.reason).toBe('user-data-invalid');
    expect(data.check.userData.errorCount).toBe(1);
  });

  it('returns vault failure details when R2 client cannot be created', async () => {
    getStorageDiagnostics.mockResolvedValue(diagnosticsFixture);
    createR2ClientFromVault.mockResolvedValue({
      ok: false,
      reason: 'vault-locked',
    });

    const response = await POST(createMockAPIContext({ method: 'POST' }));
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.check.ok).toBe(false);
    expect(data.check.reason).toBe('vault-locked');
  });

  it('returns success for a valid R2 connectivity check', async () => {
    getStorageDiagnostics.mockResolvedValue(diagnosticsFixture);
    createR2ClientFromVault.mockResolvedValue({
      ok: true,
      client: {
        send: vi.fn().mockResolvedValue({ KeyCount: 1 }),
      },
      config: {
        accountId: 'acct',
        accessKeyId: 'access',
        secretAccessKey: 'secret',
        bucketName: 'test-bucket',
        publicUrl: 'https://r2.example',
        projectPrefix: 'test-site',
      },
    });

    const response = await POST(createMockAPIContext({ method: 'POST' }));
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.check.ok).toBe(true);
    expect(data.check.keyCount).toBe(1);
    expect(data.check.bucketName).toBe('test-bucket');
  });
});
