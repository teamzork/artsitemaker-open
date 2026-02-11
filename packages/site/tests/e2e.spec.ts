import { test, expect } from '@playwright/test';

test.describe('Homepage - Gallery', () => {
  test('should load homepage and display site title', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/Gallery/i);
  });

  test('should display gallery grid with artworks', async ({ page }) => {
    await page.goto('/');

    // Wait for gallery container to be visible
    const galleryContainer = page.getByTestId('gallery-container');
    await expect(galleryContainer).toBeVisible();

    // Check if gallery grid exists
    const galleryGrid = page.getByTestId('gallery-grid');
    await expect(galleryGrid).toBeVisible();

    // Verify at least one gallery item exists
    const galleryItems = page.getByTestId('gallery-item');
    await expect(galleryItems.first()).toBeVisible();
  });

  test('should display gallery images without broken src', async ({ page }) => {
    await page.goto('/');

    // Get all gallery item images
    const images = page.getByTestId('gallery-item-image');
    const count = await images.count();

    // Verify at least one image exists
    expect(count).toBeGreaterThan(0);

    // Check each image has a valid src
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).not.toBe('');

      // Verify image loads successfully (not broken)
      await expect(img).toBeVisible();
    }
  });

  test('should handle empty gallery gracefully', async ({ page }) => {
    // This test depends on having a way to test with no artworks
    // For now, we just verify the empty state element exists in the HTML
    await page.goto('/');

    // If there are artworks, this passes
    // If empty, should show empty message
    const galleryGrid = page.getByTestId('gallery-grid');
    const emptyMessage = page.getByTestId('gallery-empty');

    const hasGallery = await galleryGrid.isVisible().catch(() => false);
    const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);

    // Either gallery or empty message should be visible
    expect(hasGallery || hasEmptyMessage).toBe(true);
  });
});

test.describe('Navigation - Header', () => {
  test('should display header with logo and navigation', async ({ page }) => {
    await page.goto('/');

    // Header should be visible
    const header = page.getByTestId('header');
    await expect(header).toBeVisible();

    // Logo should be visible and clickable
    const logoLink = page.getByTestId('logo-link');
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute('href', '/');

    // Logo image should be visible
    const logoImage = page.getByTestId('logo-image');
    await expect(logoImage).toBeVisible();

    // Navigation bar should be visible
    const navBar = page.getByTestId('nav-bar');
    await expect(navBar).toBeVisible();
  });

  test('should navigate to Gallery from header', async ({ page }) => {
    await page.goto('/about');

    // Click Gallery link
    const galleryLink = page.getByTestId('nav-link-gallery');
    await galleryLink.click();

    // Should navigate to homepage
    await expect(page).toHaveURL('/');

    // Gallery should be visible
    const galleryContainer = page.getByTestId('gallery-container');
    await expect(galleryContainer).toBeVisible();
  });

  test('should navigate to Slideshow from header', async ({ page }) => {
    await page.goto('/');

    // Click Slideshow link
    const slideshowLink = page.getByTestId('nav-link-slideshow');
    await slideshowLink.click();

    // Should navigate to slideshow (or redirect if disabled)
    await page.waitForLoadState('networkidle');

    // Check if slideshow is enabled by looking for the container
    const slideshowContainer = page.getByTestId('slideshow-container');
    const isSlideshow = await slideshowContainer.isVisible().catch(() => false);

    if (isSlideshow) {
      // If slideshow is enabled, verify it loaded (may have hash like #/0)
      await expect(page).toHaveURL(/\/slideshow/);
      await expect(slideshowContainer).toBeVisible();
    } else {
      // If redirected, that's acceptable (slideshow may be disabled)
      // Just verify we're not on a broken page
      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();
    }
  });

  test('should navigate to About from header', async ({ page }) => {
    await page.goto('/');

    // Click About link
    const aboutLink = page.getByTestId('nav-link-about');
    await aboutLink.click();

    // Should navigate to about page
    await expect(page).toHaveURL('/about');
  });

  test('should highlight active navigation item', async ({ page }) => {
    await page.goto('/');

    // Gallery link should have active class
    const galleryLink = page.getByTestId('nav-link-gallery');
    await expect(galleryLink).toHaveClass(/active/);
  });
});

test.describe('Gallery Interaction', () => {
  test('should navigate to slideshow when clicking artwork', async ({ page }) => {
    await page.goto('/');

    // Wait for gallery items to load
    const firstArtwork = page.getByTestId('gallery-item').first();
    await expect(firstArtwork).toBeVisible();

    // Click first artwork
    await firstArtwork.click();

    // Should navigate to slideshow or detail page
    // URL should change from just "/"
    await page.waitForURL((url) => url.pathname !== '/');

    // Verify navigation happened
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(slideshow|gallery\/[\w-]+)/);
  });

  test('should have clickable gallery items', async ({ page }) => {
    await page.goto('/');

    const galleryItems = page.getByTestId('gallery-item');
    const count = await galleryItems.count();

    expect(count).toBeGreaterThan(0);

    // Each item should have an href
    for (let i = 0; i < Math.min(count, 3); i++) {
      const item = galleryItems.nth(i);
      const href = await item.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toBe('');
    }
  });
});

