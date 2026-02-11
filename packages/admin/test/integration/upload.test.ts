import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import { POST } from '../../src/pages/api/upload';
import { createMockAPIContext, parseJSONResponse } from '../helpers/mock-astro';
import { setupTestFileSystem, createYAMLFile, createMockArtwork } from '../helpers/test-utils';

// Mock the paths module
vi.mock('../../src/lib/paths', () => ({
  getContentPath: () => '/test/content',
}));

// Mock the image-pipeline module
vi.mock('../../src/lib/image-pipeline', () => ({
  slugify: (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  validateUpload: (file: File) => {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.heic', '.heif'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!validExtensions.includes(ext)) {
      return { valid: false, error: `Invalid file type. Allowed: ${validExtensions.join(', ')}` };
    }
    if (file.size > maxSize) {
      return { valid: false, error: `File too large. Max size: 50MB` };
    }
    return { valid: true };
  },
  processImageFromBuffer: async (buffer: Buffer, slug: string) => {
    // Mock image processing - just return success
    return {
      dimensions: {
        original: { width: 2000, height: 1500 },
        large: { width: 2000, height: 1500 },
        medium: { width: 1200, height: 900 },
        small: { width: 600, height: 450 },
        thumb: { width: 150, height: 112 },
      },
      warnings: [],
      aspectRatio: '4:3',
      padded: false,
    };
  },
}));

