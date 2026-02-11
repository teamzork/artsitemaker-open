import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import { GET, POST, PUT, DELETE } from '../../src/pages/api/collections';
import { createMockAPIContext, parseJSONResponse } from '../helpers/mock-astro';
import { setupTestFileSystem, createYAMLFile } from '../helpers/test-utils';

// Mock the paths module to use test paths
vi.mock('../../src/lib/paths', () => ({
  getContentPath: () => '/test/content',
}));

describe('Collections API Integration Tests', () => {
  beforeEach(() => {
    setupTestFileSystem();
  });

  describe('GET /api/collections', () => {
    it('should return empty array when collections directory does not exist', async () => {
      const context = createMockAPIContext();
      const response = await GET(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return all collections when directory exists', async () => {
      // Create test collections
      createYAMLFile('/test/content/collections/portraits.yaml', {
        title: 'Portraits',
        slug: 'portraits',
        description: 'Portrait collection',
      });
      createYAMLFile('/test/content/collections/landscapes.yaml', {
        title: 'Landscapes',
        slug: 'landscapes',
        description: 'Landscape collection',
      });

      const context = createMockAPIContext();
      const response = await GET(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Portraits', slug: 'portraits' }),
          expect.objectContaining({ title: 'Landscapes', slug: 'landscapes' }),
        ])
      );
    });

    it('should ignore non-yaml files', async () => {
      vol.writeFileSync('/test/content/collections/portraits.yaml', 'title: Portraits', 'utf8');
      vol.writeFileSync('/test/content/collections/readme.txt', 'Some text', 'utf8');

      const context = createMockAPIContext();
      const response = await GET(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
    });
  });

  describe('POST /api/collections', () => {
    it('should create a new collection', async () => {
      const context = createMockAPIContext({
        method: 'POST',
        body: { title: 'New Collection', slug: 'new-collection' },
      });

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.collection).toMatchObject({
        title: 'New Collection',
        slug: 'new-collection',
      });
      expect(data.collection.createdAt).toBeDefined();

      // Verify file was created
      const fileExists = vol.existsSync('/test/content/collections/new-collection.yaml');
      expect(fileExists).toBe(true);
    });

    it('should create collections directory if it does not exist', async () => {
      // Remove collections directory
      vol.rmdirSync('/test/content/collections');

      const context = createMockAPIContext({
        method: 'POST',
        body: { title: 'First Collection', slug: 'first' },
      });

      const response = await POST(context);
      expect(response.status).toBe(200);

      // Verify directory was created
      const dirExists = vol.existsSync('/test/content/collections');
      expect(dirExists).toBe(true);
    });

    it('should return 400 when title is missing', async () => {
      const context = createMockAPIContext({
        method: 'POST',
        body: { slug: 'missing-title' },
      });

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Title and slug are required');
    });

    it('should return 400 when slug is missing', async () => {
      const context = createMockAPIContext({
        method: 'POST',
        body: { title: 'Missing Slug' },
      });

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Title and slug are required');
    });

    it('should return 409 when collection already exists', async () => {
      // Create existing collection
      createYAMLFile('/test/content/collections/existing.yaml', {
        title: 'Existing',
        slug: 'existing',
      });

      const context = createMockAPIContext({
        method: 'POST',
        body: { title: 'Duplicate', slug: 'existing' },
      });

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(409);
      expect(data.error).toBe('Collection already exists');
    });
  });

  describe('PUT /api/collections', () => {
    it('should update an existing collection', async () => {
      // Create initial collection
      createYAMLFile('/test/content/collections/test.yaml', {
        title: 'Old Title',
        slug: 'test',
        createdAt: '2024-01-01T00:00:00.000Z',
      });

      const context = createMockAPIContext({
        method: 'PUT',
        body: { slug: 'test', title: 'Updated Title' },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify file was updated
      const content = vol.readFileSync('/test/content/collections/test.yaml', 'utf8') as string;
      expect(content).toContain('Updated Title');
      expect(content).toContain('2024-01-01T00:00:00.000Z'); // createdAt preserved
    });

    it('should return 400 when slug is missing', async () => {
      const context = createMockAPIContext({
        method: 'PUT',
        body: { title: 'Updated Title' },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Slug and title are required');
    });

    it('should return 400 when title is missing', async () => {
      const context = createMockAPIContext({
        method: 'PUT',
        body: { slug: 'test' },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Slug and title are required');
    });

    it('should return 404 when collection does not exist', async () => {
      const context = createMockAPIContext({
        method: 'PUT',
        body: { slug: 'nonexistent', title: 'Title' },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('Collection not found');
    });
  });

  describe('DELETE /api/collections', () => {
    it('should delete an existing collection', async () => {
      // Create collection to delete
      createYAMLFile('/test/content/collections/to-delete.yaml', {
        title: 'To Delete',
        slug: 'to-delete',
      });

      const context = createMockAPIContext({
        method: 'DELETE',
        body: { slug: 'to-delete' },
      });

      const response = await DELETE(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify file was deleted
      const fileExists = vol.existsSync('/test/content/collections/to-delete.yaml');
      expect(fileExists).toBe(false);
    });

    it('should return 400 when slug is missing', async () => {
      const context = createMockAPIContext({
        method: 'DELETE',
        body: {},
      });

      const response = await DELETE(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Slug required');
    });

    it('should return 500 when collection does not exist', async () => {
      const context = createMockAPIContext({
        method: 'DELETE',
        body: { slug: 'nonexistent' },
      });

      const response = await DELETE(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete collection');
    });
  });
});
