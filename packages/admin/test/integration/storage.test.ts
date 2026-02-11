import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import { LocalStorageProvider } from '../../src/lib/storage/local-storage';
import type { StorageConfig, ImageVariants } from '../../src/lib/storage/types';

// Mock fs to use memfs
vi.mock('fs/promises', () => ({
  default: vol.promises,
}));

describe('Storage Provider Integration Tests', () => {
  let provider: LocalStorageProvider;
  const testConfig: StorageConfig = {
    type: 'local',
    local: {
      filesPath: '/test/files',
      thumbnailsPath: '/test/thumbnails',
      publicUrl: 'http://localhost:4322',
    },
  };

  beforeEach(() => {
    // Reset virtual filesystem
    vol.reset();

    // Create provider instance
    provider = new LocalStorageProvider(testConfig);
  });

  // Helper to create mock image variants
  function createMockVariants(): ImageVariants {
    return {
      large: Buffer.from('large-image-data'),
      medium: Buffer.from('medium-image-data'),
      small: Buffer.from('small-image-data'),
      thumb: Buffer.from('thumbnail-data'),
      original: Buffer.from('original-image-data'),
    };
  }

  describe('uploadImages', () => {
    it('should write thumbnails to the correct thumbnailsPath', async () => {
      const slug = 'test-artwork';
      const variants = createMockVariants();

      await provider.uploadImages(slug, variants);

      // Critical: Verify thumbnail is written to thumbnailsPath, NOT filesPath + '/thumbnails'
      const thumbnailPath = '/test/thumbnails/test-artwork.png';
      const wrongPath = '/test/files/thumbnails/test-artwork.png';

      expect(vol.existsSync(thumbnailPath)).toBe(true);
      expect(vol.existsSync(wrongPath)).toBe(false);

      // Verify content is correct
      const thumbContent = vol.readFileSync(thumbnailPath);
      expect(thumbContent.toString()).toBe('thumbnail-data');
    });

    it('should write image variants to the correct filesPath subdirectories', async () => {
      const slug = 'test-artwork';
      const variants = createMockVariants();

      await provider.uploadImages(slug, variants);

      // Verify all variants are in the correct locations
      expect(vol.existsSync('/test/files/large/test-artwork.webp')).toBe(true);
      expect(vol.existsSync('/test/files/medium/test-artwork.webp')).toBe(true);
      expect(vol.existsSync('/test/files/small/test-artwork.webp')).toBe(true);
      expect(vol.existsSync('/test/files/originals/test-artwork.jpg')).toBe(true);

      // Verify content is correct
      const largeContent = vol.readFileSync('/test/files/large/test-artwork.webp');
      expect(largeContent.toString()).toBe('large-image-data');
    });

    it('should return URLs that match where files were actually written', async () => {
      const slug = 'test-artwork';
      const variants = createMockVariants();

      const urls = await provider.uploadImages(slug, variants);

      // URLs should point to the actual locations
      expect(urls.thumb).toBe('http://localhost:4322/thumbnails/test-artwork.png');
      expect(urls.large).toBe('http://localhost:4322/large/test-artwork.webp');
      expect(urls.medium).toBe('http://localhost:4322/medium/test-artwork.webp');
      expect(urls.small).toBe('http://localhost:4322/small/test-artwork.webp');
      expect(urls.original).toBe('http://localhost:4322/originals/test-artwork.jpg');
    });

    it('should create directories if they do not exist', async () => {
      const slug = 'test-artwork';
      const variants = createMockVariants();

      // Verify directories don't exist yet
      expect(vol.existsSync('/test/files/large')).toBe(false);
      expect(vol.existsSync('/test/thumbnails')).toBe(false);

      await provider.uploadImages(slug, variants);

      // Verify directories were created
      expect(vol.existsSync('/test/files/large')).toBe(true);
      expect(vol.existsSync('/test/files/medium')).toBe(true);
      expect(vol.existsSync('/test/files/small')).toBe(true);
      expect(vol.existsSync('/test/files/originals')).toBe(true);
      expect(vol.existsSync('/test/thumbnails')).toBe(true);
    });
  });

  describe('getImageUrls', () => {
    it('should return URLs that match where uploadImages writes files', async () => {
      const slug = 'consistency-test';
      const variants = createMockVariants();

      // Upload images
      const uploadedUrls = await provider.uploadImages(slug, variants);

      // Get URLs using the getter
      const retrievedUrls = await provider.getImageUrls(slug);

      // URLs should be identical
      expect(retrievedUrls.thumb).toBe(uploadedUrls.thumb);
      expect(retrievedUrls.large).toBe(uploadedUrls.large);
      expect(retrievedUrls.medium).toBe(uploadedUrls.medium);
      expect(retrievedUrls.small).toBe(uploadedUrls.small);
    });
  });

  describe('imagesExist', () => {
    it('should return true after images are uploaded', async () => {
      const slug = 'existence-test';
      const variants = createMockVariants();

      // Before upload
      expect(await provider.imagesExist(slug)).toBe(false);

      // Upload images
      await provider.uploadImages(slug, variants);

      // After upload
      expect(await provider.imagesExist(slug)).toBe(true);
    });

    it('should return false if images are not uploaded', async () => {
      const result = await provider.imagesExist('non-existent-artwork');
      expect(result).toBe(false);
    });
  });

  describe('deleteImages', () => {
    it('should delete all image variants including thumbnails', async () => {
      const slug = 'delete-test';
      const variants = createMockVariants();

      // Upload images
      await provider.uploadImages(slug, variants);

      // Verify files exist
      expect(vol.existsSync('/test/thumbnails/delete-test.png')).toBe(true);
      expect(vol.existsSync('/test/files/large/delete-test.webp')).toBe(true);

      // Delete images
      await provider.deleteImages(slug);

      // Verify files are deleted
      expect(vol.existsSync('/test/thumbnails/delete-test.png')).toBe(false);
      expect(vol.existsSync('/test/files/large/delete-test.webp')).toBe(false);
      expect(vol.existsSync('/test/files/medium/delete-test.webp')).toBe(false);
      expect(vol.existsSync('/test/files/small/delete-test.webp')).toBe(false);
      expect(vol.existsSync('/test/files/originals/delete-test.jpg')).toBe(false);
    });

    it('should not throw errors when deleting non-existent images', async () => {
      // Should not throw
      await expect(
        provider.deleteImages('non-existent-artwork')
      ).resolves.not.toThrow();
    });
  });

  describe('Read-Write Path Consistency (Regression Test for Bug)', () => {
    it('should write and read thumbnails from the same location', async () => {
      const slug = 'path-bug-regression';
      const variants = createMockVariants();

      // Upload images - this writes files
      await provider.uploadImages(slug, variants);

      // Get URLs - this returns where we expect to read from
      const urls = await provider.getImageUrls(slug);

      // Extract the thumbnail path from the URL
      const expectedThumbPath = urls.thumb.replace('http://localhost:4322', '');

      // The actual file should exist at the path implied by the URL
      const actualFilePath = '/test' + expectedThumbPath;
      expect(vol.existsSync(actualFilePath)).toBe(true);

      // Specifically verify it's in thumbnailsPath, not filesPath + '/thumbnails'
      expect(actualFilePath).toBe('/test/thumbnails/path-bug-regression.png');
      expect(actualFilePath).not.toContain('/files/thumbnails/');
    });

    it('should not write thumbnails to filesPath subdirectory', async () => {
      const slug = 'no-wrong-location';
      const variants = createMockVariants();

      await provider.uploadImages(slug, variants);

      // This was the bug: thumbnails were being written here
      const wrongLocation = '/test/files/thumbnails/no-wrong-location.png';
      expect(vol.existsSync(wrongLocation)).toBe(false);

      // They should be here instead
      const correctLocation = '/test/thumbnails/no-wrong-location.png';
      expect(vol.existsSync(correctLocation)).toBe(true);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle publicUrl with trailing slash', async () => {
      const configWithSlash: StorageConfig = {
        type: 'local',
        local: {
          filesPath: '/test/files',
          thumbnailsPath: '/test/thumbnails',
          publicUrl: 'http://localhost:4322/', // Note trailing slash
        },
      };

      const providerWithSlash = new LocalStorageProvider(configWithSlash);
      const slug = 'slash-test';
      const variants = createMockVariants();

      const urls = await providerWithSlash.uploadImages(slug, variants);

      // URLs should not have double slashes
      expect(urls.thumb).toBe('http://localhost:4322/thumbnails/slash-test.png');
      expect(urls.thumb).not.toContain('//thumbnails');
    });

    it('should throw error if local config is missing', () => {
      const invalidConfig: StorageConfig = {
        type: 'local',
        // local config is missing
      };

      expect(() => new LocalStorageProvider(invalidConfig)).toThrow(
        'Local storage config is required'
      );
    });
  });
});
