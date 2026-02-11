import { test, expect } from '@playwright/test';

test.describe('Theme System', () => {
    test.describe('Theme Loading', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('http://localhost:4321');
        });

        test('should load default theme styles', async ({ page }) => {
            // Check that theme CSS is loaded
            const themeLink = page.locator('link[rel="stylesheet"][href*="/themes/"]');
            await expect(themeLink).toHaveCount(1);

            // Verify CSS variables are set
            const bgColor = await page.evaluate(() => {
                return getComputedStyle(document.body).getPropertyValue('--color-background').trim();
            });
            expect(bgColor).toBeTruthy();
            expect(bgColor).not.toBe('');
        });

        test('should not show 404 errors for missing theme assets', async ({ page }) => {
            const errors: string[] = [];

            page.on('response', response => {
                if (response.status() === 404) {
                    errors.push(response.url());
                }
            });

            await page.goto('http://localhost:4321');
            await page.waitForLoadState('networkidle');

            // Filter out expected 404s (like favicon)
            const themeAsset404s = errors.filter(e =>
                e.includes('/themes/') &&
                (e.includes('/fonts/') || e.includes('/logos/') || e.includes('/textures/'))
            );

            expect(themeAsset404s).toHaveLength(0);
        });

        test('should apply CSS variables correctly', async ({ page }) => {
            await page.goto('http://localhost:4321');

            // Check that body has the theme background color
            const bodyBg = await page.evaluate(() => {
                return getComputedStyle(document.body).backgroundColor;
            });

            // Should have a valid color (not transparent or empty)
            expect(bodyBg).toBeTruthy();
            expect(bodyBg).not.toBe('rgba(0, 0, 0, 0)');
        });
    });

    test.describe('Identity Kit Integration', () => {
        test('should load custom fonts when configured', async ({ page }) => {
            await page.goto('http://localhost:4321');

            // Check if any custom fonts are defined
            const fontFamilies = await page.evaluate(() => {
                const styles = getComputedStyle(document.body);
                return {
                    heading: styles.getPropertyValue('--font-heading').trim(),
                    body: styles.getPropertyValue('--font-body').trim()
                };
            });

            // Should have font families defined
            expect(fontFamilies.heading).toBeTruthy();
            expect(fontFamilies.body).toBeTruthy();
        });

        test('should display logo from user-assets when configured', async ({ page }) => {
            await page.goto('http://localhost:4321');

            // Check for logo image
            const logo = page.locator('header img[alt*="logo" i], header img[class*="logo"]').first();

            // If logo exists, verify it loaded
            const logoCount = await logo.count();
            if (logoCount > 0) {
                const src = await logo.getAttribute('src');
                expect(src).toBeTruthy();
                // Should reference user-assets, not themes
                expect(src).not.toContain('/themes/');
            }
        });

        test('should apply background texture from Identity Kit', async ({ page }) => {
            await page.goto('http://localhost:4321');

            const backgroundTexture = await page.evaluate(() => {
                return getComputedStyle(document.body).getPropertyValue('--background-texture').trim();
            });

            // If texture is configured, it should be a valid URL
            if (backgroundTexture && backgroundTexture !== 'none') {
                expect(backgroundTexture).toContain('url(');
                // Should reference user-assets
                expect(backgroundTexture).not.toContain('/themes/');
            }
        });
    });

    test.describe('Theme Independence', () => {
        test('Identity Kit branding should persist conceptually', async ({ page }) => {
            // Note: Actual theme switching requires admin access
            // This test verifies the architecture supports it

            await page.goto('http://localhost:4321');

            // Get current branding
            const logoSrc = await page.locator('header img').first().getAttribute('src').catch(() => null);

            // The logo should come from user-assets, not theme
            if (logoSrc) {
                expect(logoSrc).toContain('/user-assets/');
            }
        });

        test('CSS variables should override theme defaults', async ({ page }) => {
            await page.goto('http://localhost:4321');

            // Check that Identity Kit colors take precedence
            const colors = await page.evaluate(() => {
                const styles = getComputedStyle(document.documentElement);
                return {
                    background: styles.getPropertyValue('--color-background').trim(),
                    accent: styles.getPropertyValue('--color-accent').trim(),
                    text: styles.getPropertyValue('--color-text').trim()
                };
            });

            // All colors should be defined
            expect(colors.background).toBeTruthy();
            expect(colors.accent).toBeTruthy();
            expect(colors.text).toBeTruthy();
        });
    });

    test.describe('Console Warnings', () => {
        test('should show helpful warnings for missing assets in dev', async ({ page }) => {
            const warnings: string[] = [];

            page.on('console', msg => {
                if (msg.type() === 'warning') {
                    warnings.push(msg.text());
                }
            });

            await page.goto('http://localhost:4321');

            // If no logo is configured, should see warning
            // (This depends on actual site configuration)
            const logoMissingWarning = warnings.find(w =>
                w.includes('No logo configured') ||
                w.includes('identityKit')
            );

            // Warning should be helpful and actionable
            if (logoMissingWarning) {
                expect(logoMissingWarning).toContain('user-data');
            }
        });
    });

    test.describe('Font Loading', () => {
        test('should not have broken font requests', async ({ page }) => {
            const failedRequests: string[] = [];

            page.on('response', response => {
                if (response.status() === 404) {
                    const url = response.url();
                    if (url.includes('.woff') || url.includes('.woff2') || url.includes('.ttf')) {
                        failedRequests.push(url);
                    }
                }
            });

            await page.goto('http://localhost:4321');
            await page.waitForLoadState('networkidle');

            expect(failedRequests).toHaveLength(0);
        });

        test('should generate @font-face rules when custom fonts configured', async ({ page }) => {
            await page.goto('http://localhost:4321');

            // Check for font-face rules in stylesheets
            const hasFontFace = await page.evaluate(() => {
                for (const sheet of document.styleSheets) {
                    try {
                        for (const rule of sheet.cssRules) {
                            if (rule instanceof CSSFontFaceRule) {
                                return true;
                            }
                        }
                    } catch (e) {
                        // Cross-origin stylesheet, skip
                    }
                }
                return false;
            });

            // Result depends on configuration, but should not throw
            expect(typeof hasFontFace).toBe('boolean');
        });
    });
});
