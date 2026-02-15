import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createMockAPIContext, parseJSONResponse } from '../helpers/mock-astro';
import { POST } from '../../src/pages/api/r2/test';
import { getR2BucketName, getR2PublicUrl } from '../../src/lib/paths';
import { loadEncryptedSecrets, decryptWithSession } from '../../src/lib/secrets';

vi.mock('../../src/lib/paths', () => ({
  getR2BucketName: vi.fn(),
  getR2PublicUrl: vi.fn(),
}));

vi.mock('../../src/lib/secrets', () => ({
  loadEncryptedSecrets: vi.fn(),
  decryptWithSession: vi.fn(),
}));

describe('R2 Test Connection API', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getR2BucketName).mockReturnValue('config-bucket');
    vi.mocked(getR2PublicUrl).mockReturnValue('https://config.example');
    vi.mocked(loadEncryptedSecrets).mockResolvedValue(null);
    vi.mocked(decryptWithSession).mockReturnValue(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('treats empty bucket name and public URL as missing even if config has values', async () => {
    const response = await POST(
      createMockAPIContext({
        method: 'POST',
        body: {
          accountId: 'acct',
          accessKeyId: 'access',
          secretAccessKey: 'secret',
          bucketName: '',
          publicUrl: '',
        },
      })
    );

    const data = await parseJSONResponse(response);

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.missingFields).toEqual(['bucketName', 'publicUrl']);
  });

  it('uses vault account ID when request omits it', async () => {
    vi.mocked(loadEncryptedSecrets).mockResolvedValue({} as any);
    vi.mocked(decryptWithSession).mockReturnValue({
      r2: {
        account_id: 'vault-account',
        access_key_id: 'vault-access',
        secret_access_key: 'vault-secret',
      },
    });
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 })
    ) as typeof fetch;

    const response = await POST(
      createMockAPIContext({
        method: 'POST',
        body: {
          bucketName: 'bucket',
          publicUrl: 'https://r2.example',
        },
      })
    );

    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.publicUrl).toBe('https://r2.example');
    expect(data.bucketName).toBe('bucket');
    expect(global.fetch).toHaveBeenCalledWith('https://r2.example', expect.any(Object));
  });

  it('returns missing account ID when vault is locked', async () => {
    vi.mocked(loadEncryptedSecrets).mockResolvedValue({} as any);
    vi.mocked(decryptWithSession).mockReturnValue(null);
    global.fetch = vi.fn() as typeof fetch;

    const response = await POST(
      createMockAPIContext({
        method: 'POST',
        body: {
          bucketName: 'bucket',
          publicUrl: 'https://r2.example',
        },
      })
    );

    const data = await parseJSONResponse(response);

    expect(response.status).toBe(400);
    expect(data.missingFields).toEqual(['accountId']);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
