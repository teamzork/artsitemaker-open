import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { PAGE_TYPES } from './pageTypes';
import { getSettingsPath, getThemeConfigPath } from './paths';
import type { ArtSiteMakerContext } from './content';
import { getFontFormat, type ContentFolderFont } from '@artsitemaker/shared';

export interface FontConfig {
    family: string;
    file?: string;
    weight?: number;
    style?: 'normal' | 'italic';
}

export interface IdentityKit {
    backgroundColor?: string;
    accentColor?: string;
    textColor?: string;
    invertedTextColor?: string;
    linkColor?: string;
    fonts?: {
        heading?: string | FontConfig;
        body?: string | FontConfig;
    };
    logo?: {
        file?: string;
        width?: number;
    };
    background?: {
        texture?: string;
        textureMode?: 'tile' | 'stretch' | 'cover';
        useTexture?: boolean;
    };
}

export interface ThemeConfig {
    name: string;
    version?: string;
    author?: string;
    description?: string;
    supported_pages?: string[];  // If omitted, all pages supported
    layout: {
        gallery: 'standard' | 'masonry' | 'justified';
        galleryRowHeight: number;
        galleryGap: number;
        cornerRadius: number;
        maxContentWidth: number;
    };
    colors: {
        background: string;
        backgroundAlt: string;
        text: string;
        textMuted: string;
        accent: string;
        border: string;
        shadow: string;
    };
    fonts: {
        heading: {
            family: string;
            file: string | null;
            weight: number;
            recommendedFont?: string;
        };
        body: {
            family: string;
            file: string | null;
            weight: number;
            recommendedFont?: string;
        };
        mono?: {
            family: string;
            file: string | null;
            weight: number;
            recommendedFont?: string;
        };
    };
    background: {
        type: 'solid' | 'gradient' | 'texture' | 'none';
        texture?: string;
        textureMode?: 'tile' | 'stretch' | 'cover';
        gradient?: string;
        solid?: string;
    };
    galleryItem: {
        border: string;
        borderRadius: number;
        shadow: boolean;
        shadowColor: string;
        shadowBlur: number;
        shadowOffset: [number, number];
        hoverEffect: 'none' | 'lift' | 'glow' | 'zoom';
    };
    carousel: {
        thumbnailShape: 'circle' | 'rounded' | 'square';
        thumbnailSize: number;
        thumbnailBorder: string;
        activeBorder: string;
        gap: number;
        arrowStyle: 'floating' | 'inline' | 'none';
    };
    nav: {
        style: 'pills' | 'underline' | 'minimal';
        position: 'top-left' | 'top-right' | 'top-center' | 'left' | 'right';
        backgroundColor: string;
        activeColor: string;
    };
    logo: {
        file: string | null;
        width: number;
        position: 'top-left' | 'top-right' | 'top-center';
    };
    artworkDetail: {
        imageMaxHeight: string;
        showBorder: boolean;
        metaPosition: 'below' | 'side' | 'overlay';
    };
    footer: {
        backgroundColor: string;
        logo?: string;
        showCredits: boolean;
    };
}

export async function loadIdentityKit(): Promise<IdentityKit> {
    try {
        // Read from identity.yaml directly (not nested under identityKit key)
        const settingsPath = getSettingsPath();
        const settingsDir = path.dirname(settingsPath);
        const identityPath = path.join(settingsDir, 'identity.yaml');
        if (fs.existsSync(identityPath)) {
            const content = fs.readFileSync(identityPath, 'utf-8');
            const parsed = yaml.load(content) as { identityKit?: IdentityKit } | IdentityKit | null;
            if (!parsed) return {};

            // Support both legacy nested identityKit and new root-level structure.
            // If both are present, prefer root-level values with a shallow merge.
            if (typeof parsed === 'object' && 'identityKit' in parsed) {
                const { identityKit, ...root } = parsed as { identityKit?: IdentityKit } & IdentityKit;
                if (identityKit) {
                    return {
                        ...identityKit,
                        ...root,
                        fonts: { ...identityKit.fonts, ...root.fonts },
                        logo: { ...identityKit.logo, ...root.logo },
                        background: { ...identityKit.background, ...root.background }
                    } as IdentityKit;
                }
            }

            return parsed as IdentityKit;
        }
    } catch (e) {
        console.error('Failed to load identity kit:', e);
    }
    return {};
}

