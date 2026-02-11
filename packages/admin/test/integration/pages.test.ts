// packages/admin/test/integration/pages.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import { GET, PUT, POST } from '../../src/pages/api/pages';
import { createMockAPIContext, parseJSONResponse } from '../helpers/mock-astro';
import { setupTestFileSystem, createYAMLFile } from '../helpers/test-utils';

// Mock the paths module to use test paths
vi.mock('../../src/lib/paths', () => ({
  getContentPath: () => '/test/content',
  getThemesPath: () => '/test/themes',
}));

// Mock config-paths module
vi.mock('../../src/lib/config-paths', () => ({
  getPagesConfigPath: () => '/test/content/settings/pages.yaml',
  getThemeConfigPath: () => '/test/content/settings/theme.yaml',
  getSettingsFilePath: () => '/test/content/settings.yaml',
}));

describe('Pages API Integration Tests', () => {
  beforeEach(() => {
    setupTestFileSystem();

    // Create test themes directory
    vol.mkdirSync('/test/themes/modern', { recursive: true });
    vol.mkdirSync('/test/themes/minimal', { recursive: true });

    // Create default settings file
    createYAMLFile('/test/content/settings.yaml', {
      theme: 'modern',
      title: 'Test Gallery',
    });
  });

  describe('GET /api/pages', () => {
    it('should return page types and default settings when pages config does not exist', async () => {
      const context = createMockAPIContext();
      const response = await GET(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.pageTypes).toBeDefined();
      expect(data.pageTypes.length).toBeGreaterThan(0);
      expect(data.pages).toBeDefined();
      expect(data.pages.enabled).toBeDefined();
      expect(data.pages.homePage).toBe('gallery');
      expect(data.pages.linking).toBeDefined();
      expect(data.themeName).toBe('modern');
    });

    it('should prefer settings.yaml over theme.yaml for theme name', async () => {
      // settings.yaml says modern (already created in beforeEach)
      // so even if theme.yaml says minimal, modern should win
      vol.mkdirSync('/test/content/settings', { recursive: true });
      createYAMLFile('/test/content/settings/theme.yaml', {
        theme: 'minimal',
      });

      // Create the minimal theme file locally just in case
      createYAMLFile('/test/themes/minimal/theme.yaml', {
        name: 'Minimal',
        supported_pages: ['home', 'gallery'],
      });

      const context = createMockAPIContext();
      const response = await GET(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.themeName).toBe('modern');
      // Modern theme has no theme.yaml definition in this test setup, so it returns all defaults
      expect(data.supportedPages.length).toBeGreaterThan(2);
    });

    it('should fallback to theme.yaml if settings.yaml has no theme', async () => {
      // Overwrite settings.yaml to have no theme
      createYAMLFile('/test/content/settings.yaml', {
        title: 'Test Gallery',
        // no theme here
      });
      
      vol.mkdirSync('/test/content/settings', { recursive: true });
      createYAMLFile('/test/content/settings/theme.yaml', {
        theme: 'minimal',
      });

      // Create the minimal theme definition
      createYAMLFile('/test/themes/minimal/theme.yaml', {
        name: 'Minimal',
        supported_pages: ['home', 'gallery'],
      });

      const context = createMockAPIContext();
      const response = await GET(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.themeName).toBe('minimal');
      expect(data.supportedPages).toEqual(['home', 'gallery']);
    });

    it('should return existing page settings', async () => {
      // Create pages config in new location
      vol.mkdirSync('/test/content/settings', { recursive: true });
      createYAMLFile('/test/content/settings/pages.yaml', {
        enabled: {
          home: true,
          gallery: true,
          about: false,
        },
        homePage: 'home',
        linking: {
          galleryClick: 'slider',
          collectionClick: 'gallery',
        },
      });

      const context = createMockAPIContext();
      const response = await GET(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.pages.enabled.home).toBe(true);
      expect(data.pages.enabled.gallery).toBe(true);
      expect(data.pages.enabled.about).toBe(false);
      expect(data.pages.homePage).toBe('home');
    });

    it('should include theme supported pages', async () => {
      // Create theme with supported pages
      createYAMLFile('/test/themes/modern/theme.yaml', {
        name: 'Modern',
        supported_pages: ['home', 'gallery', 'about'],
      });

      const context = createMockAPIContext();
      const response = await GET(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.supportedPages).toEqual(['home', 'gallery', 'about']);
    });

    it('should return all pages as supported when theme has no restrictions', async () => {
      // Theme without supported_pages field
      createYAMLFile('/test/themes/modern/theme.yaml', {
        name: 'Modern',
      });

      const context = createMockAPIContext();
      const response = await GET(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.supportedPages).toBeDefined();
      expect(data.supportedPages.length).toBeGreaterThan(5);
    });

    it('should return defaults when pages config does not exist', async () => {
      // Ensure pages.yaml doesn't exist
      try {
        vol.unlinkSync('/test/content/settings/pages.yaml');
      } catch {
        // File may not exist
      }

      const context = createMockAPIContext();
      const response = await GET(context);
      const data = await parseJSONResponse(response);

      // Should return defaults, not error
      expect(response.status).toBe(200);
      expect(data.pages).toBeDefined();
      expect(data.pages.homePage).toBe('gallery');
      expect(data.pages.enabled).toBeDefined();
    });
  });

  describe('PUT /api/pages', () => {
    it('should update page enabled settings', async () => {
      const context = createMockAPIContext({
        method: 'PUT',
        body: {
          enabled: {
            gallery: false,
            slider: true,
          },
        },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pages.enabled.gallery).toBe(false);
      expect(data.pages.enabled.slider).toBe(true);
    });

    it('should reject disabling all core pages', async () => {
      const context = createMockAPIContext({
        method: 'PUT',
        body: {
          enabled: {
            home: false,
            gallery: false,
            slider: false,
            about: false,
            schedule: false,
          },
        },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('At least one core page type must be enabled');
      expect(data.field).toBe('enabled');
    });

    it('should update home page setting', async () => {
      const context = createMockAPIContext({
        method: 'PUT',
        body: {
          homePage: 'gallery',
        },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pages.homePage).toBe('gallery');
    });

    it('should resolve home page to fallback if requested page is disabled', async () => {
      // First disable the gallery page
      await PUT(createMockAPIContext({
        method: 'PUT',
        body: {
          enabled: { gallery: false },
        },
      }));

      // Try to set gallery as home page
      const context = createMockAPIContext({
        method: 'PUT',
        body: {
          homePage: 'gallery',
        },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.pages.homePage).not.toBe('gallery'); // Should fallback
    });

    it('should update linking settings', async () => {
      const context = createMockAPIContext({
        method: 'PUT',
        body: {
          linking: {
            galleryClick: 'art_piece',
            collectionClick: 'gallery',
          },
        },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pages.linking.galleryClick).toBe('art_piece');
      expect(data.pages.linking.collectionClick).toBe('gallery');
    });

    it('should resolve link targets to fallback if target is disabled', async () => {
      // Disable art_piece page
      await PUT(createMockAPIContext({
        method: 'PUT',
        body: {
          enabled: { art_piece: false },
        },
      }));

      // Try to set art_piece as gallery click target
      const context = createMockAPIContext({
        method: 'PUT',
        body: {
          linking: {
            galleryClick: 'art_piece',
          },
        },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      // Should fallback to slider or none
      expect(['slider', 'none']).toContain(data.pages.linking.galleryClick);
    });

    it('should create pages config if it does not exist', async () => {
      // Ensure pages.yaml doesn't exist
      try {
        vol.unlinkSync('/test/content/settings/pages.yaml');
      } catch {
        // File may not exist
      }

      const context = createMockAPIContext({
        method: 'PUT',
        body: {
          homePage: 'gallery',
        },
      });

      const response = await PUT(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pages).toBeDefined();
      expect(data.pages.homePage).toBe('gallery');
      
      // Verify file was created
      const content = vol.readFileSync('/test/content/settings/pages.yaml', 'utf8') as string;
      expect(content).toContain('homePage: gallery');
    });

    it('should persist settings to pages.yaml', async () => {
      const context = createMockAPIContext({
        method: 'PUT',
        body: {
          homePage: 'about',
          enabled: { about: true },
        },
      });

      await PUT(context);

      // Read pages.yaml and verify
      const content = vol.readFileSync('/test/content/settings/pages.yaml', 'utf8') as string;
      expect(content).toContain('homePage');
      expect(content).toContain('about');
    });
  });

  describe('POST /api/pages/validate-theme-switch', () => {
    it('should identify affected pages when switching themes', async () => {
      // Set up current pages config
      vol.mkdirSync('/test/content/settings', { recursive: true });
      createYAMLFile('/test/content/settings/pages.yaml', {
        enabled: {
          home: true,
          gallery: true,
          collections_list: true,
          article: true,
        },
        homePage: 'home',
      });

      // New theme supports fewer pages
      createYAMLFile('/test/themes/minimal/theme.yaml', {
        name: 'Minimal',
        supported_pages: ['home', 'gallery'],
      });

      const context = createMockAPIContext({
        method: 'POST',
        body: {
          newTheme: 'minimal',
        },
      });

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.affectedPages).toBeDefined();
      expect(data.affectedPages.length).toBeGreaterThan(0);
      expect(data.newSupportedPages).toEqual(['home', 'gallery']);
    });

    it('should detect home page changes', async () => {
      // Current home page is 'collections_list'
      vol.mkdirSync('/test/content/settings', { recursive: true });
      createYAMLFile('/test/content/settings/pages.yaml', {
        enabled: {
          collections_list: true,
          gallery: true,
        },
        homePage: 'collections_list',
      });

      // New theme does not support collections_list
      createYAMLFile('/test/themes/minimal/theme.yaml', {
        name: 'Minimal',
        supported_pages: ['home', 'gallery'],
      });

      const context = createMockAPIContext({
        method: 'POST',
        body: {
          newTheme: 'minimal',
        },
      });

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.homePageAffected).toBe(true);
      expect(data.currentHome).toBe('collections_list');
      expect(data.newHome).not.toBe('collections_list');
    });

    it('should return empty affected pages if all enabled pages are supported', async () => {
      vol.mkdirSync('/test/content/settings', { recursive: true });
      createYAMLFile('/test/content/settings/pages.yaml', {
        enabled: {
          home: true,
          gallery: true,
        },
        homePage: 'home',
      });

      createYAMLFile('/test/themes/minimal/theme.yaml', {
        name: 'Minimal',
        supported_pages: ['home', 'gallery', 'about'],
      });

      const context = createMockAPIContext({
        method: 'POST',
        body: {
          newTheme: 'minimal',
        },
      });

      const response = await POST(context);
      const data = await parseJSONResponse(response);

      expect(response.status).toBe(200);
      expect(data.affectedPages).toHaveLength(0);
      expect(data.homePageAffected).toBe(false);
    });
  });
});
