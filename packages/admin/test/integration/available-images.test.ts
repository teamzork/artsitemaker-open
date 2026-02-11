import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import { GET } from '../../src/pages/api/available-images';
import { parseJSONResponse } from '../helpers/mock-astro';

let storageMode: 'local' | 'r2' | 'external' = 'local';
let baseUrl = 'http://localhost:4322/';

vi.mock('../../src/lib/paths', () => ({
  getFilesPath: () => '/test/files',
  getImageStorageMode: () => storageMode,
  getImageBaseUrl: () => baseUrl,
  getR2BucketName: () => 'test-bucket',
  getR2ProjectPrefix: () => 'test-project',
}));

describe('Available Images API Integration Tests', () => {
  beforeEach(() => {
    storageMode = 'local';
    baseUrl = 'http://localhost:4322/';
    vol.mkdirSync('/test/files/originals', { recursive: true });
    vol.mkdirSync('/test/files/large', { recursive: true });
  });

  it('lists image files from current local storage with resolved URLs', async () => {
    vol.writeFileSync('/test/files/originals/selfie.png', 'image', { encoding: 'utf8' });
    vol.writeFileSync('/test/files/originals/portrait.heic', 'image', { encoding: 'utf8' });
    vol.writeFileSync('/test/files/originals/readme.txt', 'nope', { encoding: 'utf8' });
    vol.writeFileSync('/test/files/large/hero.webp', 'image', { encoding: 'utf8' });
    vol.writeFileSync('/test/files/large/alpha.jpg', 'image', { encoding: 'utf8' });

    const response = await GET({} as any);
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.storage).toBe('local');
    expect(Array.isArray(data.images)).toBe(true);

    const filenames = data.images.map((image: any) => image.filename);
    expect(filenames).toEqual([...filenames].sort());

    const paths = data.images.map((image: any) => image.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'originals/selfie.png',
        'originals/portrait.heic',
        'large/hero.webp',
        'large/alpha.jpg',
      ])
    );

    expect(paths).not.toContain('originals/readme.txt');

    const urlMap = new Map(data.images.map((image: any) => [image.path, image.url]));
    expect(urlMap.get('originals/selfie.png')).toBe('http://localhost:4322/originals/selfie.png');
    expect(urlMap.get('large/hero.webp')).toBe('http://localhost:4322/large/hero.webp');
  });

  it('returns empty list when no images exist', async () => {
    const response = await GET({} as any);
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.storage).toBe('local');
    expect(data.images).toEqual([]);
  });

  it('returns empty list for external storage mode', async () => {
    storageMode = 'external';

    const response = await GET({} as any);
    const data = await parseJSONResponse(response);

    expect(response.status).toBe(200);
    expect(data.storage).toBe('external');
    expect(data.images).toEqual([]);
  });
});