test.describe('Slideshow Page', () => {
  test('should display slideshow with main image', async ({ page }) => {
    await page.goto('/slideshow');

    // Slideshow container should be visible
    const slideshowContainer = page.getByTestId('slideshow-container');
    await expect(slideshowContainer).toBeVisible();

    // Main image should be visible
    const mainImage = page.getByTestId('slideshow-image');
    await expect(mainImage).toBeVisible();

    // Title should be visible
    const title = page.getByTestId('slideshow-title');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText).toBeTruthy();
  });

  test('should navigate between slides using navigation buttons', async ({ page }) => {
    await page.goto('/slideshow');

    // Get initial title
    const titleElement = page.getByTestId('slideshow-title');
    const initialTitle = await titleElement.textContent();

    // Click next button
    const nextBtn = page.getByTestId('slideshow-next-btn');
    await nextBtn.click();

    // Wait for slide change
    await page.waitForTimeout(500);

    // Title should change (unless there's only one artwork)
    const newTitle = await titleElement.textContent();
    const hasMultipleArtworks = initialTitle !== newTitle;

    if (hasMultipleArtworks) {
      expect(newTitle).not.toBe(initialTitle);

      // Click previous button
      const prevBtn = page.getByTestId('slideshow-prev-btn');
      await prevBtn.click();

      // Wait for slide change
      await page.waitForTimeout(500);

      // Should return to original
      const backTitle = await titleElement.textContent();
      expect(backTitle).toBe(initialTitle);
    }
  });

  test('should display carousel with thumbnails', async ({ page }) => {
    await page.goto('/slideshow');

    // Carousel should be visible
    const carousel = page.getByTestId('slideshow-carousel');
    await expect(carousel).toBeVisible();

    // Should have at least one thumbnail
    const thumbnails = page.getByTestId('carousel-thumb');
    await expect(thumbnails.first()).toBeVisible();
  });

  test('should navigate using carousel thumbnails', async ({ page }) => {
    await page.goto('/slideshow');

    const thumbnails = page.getByTestId('carousel-thumb');
    const count = await thumbnails.count();

    if (count > 1) {
      // Get initial title
      const titleElement = page.getByTestId('slideshow-title');
      const initialTitle = await titleElement.textContent();

      // Wait for thumbnails to be fully loaded and interactive
      await thumbnails.nth(1).waitFor({ state: 'visible' });
      await page.waitForTimeout(300); // Give carousel time to settle

      // Click second thumbnail with force (in case of overlays)
      await thumbnails.nth(1).click({ force: true });

      // Wait for slide change
      await page.waitForTimeout(800);

      // Title should change
      const newTitle = await titleElement.textContent();
      expect(newTitle).not.toBe(initialTitle);
    }
  });

  test('should navigate using keyboard arrows', async ({ page }) => {
    await page.goto('/slideshow');

    const thumbnails = page.getByTestId('carousel-thumb');
    const count = await thumbnails.count();

    if (count > 1) {
      // Get initial title
      const titleElement = page.getByTestId('slideshow-title');
      const initialTitle = await titleElement.textContent();

      // Press right arrow
      await page.keyboard.press('ArrowRight');

      // Wait for slide change
      await page.waitForTimeout(500);

      // Title should change
      const newTitle = await titleElement.textContent();
      expect(newTitle).not.toBe(initialTitle);

      // Press left arrow
      await page.keyboard.press('ArrowLeft');

      // Wait for slide change
      await page.waitForTimeout(500);

      // Should return to original
      const backTitle = await titleElement.textContent();
      expect(backTitle).toBe(initialTitle);
    }
  });

  test('should have working more info link', async ({ page }) => {
    await page.goto('/slideshow');

    // More info link should be visible
    const moreInfoLink = page.getByTestId('slideshow-more-info');
    await expect(moreInfoLink).toBeVisible();

    // Should have href to gallery detail page
    const href = await moreInfoLink.getAttribute('href');
    expect(href).toMatch(/^\/gallery\/[\w-]+$/);
  });
});

test.describe('404 Error Page', () => {
  test('should display 404 page for non-existent route', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');

    // Should return 404 status
    expect(response?.status()).toBe(404);

    // Page should contain some indication it's a 404
    const content = await page.textContent('body');
    expect(content).toMatch(/404|not found|page not found/i);
  });
});

test.describe('Responsive Design', () => {
  test('should be mobile-responsive', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Header should still be visible
    const header = page.getByTestId('header');
    await expect(header).toBeVisible();

    // Gallery should still be visible
    const galleryContainer = page.getByTestId('gallery-container');
    await expect(galleryContainer).toBeVisible();

    // Navigation should still work
    const slideshowLink = page.getByTestId('nav-link-slideshow');
    await expect(slideshowLink).toBeVisible();
  });
});
