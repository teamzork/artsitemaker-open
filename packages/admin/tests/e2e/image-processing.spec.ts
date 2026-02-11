// packages/admin/tests/e2e/image-processing.spec.ts
import { test, expect } from '@playwright/test';

/**
 * Image Processing E2E Tests
 *
 * Tests core image processing functionality:
 * - Dashboard processing card display
 * - Processing modal functionality
 * - Actual image processing workflow
 * - Toast notifications
 *
 * Note: These tests run serially since they manipulate shared processing state
 */

// Test timeout for processing operations
const PROCESSING_TIMEOUT = 60000; // 1 minute for actual processing

test.describe.serial('Image Processing Dashboard', () => {
  test.setTimeout(PROCESSING_TIMEOUT);

  test('should display image processing card with stats', async ({ page }) => {
    await page.goto('/');

    // Image Processing card should be visible
    const processingCard = page.locator('.card:has-text("Image Processing")');
    await expect(processingCard).toBeVisible();

    // Should show key stats
    await expect(processingCard.getByText('Originals')).toBeVisible();
    await expect(processingCard.getByText('Processed')).toBeVisible();
    await expect(processingCard.getByText('Pending')).toBeVisible();

    // View queue details button should be present
    const viewDetailsBtn = processingCard.getByRole('button', { name: /view queue details/i });
    await expect(viewDetailsBtn).toBeVisible();
  });

  test('should open processing modal and display key information', async ({ page }) => {
    await page.goto('/');

    // Click view queue details
    const viewDetailsBtn = page.getByRole('button', { name: /view queue details/i });
    await viewDetailsBtn.click();

    // Modal should appear
    const modal = page.locator('#processing-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Image Processing Queue' })).toBeVisible();

    // Should show key stats
    await expect(modal.getByText('Originals')).toBeVisible();
    await expect(modal.getByText('Processed', { exact: true })).toBeVisible();
    await expect(modal.getByText('Pending')).toBeVisible();
  });
});

test.describe.serial('Image Processing Workflow', () => {
  test.setTimeout(PROCESSING_TIMEOUT * 2);

  test('should process images and show toast notifications', async ({ page }) => {
    await page.goto('/');

    // Open modal
    await page.getByRole('button', { name: /view queue details/i }).click();
    const modal = page.locator('#processing-modal');
    await expect(modal).toBeVisible();

    // Check if process button is enabled
    const processBtn = modal.locator('#modal-process-btn');
    const isEnabled = await processBtn.isEnabled().catch(() => false);

    if (!isEnabled) {
      test.skip(true, 'No pending images to process');
      return;
    }

    // Click process
    await processBtn.click();

    // Button should show processing state
    await expect(processBtn).toBeDisabled();
    await expect(processBtn).toContainText(/processing/i);

    // Wait for toast notification
    await page.waitForFunction(() => {
      const viewports = Array.from(document.querySelectorAll('ul')).filter(ul => {
        const styles = window.getComputedStyle(ul);
        return styles.position === 'fixed' && 
               (styles.bottom === '0px' || styles.bottom === '0') &&
               (styles.right === '0px' || styles.right === '0');
      });
      return viewports.length > 0;
    }, { timeout: 5000 });

    const toastContainer = page.locator('[role="region"][aria-label*="Notifications"]');
    await expect(async () => {
      const toasts = await toastContainer.locator('[data-state="open"]').all();
      expect(toasts.length).toBeGreaterThan(0);
    }).toPass({ timeout: 30000 });
  });
});

test.describe.serial('Toast Notifications', () => {
  test.setTimeout(PROCESSING_TIMEOUT);

  test('should display toast notifications', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for Toaster component to be ready
    await page.waitForFunction(() => {
      const viewports = Array.from(document.querySelectorAll('ul')).filter(ul => {
        const styles = window.getComputedStyle(ul);
        return styles.position === 'fixed' && 
               (styles.bottom === '0px' || styles.bottom === '0') &&
               (styles.right === '0px' || styles.right === '0');
      });
      return viewports.length > 0;
    }, { timeout: 5000 });

    // Trigger a toast
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('artsitemaker:toast', {
        detail: {
          title: 'Test Toast',
          description: 'This is a test notification',
          variant: 'success'
        }
      }));
    });

    // Toast should appear
    const toast = page.locator('[data-state="open"]').filter({ hasText: 'Test Toast' });
    await expect(toast).toBeVisible();
    await expect(toast.getByText('This is a test notification')).toBeVisible();
  });
});
