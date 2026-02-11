/**
 * ArtSiteMaker Content Context
 *
 * Provides a global context interface for preview mode to override content paths.
 * This enables the admin panel to render previews with alternate content/themes.
 */

/**
 * Global context for ArtSiteMaker preview mode.
 * When set, overrides default content and theme resolution paths.
 */
export interface ArtSiteMakerContext {
    /** Override path to user data directory (new, preferred) */
    userDataPath?: string;
    /** Override path to content directory (deprecated, use userDataPath) */
    contentPath?: string;
    /** Override theme name to use */
    themeName?: string;
    /** Override image base URL for serving images */
    imageBaseUrl?: string;
    /** Override user assets base URL (new, preferred) */
    userAssetsBaseUrl?: string;
    /** Override content assets base URL (deprecated, use userAssetsBaseUrl) */
    contentAssetsBaseUrl?: string;
    /** Current mode: 'production' | 'preview' | 'demo' */
    mode?: 'production' | 'preview' | 'demo';
}

declare global {
    /**
     * Global preview context set by admin panel for demo/preview rendering.
     * When defined, content and theme resolution functions check this first.
     */
    var __ARTSITEMAKER_PREVIEW__: ArtSiteMakerContext | undefined;
}

export {};
