import { describe, it, expect, vi } from 'vitest';
import {
    generateFontFaces,
    generateCSSVariables,
    getThemeSupportedPages
} from '../src/lib/theme';
import type { IdentityKit, ThemeConfig } from '../src/lib/theme';
import { getFontFormat, type ContentFolderFont } from '@artsitemaker/shared';

// Mock fs and yaml for testing
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => ''),
    }
}));

vi.mock('js-yaml', () => ({
    default: {
        load: vi.fn(() => ({}))
    }
}));

// Mock theme for testing
const mockTheme: ThemeConfig = {
    name: 'Test Theme',
    layout: {
        gallery: 'justified',
        galleryRowHeight: 200,
        galleryGap: 10,
        cornerRadius: 8,
        maxContentWidth: 1400
    },
    colors: {
        background: '#ffffff',
        backgroundAlt: '#f0f0f0',
        text: '#000000',
        textMuted: '#666666',
        accent: '#0066cc',
        border: '#cccccc',
        shadow: 'rgba(0,0,0,0.1)'
    },
    fonts: {
        heading: { family: 'sans-serif', file: null, weight: 700 },
        body: { family: 'sans-serif', file: null, weight: 400 }
    },
    background: {
        type: 'solid',
        solid: '#ffffff'
    },
    galleryItem: {
        border: '1px solid #ccc',
        borderRadius: 8,
        shadow: false,
        shadowColor: 'rgba(0,0,0,0)',
        shadowBlur: 0,
        shadowOffset: [0, 0],
        hoverEffect: 'none'
    },
    carousel: {
        thumbnailShape: 'square',
        thumbnailSize: 80,
        thumbnailBorder: '2px solid #ccc',
        activeBorder: '2px solid #000',
        gap: 12,
        arrowStyle: 'floating'
    },
    nav: {
        style: 'minimal',
        position: 'top-right',
        backgroundColor: '#ffffff',
        activeColor: '#0066cc'
    },
    logo: {
        file: null,
        width: 126,
        position: 'top-left'
    },
    artworkDetail: {
        imageMaxHeight: '80vh',
        showBorder: true,
        metaPosition: 'below'
    },
    footer: {
        backgroundColor: '#f0f0f0',
        showCredits: true
    }
};

describe('getFontFormat', () => {
    it('should return woff2 for .woff2 files', () => {
        expect(getFontFormat('fonts/test.woff2')).toBe('woff2');
    });

    it('should return woff for .woff files', () => {
        expect(getFontFormat('fonts/test.woff')).toBe('woff');
    });

    it('should return truetype for .ttf files', () => {
        expect(getFontFormat('fonts/test.ttf')).toBe('truetype');
    });

    it('should return truetype for unknown extensions', () => {
        expect(getFontFormat('fonts/test.xyz')).toBe('truetype');
    });
});