/**
 * Loads a theme configuration.
 * 
 * Priority order:
 * 1. globalThis.__ARTSITEMAKER_PREVIEW__?.themeName (preview context override)
 * 2. Provided themeName parameter
 * 
 * @param themeName - The theme name to load (may be overridden by preview context)
 * @returns The parsed ThemeConfig
 * @throws Error if the theme is not found
 */
export async function loadTheme(themeName: string): Promise<ThemeConfig> {
    const effectiveThemeName = globalThis.__ARTSITEMAKER_PREVIEW__?.themeName || themeName;

    try {
        const themePath = getThemeConfigPath(effectiveThemeName);
        if (fs.existsSync(themePath)) {
            const content = fs.readFileSync(themePath, 'utf-8');
            return yaml.load(content) as ThemeConfig;
        }
    } catch (e) {
        console.error(`Failed to load theme '${effectiveThemeName}':`, e);
    }

    throw new Error(`Theme '${effectiveThemeName}' not found`);
}

/**
 * Get the list of pages supported by a theme.
 * If theme doesn't specify supported_pages, all pages are supported.
 */
export function getThemeSupportedPages(theme: ThemeConfig): string[] {
    if (theme.supported_pages && theme.supported_pages.length > 0) {
        return theme.supported_pages;
    }
    // If not specified, theme supports all page types
    return PAGE_TYPES.map(p => p.id);
}

export function generateCSSVariables(theme: ThemeConfig, identityKit?: IdentityKit): string {
    // Identity Kit values override theme defaults
    const backgroundColor = identityKit?.backgroundColor || theme.colors?.background || '#4a4a4a';
    const accentColor = identityKit?.accentColor || theme.colors?.accent || '#efb600';
    const textColor = identityKit?.textColor || theme.colors?.text || '#e0e0e0';
    const invertedTextColor = identityKit?.invertedTextColor || theme.colors?.textMuted || '#a0a0a0';
    const linkColor = identityKit?.linkColor || accentColor;
    const headingFont = getFontFamily(identityKit?.fonts?.heading, theme.fonts?.heading?.family || 'sans-serif');
    const bodyFont = getFontFamily(identityKit?.fonts?.body, theme.fonts?.body?.family || 'sans-serif');

    const shadowValue = theme.galleryItem?.shadow
        ? `${theme.galleryItem.shadowOffset?.[0] || 2}px ${theme.galleryItem.shadowOffset?.[1] || 2}px ${theme.galleryItem.shadowBlur || 8}px ${theme.galleryItem.shadowColor || 'rgba(0,0,0,0.4)'}`
        : 'none';

    // Background texture from Identity Kit only (themes have no embedded assets)
    let backgroundVars = '';
    const useTexture = identityKit?.background?.useTexture !== false;
    if (useTexture && identityKit?.background?.texture) {
        const mode = identityKit.background.textureMode || 'tile';
        const texturePath = identityKit.background.texture;

        // Support absolute URLs, relative paths, or user-assets paths
        const textureUrl = texturePath.startsWith('http') || texturePath.startsWith('/')
            ? texturePath
            : `/user-assets/${texturePath}`;

        backgroundVars = `
      --background-texture: url('${textureUrl}');
      --background-repeat: ${mode === 'tile' ? 'repeat' : 'no-repeat'};
      --background-size: ${mode === 'cover' ? 'cover' : mode === 'stretch' ? '100% 100%' : 'auto'};
    `;
    }

    // Logo from Identity Kit only (themes no longer provide logos)
    const logoWidth = identityKit?.logo?.width || theme.logo?.width || 126;

    return `
    :root {
      /* Colors - Identity Kit overrides */
      --color-background: ${backgroundColor};
      --color-background-alt: ${theme.colors?.backgroundAlt || '#3a3a3a'};
      --color-text: ${textColor};
      --color-text-inverted: ${invertedTextColor};
      --color-text-muted: ${theme.colors?.textMuted || '#a0a0a0'};
      --color-accent: ${accentColor};
      --color-border: ${theme.colors?.border || '#333333'};
      --color-shadow: ${theme.colors?.shadow || 'rgba(0,0,0,0.3)'};
      
      /* Links - Identity Kit overrides */
      --color-link: ${linkColor};
      --color-link-hover: ${accentColor};
      --color-link-visited: ${textColor};
      
      /* Layout */
      --gallery-gap: ${theme.layout?.galleryGap || 10}px;
      --gallery-row-height: ${theme.layout?.galleryRowHeight || 200}px;
      --corner-radius: ${theme.layout?.cornerRadius || 12}px;
      --max-content-width: ${theme.layout?.maxContentWidth || 1400}px;
      
      /* Typography - Identity Kit overrides */
      --font-heading: ${needsQuoting(headingFont) ? `"${headingFont}"` : headingFont}, sans-serif;
      --font-body: ${needsQuoting(bodyFont) ? `"${bodyFont}"` : bodyFont}, sans-serif;
      
      /* Gallery Items */
      --item-border: ${theme.galleryItem?.border || '1px solid #333'};
      --item-shadow: ${shadowValue};
      
      /* Carousel */
      --carousel-thumb-size: ${theme.carousel?.thumbnailSize || 80}px;
      --carousel-thumb-border: ${theme.carousel?.thumbnailBorder || '3px solid #666'};
      --carousel-thumb-active: ${theme.carousel?.activeBorder || '3px solid #efb600'};
      --carousel-gap: ${theme.carousel?.gap || 12}px;
      --carousel-thumb-radius: ${theme.carousel?.thumbnailShape === 'circle' ? '50%' : theme.carousel?.thumbnailShape === 'rounded' ? '12px' : '0'};
      
      /* Logo - Identity Kit overrides */
      --logo-width: ${logoWidth}px;
      
      ${backgroundVars}
    }
  `;
}

