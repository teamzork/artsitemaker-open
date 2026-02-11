/**
 * Asset Checker Utility
 * Validates Identity Kit configuration and provides helpful error messages
 */

import type { IdentityKit } from './theme';

export interface AssetCheckResult {
    hasLogo: boolean;
    hasBackgroundTexture: boolean;
    hasCustomFonts: boolean;
    warnings: string[];
}

/**
 * Check Identity Kit for required and optional assets
 */
export function checkIdentityKitAssets(identityKit: IdentityKit): AssetCheckResult {
    const warnings: string[] = [];

    // Check logo
    const hasLogo = !!(identityKit.logo?.file);
    if (!hasLogo) {
        warnings.push(
            'No logo configured. Add to user-data/assets/logos/ and set:\n' +
            '  identityKit.logo.file: "logos/my-logo.svg"'
        );
    }

    // Check background texture (optional)
    const hasBackgroundTexture = !!(identityKit.background?.texture);

    // Check fonts (optional)
    const hasCustomFonts = !!(
        (typeof identityKit.fonts?.heading === 'object' && identityKit.fonts.heading.file) ||
        (typeof identityKit.fonts?.body === 'object' && identityKit.fonts.body.file)
    );

    return {
        hasLogo,
        hasBackgroundTexture,
        hasCustomFonts,
        warnings
    };
}

/**
 * Get helpful setup message for new users
 */
export function getSetupMessage(): string {
    return `
🎨 ArtSiteMaker Setup Reminder
───────────────────────────────────────────────────

Your site is using system fonts and no logo. To customize:

1. Add your logo:
   - Place in: user-data/assets/logos/
   - Configure: identityKit.logo.file

2. Add custom fonts (optional):
   - Place in: user-data/assets/fonts/
   - Configure: identityKit.fonts.heading/body

3. Add background texture (optional):
   - Place in: user-data/assets/textures/
   - Configure: identityKit.background.texture

Need help? Run: pnpm migrate:theme-assets
───────────────────────────────────────────────────
`.trim();
}
