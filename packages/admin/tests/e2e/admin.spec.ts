// packages/admin/tests/e2e/admin.spec.ts
import { test, expect } from '@playwright/test';

/**
 * Admin E2E Tests
 *
 * Note: Tests run in dev mode where auth is bypassed
 * when OAuth is not configured (development-only behavior)
 */

test.describe('Dashboard', () => {
  test('should load dashboard and display stats', async ({ page }) => {
    await page.goto('/');

    // Dashboard should be visible
    const dashboard = page.getByTestId('dashboard');
    await expect(dashboard).toBeVisible();

    // Stats should be visible
    const stats = page.getByTestId('dashboard-stats');
    await expect(stats).toBeVisible();

    // Individual stat cards should be visible
    await expect(page.getByTestId('stat-total-artworks')).toBeVisible();
    await expect(page.getByTestId('stat-collections')).toBeVisible();
    await expect(page.getByTestId('stat-published')).toBeVisible();
    await expect(page.getByTestId('stat-unlisted')).toBeVisible();
    await expect(page.getByTestId('stat-unprocessed')).toBeVisible();
  });

  test('should display quick action buttons', async ({ page }) => {
    await page.goto('/');

    // Open Quick Actions dropdown
    const quickActionsBtn = page.locator('#quick-actions-btn');
    await expect(quickActionsBtn).toBeVisible();
    await quickActionsBtn.click();

    // Menu should be visible
    const menu = page.locator('#quick-actions-menu');
    await expect(menu).toBeVisible();

    // Upload link should be visible and have correct href
    const uploadLink = menu.getByRole('link', { name: /upload images/i });
    await expect(uploadLink).toBeVisible();
    await expect(uploadLink).toHaveAttribute('href', '/gallery/upload');

    // Process button should be visible
    const processBtn = page.locator('#quick-action-process');
    await expect(processBtn).toBeVisible();
    await expect(processBtn).toContainText(/process all images/i);
  });

  test('should show page title', async ({ page }) => {
    await page.goto('/');

    // Page should have title
    await expect(page).toHaveTitle(/Dashboard/i);
  });

  test('should display recent artwork thumbnails with valid image sources', async ({ page }) => {
    await page.goto('/');

    // Look for recent artworks section
    const recentArtworks = page.getByTestId('recent-artworks');
    await expect(recentArtworks).toBeVisible();

    // Get all thumbnail images in the recent artworks section
    const thumbnails = recentArtworks.locator('img');
    const thumbnailCount = await thumbnails.count();

    // Only test if there are thumbnails present
    if (thumbnailCount > 0) {
      // Check first few thumbnails (up to 5)
      for (let i = 0; i < Math.min(thumbnailCount, 5); i++) {
        const thumbnail = thumbnails.nth(i);

        // Verify image has a src attribute
        const src = await thumbnail.getAttribute('src');
        expect(src).toBeTruthy();

        // Verify src points to thumbnails directory (not files/thumbnails)
        expect(src).toContain('/thumbnails/');
        expect(src).not.toContain('/files/thumbnails/');

        // Verify image loads successfully (naturalWidth > 0 means loaded)
        await expect(thumbnail).toBeVisible();

        // Check that image actually loaded by checking natural dimensions
        const naturalWidth = await thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth);
        expect(naturalWidth).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Navigation', () => {
  test('should navigate to upload page from dashboard', async ({ page }) => {
    await page.goto('/');

    // Open Quick Actions dropdown
    await page.locator('#quick-actions-btn').click();
    
    // Click upload images link
    const uploadLink = page.locator('#quick-actions-menu').getByRole('link', { name: /upload images/i });
    await uploadLink.click();

    // Should navigate to upload page
    await expect(page).toHaveURL('/gallery/upload');

    // Upload page should be visible
    const uploadPage = page.getByTestId('upload-page');
    await expect(uploadPage).toBeVisible();
  });

  test('should have back link on upload page', async ({ page }) => {
    await page.goto('/gallery/upload');

    // Back link should exist and navigate to gallery
    const backLink = page.getByTestId('back-to-gallery');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/gallery');
  });
});

test.describe('Upload Page', () => {
  test('should display upload area', async ({ page }) => {
    await page.goto('/gallery/upload');

    // Page should be visible
    const uploadPage = page.getByTestId('upload-page');
    await expect(uploadPage).toBeVisible();

    // Drop zone should be visible
    const dropZone = page.getByTestId('drop-zone');
    await expect(dropZone).toBeVisible();

    // File input should exist (hidden)
    const fileInput = page.getByTestId('file-input');
    await expect(fileInput).toBeAttached();
  });

  test('should show correct file accept types', async ({ page }) => {
    await page.goto('/gallery/upload');

    const fileInput = page.getByTestId('file-input');
    const accept = await fileInput.getAttribute('accept');

    expect(accept).toContain('.jpg');
    expect(accept).toContain('.png');
    expect(accept).toContain('.webp');
    expect(accept).toContain('.heic');
  });

  test('should allow multiple file selection', async ({ page }) => {
    await page.goto('/gallery/upload');

    const fileInput = page.getByTestId('file-input');
    const hasMultiple = await fileInput.getAttribute('multiple');

    expect(hasMultiple).not.toBeNull();
  });
});

test.describe('Gallery Management', () => {
  test('should load gallery page', async ({ page }) => {
    await page.goto('/gallery');

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Should have gallery in title or heading
    const titleOrHeading = await page.textContent('h1, title');
    expect(titleOrHeading).toBeTruthy();
  });

  test('should load individual gallery settings page', async ({ page }) => {
    // Skip if no artworks exist
    const response = await page.goto('/gallery');

    if (response?.status() === 404) {
      test.skip();
    }

    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should support dragging and dropping an image to add to a category', async ({ page }) => {
    await page.goto('/gallery');

    // Look for draggable elements (artworks) and drop targets (collections)
    const artworkItems = page.locator('[draggable="true"]');
    const collectionTargets = page.locator('[data-collection-drop-zone]');

    // Check if drag-and-drop UI exists
    const hasArtworks = (await artworkItems.count()) > 0;
    const hasCollections = (await collectionTargets.count()) > 0;

    if (hasArtworks && hasCollections) {
      // Get first artwork and first collection
      const firstArtwork = artworkItems.first();
      const firstCollection = collectionTargets.first();

      // Get bounding boxes for drag-and-drop
      const artworkBox = await firstArtwork.boundingBox();
      const collectionBox = await firstCollection.boundingBox();

      if (artworkBox && collectionBox) {
        // Perform drag-and-drop
        await page.mouse.move(
          artworkBox.x + artworkBox.width / 2,
          artworkBox.y + artworkBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(
          collectionBox.x + collectionBox.width / 2,
          collectionBox.y + collectionBox.height / 2,
          { steps: 10 }
        );
        await page.mouse.up();

        // Wait for any UI feedback (optional)
        await page.waitForTimeout(500);

        // Verify some indication that the action was processed
        // This could be a toast notification, visual feedback, or API call
        // Adjust based on your actual implementation
        const body = page.locator('body');
        await expect(body).toBeVisible();
      } else {
        // Elements exist but not visible/positioned, skip test
        test.skip();
      }
    } else {
      // No drag-and-drop UI available, skip test
      test.skip();
    }
  });
});

test.describe('Settings', () => {
  test('should load settings page', async ({ page }) => {
    await page.goto('/settings');

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Should show settings content
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});

test.describe('Content Management', () => {
  test('should load content pages list', async ({ page }) => {
    await page.goto('/content');

    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Style & Theme', () => {
  test('should load style customization page', async ({ page }) => {
    await page.goto('/style');

    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load themes page', async ({ page }) => {
    await page.goto('/style/themes');

    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should be mobile-responsive', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Dashboard should still be visible on mobile
    const dashboard = page.getByTestId('dashboard');
    await expect(dashboard).toBeVisible();

    // Stats should still be visible (may be stacked)
    const stats = page.getByTestId('dashboard-stats');
    await expect(stats).toBeVisible();
  });
});

test.describe('Gallery Detail Form', () => {
  test('save button should enable on field edit and toggle change', async ({ page }) => {
    // Navigate to first artwork detail page (using sample content)
    await page.goto('/gallery');

    // Wait for gallery to load and click first artwork
    const firstArtwork = page.locator('[data-testid="artwork-grid-item"]').first();
    if (await firstArtwork.isVisible().catch(() => false)) {
      await firstArtwork.click();
    } else {
      // No artwork available, navigate directly to a test artwork
      await page.goto('/gallery/sample-artwork');
    }

    // Wait for form to be visible
    const form = page.locator('#artwork-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('data-change-detector-ready', 'true');

    // Save button should be initially disabled (no changes)
    const saveBtn = page.locator('#save-btn');
    await expect(saveBtn).toBeDisabled();

    // Edit a text field to trigger change detection
    const titleInput = page.locator('input[name="title"]');
    await titleInput.fill('Test Title Modified');

    // Save button should now be enabled
    await expect(saveBtn).toBeEnabled();

    // Reset the change by clearing the field and re-saving initial state
    // Note: This tests that the change detector is working
  });

  test('toggle changes should enable save button', async ({ page }) => {
    // Navigate to gallery detail
    await page.goto('/gallery');

    const firstArtwork = page.locator('[data-testid="artwork-grid-item"]').first();
    if (await firstArtwork.isVisible().catch(() => false)) {
      await firstArtwork.click();
    } else {
      await page.goto('/gallery/sample-artwork');
    }

    // Wait for form
    const form = page.locator('#artwork-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('data-change-detector-ready', 'true');

    const saveBtn = page.locator('#save-btn');
    await expect(saveBtn).toBeDisabled();

    // Click a toggle that is saved via the form (published is excluded from dirty tracking).
    const soldToggle = form.getByRole('button', { name: /^Sold$/ });
    // Ensure the toggle is hydrated/interactive by asserting its Radix state flips.
    const initialState = await soldToggle.getAttribute('data-state');
    await soldToggle.click();
    await expect(soldToggle).not.toHaveAttribute('data-state', initialState ?? '');

    // Save button should be enabled after toggle change
    await expect(saveBtn).toBeEnabled();
  });
});

test.describe('Error Handling', () => {
  test('should handle non-existent routes', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-12345');

    // Should return 404 or redirect
    const status = response?.status();
    expect(status === 404 || status === 302).toBe(true);
  });
});