/**
 * Extract font family name from IdentityKit font config
 * Handles both string and object formats
 */
function getFontFamily(fontConfig: string | FontConfig | undefined, fallback: string): string {
    if (!fontConfig) return fallback;
    if (typeof fontConfig === 'string') return fontConfig;
    return fontConfig.family || fallback;
}

/**
 * Determines if a font family value needs quoting in CSS
 * Don't quote if it contains commas (multi-font stack like "Arial, sans-serif")
 */
function needsQuoting(fontFamily: string): boolean {
    const normalized = fontFamily.trim();
    if (!normalized) return false;
    if (normalized.includes(',')) return false;
    if (
        (normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
        return false;
    }
    return true;
}



/**
 * Generate @font-face declarations from Identity Kit font configuration.
 * Enables dynamic font loading from user-data/assets/fonts/
 *
 * Priority: Identity Kit fonts > Theme fonts (fallback)
 *
 * @param identityKit - User's identity kit configuration
 * @param contentFolderFonts - Available Content Folder fonts for lookup
 * @returns CSS string with @font-face declarations
 */
export function generateFontFaces(
    identityKit: IdentityKit,
    contentFolderFonts: ContentFolderFont[] = []
): string {
    let css = '';

    // Heading font
    if (identityKit.fonts?.heading) {
        const heading = identityKit.fonts.heading;

        // Check if it's the new object format with a file
        if (typeof heading === 'object' && heading.file) {
            const fontFormat = getFontFormat(heading.file);

            css += `
@font-face {
  font-family: "${heading.family}";
  src: url('/user-assets/${heading.file}') format('${fontFormat}');
  font-weight: ${heading.weight || 700};
  font-style: ${heading.style || 'normal'};
  font-display: swap;
}
            `.trim() + '\n\n';
        }
        // NEW: Handle string format by looking up in Content Folder fonts
        else if (typeof heading === 'string') {
            const match = contentFolderFonts.find(f => f.displayName === heading);
            if (match) {
                const fontFormat = getFontFormat(match.file);
                css += `
@font-face {
  font-family: "${heading}";
  src: url('/user-assets/fonts/${match.file}') format('${fontFormat}');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
            `.trim() + '\n\n';
            }
        }
    }

    // Body font
    if (identityKit.fonts?.body) {
        const body = identityKit.fonts.body;

        // Check if it's the new object format with a file
        if (typeof body === 'object' && body.file) {
            const fontFormat = getFontFormat(body.file);

            css += `
@font-face {
  font-family: "${body.family}";
  src: url('/user-assets/${body.file}') format('${fontFormat}');
  font-weight: ${body.weight || 400};
  font-style: ${body.style || 'normal'};
  font-display: swap;
}
            `.trim() + '\n\n';
        }
        // NEW: Handle string format by looking up in Content Folder fonts
        else if (typeof body === 'string') {
            const match = contentFolderFonts.find(f => f.displayName === body);
            if (match) {
                const fontFormat = getFontFormat(match.file);
                css += `
@font-face {
  font-family: "${body}";
  src: url('/user-assets/fonts/${match.file}') format('${fontFormat}');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
            `.trim() + '\n\n';
            }
        }
    }

    return css;
}