describe('generateFontFaces', () => {
    const mockContentFolderFonts: ContentFolderFont[] = [
        { displayName: 'Aziu-Black', file: 'Aziu-Black.woff2' },
        { displayName: 'DimkaSans', file: 'DimkaSans-Regular.woff2' }
    ];

    it('should generate @font-face for heading font with file', () => {
        const identityKit: IdentityKit = {
            fonts: {
                heading: {
                    family: 'CustomHeading',
                    file: 'fonts/heading.woff2',
                    weight: 700
                }
            }
        };

        const result = generateFontFaces(identityKit);

        expect(result).toContain('@font-face');
        expect(result).toContain('font-family: "CustomHeading"');
        expect(result).toContain("url('/user-assets/fonts/heading.woff2')");
        expect(result).toContain('font-weight: 700');
        expect(result).toContain('font-display: swap');
    });

    it('should generate @font-face for body font with file', () => {
        const identityKit: IdentityKit = {
            fonts: {
                body: {
                    family: 'CustomBody',
                    file: 'fonts/body.woff2',
                    weight: 400
                }
            }
        };

        const result = generateFontFaces(identityKit);

        expect(result).toContain('CustomBody');
        expect(result).toContain('fonts/body.woff2');
        expect(result).toContain('font-weight: 400');
    });

    it('should handle both heading and body fonts', () => {
        const identityKit: IdentityKit = {
            fonts: {
                heading: {
                    family: 'HeadingFont',
                    file: 'fonts/heading.woff2',
                    weight: 900
                },
                body: {
                    family: 'BodyFont',
                    file: 'fonts/body.woff2',
                    weight: 400
                }
            }
        };

        const result = generateFontFaces(identityKit);

        // Should have two @font-face blocks
        const fontFaceCount = (result.match(/@font-face/g) || []).length;
        expect(fontFaceCount).toBe(2);

        expect(result).toContain('HeadingFont');
        expect(result).toContain('HeadingFont');
        expect(result).toContain('BodyFont');
    });

    it('should look up Content Folder fonts by name (string format)', () => {
        const identityKit: IdentityKit = {
            fonts: {
                heading: 'Aziu-Black',
                body: 'DimkaSans'
            }
        };

        const result = generateFontFaces(identityKit, mockContentFolderFonts);

        // Should generate @font-face for matching fonts
        expect(result).toContain('font-family: "Aziu-Black"');
        expect(result).toContain("url('/user-assets/fonts/Aziu-Black.woff2')");
        
        expect(result).toContain('font-family: "DimkaSans"');
        expect(result).toContain("url('/user-assets/fonts/DimkaSans-Regular.woff2')");
    });

    it('should not generate fonts for string format (backward compat)', () => {
        const identityKit: IdentityKit = {
            fonts: {
                heading: 'Arial',
                body: 'Helvetica'
            }
        };

        const result = generateFontFaces(identityKit);
        expect(result).toBe('');
    });

    it('should handle missing fonts property gracefully', () => {
        const identityKit: IdentityKit = {};
        const result = generateFontFaces(identityKit);
        expect(result).toBe('');
    });

    it('should handle object format without file', () => {
        const identityKit: IdentityKit = {
            fonts: {
                heading: {
                    family: 'SystemFont',
                    weight: 700
                    // No file property
                }
            }
        };

        const result = generateFontFaces(identityKit);
        expect(result).toBe('');
    });

    it('should detect font format correctly', () => {
        const woff2Kit: IdentityKit = {
            fonts: {
                heading: {
                    family: 'Test',
                    file: 'fonts/test.woff2',
                    weight: 700
                }
            }
        };

        const woffKit: IdentityKit = {
            fonts: {
                heading: {
                    family: 'Test',
                    file: 'fonts/test.woff',
                    weight: 700
                }
            }
        };

        const ttfKit: IdentityKit = {
            fonts: {
                heading: {
                    family: 'Test',
                    file: 'fonts/test.ttf',
                    weight: 700
                }
            }
        };

        expect(generateFontFaces(woff2Kit)).toContain("format('woff2')");
        expect(generateFontFaces(woffKit)).toContain("format('woff')");
        expect(generateFontFaces(ttfKit)).toContain("format('truetype')");
    });

    it('should use default weights when not specified', () => {
        const identityKit: IdentityKit = {
            fonts: {
                heading: {
                    family: 'Heading',
                    file: 'fonts/heading.woff2'
                    // No weight specified
                },
                body: {
                    family: 'Body',
                    file: 'fonts/body.woff2'
                    // No weight specified
                }
            }
        };

        const result = generateFontFaces(identityKit);

        // Heading defaults to 700, body defaults to 400
        expect(result).toContain('font-weight: 700');
        expect(result).toContain('font-weight: 400');
    });

    it('should handle italic style', () => {
        const identityKit: IdentityKit = {
            fonts: {
                heading: {
                    family: 'ItalicFont',
                    file: 'fonts/italic.woff2',
                    weight: 400,
                    style: 'italic'
                }
            }
        };

        const result = generateFontFaces(identityKit);
        expect(result).toContain('font-style: italic');
    });
});