describe('Upload API Integration Tests', () => {
  beforeEach(() => {
    setupTestFileSystem();
  });

  // Helper to create a mock File
  function createMockFile(name: string, size: number = 1024): File {
    const buffer = Buffer.alloc(size);
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    return new File([blob], name, { type: 'image/jpeg' });
  }

  describe('POST /api/upload', () => {
    it('should upload a single image and create artwork YAML', async () => {
      const file = createMockFile('sunset.jpg', 5000);
      const formData = new FormData();
      formData.append('images', file);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });

      // Mock request.formData()
      context.request.formData = async () => formData;

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.uploaded).toHaveLength(1);
      expect(data.uploaded[0].slug).toBe('sunset');
      expect(data.uploaded[0].filename).toBe('sunset.jpg');
      expect(data.errors).toHaveLength(0);

      // Verify YAML file was created
      const yamlExists = vol.existsSync('/test/content/artworks/sunset.yaml');
      expect(yamlExists).toBe(true);

      // Verify YAML content
      const yamlContent = vol.readFileSync('/test/content/artworks/sunset.yaml', 'utf8') as string;
      expect(yamlContent).toContain('slug: sunset');
      expect(yamlContent).toContain('title: Sunset');
      expect(yamlContent).toContain('sortOrder: 1');
    });

    it('should upload multiple images', async () => {
      const file1 = createMockFile('image1.jpg');
      const file2 = createMockFile('image2.jpg');
      const formData = new FormData();
      formData.append('images', file1);
      formData.append('images', file2);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });
      context.request.formData = async () => formData;

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.uploaded).toHaveLength(2);
      expect(data.uploaded[0].slug).toBe('image1');
      expect(data.uploaded[1].slug).toBe('image2');
      expect(data.errors).toHaveLength(0);
    });

    it('should assign sequential sort orders when adding to end', async () => {
      // Create existing artworks
      createMockArtwork('existing1', 'Existing 1', 1);
      createMockArtwork('existing2', 'Existing 2', 2);

      const file = createMockFile('new-artwork.jpg');
      const formData = new FormData();
      formData.append('images', file);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });
      context.request.formData = async () => formData;

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.uploaded).toHaveLength(1);

      // Verify new artwork has sortOrder 3
      const yamlContent = vol.readFileSync('/test/content/artworks/new-artwork.yaml', 'utf8') as string;
      expect(yamlContent).toContain('sortOrder: 3');
    });

    it('should add to beginning and shift existing artworks when newArtworkOrder is "beginning"', async () => {
      // Set up settings with newArtworkOrder: beginning
      createYAMLFile('/test/content/settings.yaml', {
        gallery: {
          newArtworkOrder: 'beginning',
        },
      });

      // Create existing artworks
      createMockArtwork('existing1', 'Existing 1', 1);
      createMockArtwork('existing2', 'Existing 2', 2);

      const file = createMockFile('new-first.jpg');
      const formData = new FormData();
      formData.append('images', file);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });
      context.request.formData = async () => formData;

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.uploaded).toHaveLength(1);

      // Verify new artwork has sortOrder 1
      const newYaml = vol.readFileSync('/test/content/artworks/new-first.yaml', 'utf8') as string;
      expect(newYaml).toContain('sortOrder: 1');

      // Verify existing artworks were shifted
      const existing1 = vol.readFileSync('/test/content/artworks/existing1.yaml', 'utf8') as string;
      expect(existing1).toContain('sortOrder: 2');

      const existing2 = vol.readFileSync('/test/content/artworks/existing2.yaml', 'utf8') as string;
      expect(existing2).toContain('sortOrder: 3');
    });

    it('should reject duplicate slugs', async () => {
      // Create existing artwork
      createMockArtwork('duplicate', 'Duplicate', 1);

      const file = createMockFile('duplicate.jpg');
      const formData = new FormData();
      formData.append('images', file);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });
      context.request.formData = async () => formData;

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.uploaded).toHaveLength(0);
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0]).toContain('already exists');
    });

    it('should reject invalid file types', async () => {
      const file = createMockFile('document.pdf');
      const formData = new FormData();
      formData.append('images', file);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });
      context.request.formData = async () => formData;

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.uploaded).toHaveLength(0);
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0]).toContain('Invalid file type');
    });

    it('should reject files that are too large', async () => {
      const file = createMockFile('huge-image.jpg', 51 * 1024 * 1024); // 51MB
      const formData = new FormData();
      formData.append('images', file);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });
      context.request.formData = async () => formData;

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.uploaded).toHaveLength(0);
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0]).toContain('too large');
    });

    it('should handle mixed success and errors', async () => {
      createMockArtwork('existing', 'Existing', 1);

      const validFile = createMockFile('valid.jpg');
      const duplicateFile = createMockFile('existing.jpg');
      const invalidFile = createMockFile('invalid.txt');

      const formData = new FormData();
      formData.append('images', validFile);
      formData.append('images', duplicateFile);
      formData.append('images', invalidFile);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });
      context.request.formData = async () => formData;

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.uploaded).toHaveLength(1);
      expect(data.uploaded[0].slug).toBe('valid');
      expect(data.errors).toHaveLength(2);
    });

    it('should create artworks directory if it does not exist', async () => {
      // Remove artworks directory
      vol.rmdirSync('/test/content/artworks');

      const file = createMockFile('first.jpg');
      const formData = new FormData();
      formData.append('images', file);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });
      context.request.formData = async () => formData;

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.uploaded).toHaveLength(1);

      // Verify directory was created
      const dirExists = vol.existsSync('/test/content/artworks');
      expect(dirExists).toBe(true);
    });

    it('should generate proper titles from filenames', async () => {
      const file = createMockFile('my-beautiful-sunset_2024.jpg');
      const formData = new FormData();
      formData.append('images', file);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });
      context.request.formData = async () => formData;

      const response = await POST(context);
      await parseJSONResponse(response);

      const yamlContent = vol.readFileSync('/test/content/artworks/my-beautiful-sunset-2024.yaml', 'utf8') as string;
      expect(yamlContent).toContain('title: My Beautiful Sunset 2024');
    });

    it('should include processing metadata in artwork', async () => {
      const file = createMockFile('test.jpg');
      const formData = new FormData();
      formData.append('images', file);

      const context = createMockAPIContext({
        method: 'POST',
        url: 'http://localhost:4322/api/upload',
      });
      context.request.formData = async () => formData;

      const response = await POST(context);
      await parseJSONResponse(response);

      const yamlContent = vol.readFileSync('/test/content/artworks/test.yaml', 'utf8') as string;
      expect(yamlContent).toContain('processing:');
      expect(yamlContent).toContain('originalFile: test.jpg');
      expect(yamlContent).toContain('aspectRatio:');
      expect(yamlContent).toContain('processedAt:');
    });
  });
});
