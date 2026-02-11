// packages/admin/tests/e2e/gallery-save-button-dirty.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Gallery detail form dirty detection', () => {
  test('enables Save button after field edits and Toggle changes', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
    });

    // Capture whether the gallery page attaches input/change listeners to the form.
    await page.addInitScript(() => {
      (window as any).__listenerLog = [];
      const originalAdd = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (
        type: any,
        listener: any,
        options?: any
      ) {
        try {
          const el = this as any;
          if (el && el.id === 'artwork-form' && (type === 'input' || type === 'change')) {
            (window as any).__listenerLog.push({ id: el.id, type });
          }
        } catch {}
        return originalAdd.call(this, type, listener, options);
      };
    });

    await page.goto(
      '/gallery/dall-e-2023-10-27-22-08-22-movie-poster-for-cute-inferno-the-central-figure-is-t'
    );

    // Surface browser errors that would prevent our script from running.
    // Ignore noisy resource 404s (favicons, dev assets) since they don't affect form behavior.
    const relevantErrors = pageErrors.filter(
      (e) =>
        !e.includes('Failed to load resource') &&
        !e.includes('the server responded with a status of 404')
    );
    expect(relevantErrors.join('\n')).toBe('');

    // Ensure our form listeners were attached by the app code (may happen slightly after load)
    await page.waitForFunction(
      () => (window as any).__listenerLog?.some((x: any) => x.type === 'input'),
      null,
      { timeout: 5000 }
    );
    await page.waitForFunction(
      () => (window as any).__listenerLog?.some((x: any) => x.type === 'change'),
      null,
      { timeout: 5000 }
    );

    const saveBtn = page.locator('#save-btn');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeDisabled();

    // Wait for the app to finish initializing change detection (avoids baseline-capture races).
    await expect(page.locator('#artwork-form')).toHaveAttribute('data-change-detector-ready', 'true');

    // 1) Text input change should enable save
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible();
    await titleInput.focus();
    await titleInput.press('End');
    await titleInput.type(' ');
    await expect(saveBtn).toBeEnabled();

    // Reset by reloading to test toggles independently (simpler + deterministic)
    await page.reload();
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeDisabled();
    await expect(page.locator('#artwork-form')).toHaveAttribute('data-change-detector-ready', 'true');

    // 2) Toggle click should enable save
    // NOTE: `published` is excluded from dirty tracking (it auto-saves independently),
    // so we toggle a tracked field instead.
    await page.getByRole('button', { name: /^Sold$/ }).click();
    await expect(saveBtn).toBeEnabled();
  });
});