describe('generateCSSVariables', () => {
    it('should generate CSS variables from theme', () => {
        const result = generateCSSVariables(mockTheme);

        expect(result).toContain(':root {');
        expect(result).toContain('--color-background: #ffffff');
        expect(result).toContain('--color-accent: #0066cc');
        expect(result).toContain('--gallery-gap: 10px');
        expect(result).toContain('--corner-radius: 8px');
    });

    it('should prefer Identity Kit colors over theme', () => {
        const identityKit: IdentityKit = {
            backgroundColor: '#000000',
            accentColor: '#ff0000',
            textColor: '#ffffff'
        };

        const result = generateCSSVariables(mockTheme, identityKit);

        expect(result).toContain('--color-background: #000000');
        expect(result).toContain('--color-accent: #ff0000');
        expect(result).toContain('--color-text: #ffffff');
    });

    it('should include background texture from Identity Kit', () => {
        const identityKit: IdentityKit = {
            background: {
                texture: 'textures/bg.jpg',
                textureMode: 'tile'
            }
        };

        const result = generateCSSVariables(mockTheme, identityKit);

        expect(result).toContain("--background-texture: url('/user-assets/textures/bg.jpg')");
        expect(result).toContain('--background-repeat: repeat');
    });

    it('should omit background texture when disabled in Identity Kit', () => {
        const identityKit: IdentityKit = {
            background: {
                texture: 'textures/bg.jpg',
                textureMode: 'tile',
                useTexture: false
            }
        };

        const result = generateCSSVariables(mockTheme, identityKit);

        expect(result).not.toContain('--background-texture');
        expect(result).not.toContain('--background-repeat');
    });

    it('should not include theme textures (pure theme architecture)', () => {
        const themeWithTexture: ThemeConfig = {
            ...mockTheme,
            background: {
                type: 'texture',
                texture: 'textures/theme-bg.jpg',
                textureMode: 'tile'
            }
        };

        const result = generateCSSVariables(themeWithTexture);

        // Should not reference theme assets
        expect(result).not.toContain('/themes/');
        expect(result).not.toContain('theme-bg.jpg');
    });

    it('should handle missing Identity Kit gracefully', () => {
        const result = generateCSSVariables(mockTheme);
        expect(result).toBeTruthy();
        expect(result).toContain(':root {');
    });

    it('should use theme logo width as default', () => {
        const themeWithLogoWidth: ThemeConfig = {
            ...mockTheme,
            logo: { file: null, width: 200, position: 'top-left' }
        };

        const result = generateCSSVariables(themeWithLogoWidth);
        expect(result).toContain('--logo-width: 200px');
    });

    it('should prefer Identity Kit logo width', () => {
        const identityKit: IdentityKit = {
            logo: { file: 'logos/my-logo.png', width: 150 }
        };

        const result = generateCSSVariables(mockTheme, identityKit);
        expect(result).toContain('--logo-width: 150px');
    });

    it('should handle absolute URLs for textures', () => {
        const identityKit: IdentityKit = {
            background: {
                texture: 'https://cdn.example.com/texture.jpg',
                textureMode: 'cover'
            }
        };

        const result = generateCSSVariables(mockTheme, identityKit);
        expect(result).toContain('https://cdn.example.com/texture.jpg');
        expect(result).not.toContain('/user-assets/');
    });

    it('should use custom fonts from Identity Kit', () => {
        const identityKit: IdentityKit = {
            fonts: {
                heading: 'CustomHeading',
                body: 'CustomBody'
            }
        };

        const result = generateCSSVariables(mockTheme, identityKit);
        expect(result).toContain('--font-heading: "CustomHeading", sans-serif');
        expect(result).toContain('--font-body: "CustomBody", sans-serif');
    });

    it('should not double-quote fonts with commas (multi-font stack)', () => {
        const identityKit: IdentityKit = {
            fonts: {
                heading: 'Arial, sans-serif',
                body: 'Helvetica, Arial, sans-serif'
            }
        };

        const result = generateCSSVariables(mockTheme, identityKit);
        
        // Should NOT be: "Arial, sans-serif", sans-serif
        expect(result).toContain('--font-heading: Arial, sans-serif, sans-serif');
        expect(result).toContain('--font-body: Helvetica, Arial, sans-serif, sans-serif');
        expect(result).not.toContain('"Arial, sans-serif"');
    });
});

describe('getThemeSupportedPages', () => {
    it('should return all pages when supported_pages is not specified', () => {
        const result = getThemeSupportedPages(mockTheme);
        expect(result.length).toBeGreaterThan(0);
        expect(result).toContain('home');
        expect(result).toContain('gallery');
    });

    it('should return specified pages when supported_pages is defined', () => {
        const themeWithPages: ThemeConfig = {
            ...mockTheme,
            supported_pages: ['home', 'gallery', 'about']
        };

        const result = getThemeSupportedPages(themeWithPages);
        expect(result).toEqual(['home', 'gallery', 'about']);
    });

    it('should return all pages when supported_pages is empty array', () => {
        const themeWithEmptyPages: ThemeConfig = {
            ...mockTheme,
            supported_pages: []
        };

        const result = getThemeSupportedPages(themeWithEmptyPages);
        expect(result.length).toBeGreaterThan(0);
    });
});

describe('Pure Theme Architecture', () => {
    it('should not reference theme assets in CSS variables', () => {
        const identityKit: IdentityKit = {};
        const css = generateCSSVariables(mockTheme, identityKit);

        // Should not contain theme asset paths
        expect(css).not.toContain('/themes/');
        expect(css).not.toContain('./assets/');
    });

    it('should handle null logo gracefully', () => {
        const themeWithNullLogo: ThemeConfig = {
            ...mockTheme,
            logo: { file: null, width: 140, position: 'top-center' }
        };

        const identityKit: IdentityKit = {};
        const css = generateCSSVariables(themeWithNullLogo, identityKit);
        expect(css).toBeTruthy();
        expect(css).toContain('--logo-width: 140px');
    });

    it('should use system fonts when no custom fonts provided', () => {
        const themeWithSystemFonts: ThemeConfig = {
            ...mockTheme,
            fonts: {
                heading: { family: 'sans-serif', file: null, weight: 700 },
                body: { family: 'sans-serif', file: null, weight: 400 }
            }
        };

        const css = generateCSSVariables(themeWithSystemFonts);
        expect(css).toContain('--font-heading: "sans-serif", sans-serif');
        expect(css).toContain('--font-body: "sans-serif", sans-serif');
    });
});
