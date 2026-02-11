# Recommended Theme Assets

These assets provide the "authentic" look for each theme but are **optional**. Themes work perfectly well with your own fonts, logos, and textures configured in Identity Kit.

## Installation

To use the recommended assets for a theme:

### Option 1: Automatic (Recommended)

```bash
# From project root
pnpm migrate:theme-assets
```

This copies the assets for your current theme to `user-data/assets/` and configures Identity Kit automatically.

### Option 2: Manual

1. Copy desired assets to your user-data directory:
   ```bash
   cp -r themes/recommended-assets/kazya-mazya/fonts/* user-data/assets/fonts/
   cp -r themes/recommended-assets/kazya-mazya/logos/* user-data/assets/logos/
   cp -r themes/recommended-assets/kazya-mazya/textures/* user-data/assets/textures/
   ```

2. Update `user-data/settings.yaml`:
   ```yaml
   identityKit:
     fonts:
       heading:
         family: "Aziu"
         file: "fonts/Aziu-Black.woff2"
         weight: 900
       body:
         family: "DimkaSans"
         file: "fonts/DimkaSans-Regular.woff2"
         weight: 400
     logo:
       file: "logos/logo.png"
       width: 126
     background:
       texture: "textures/bgd.jpg"
       textureMode: tile
   ```

## Asset Inventory

### Kazya Mazya

**Fonts:**
- Aziu-Black.woff2 (900 weight)
- Aziu-Thin.woff2 (100 weight)
- DimkaSans-Regular.woff2 (400 weight)
- Xarrovv-Regular.woff2 (400 weight)

**Logos:**
- logo.png (main logo)
- logo-circle.png (circular variant)
- logo-footerbg.png (footer variant)
- kazya-mazya-logo-vector.svg (vector version)

**Textures:**
- bgd.jpg (default background)
- bgd_dark.jpg (dark variant)
- bgd_darker.jpg (darker variant)
- bgd2.jpg (alternative)

### Minimalist

**Fonts:**
- DimkaSans-Regular.woff2 (400 weight)

**Logos:**
- logo.png (minimal logo)

**Textures:** None (uses solid colors)

### Modern

**Fonts:** None (uses system fonts via Google Fonts)

**Logos:**
- logo.png (modern logo)

**Textures:** None (uses solid colors)

## Font Licensing

These fonts are included for demonstration purposes. For production use:
- Verify you have appropriate licenses
- Consider using web fonts from Google Fonts or similar services
- Replace with your own licensed fonts

## Why Optional?

Themes should be **pure styling**. By keeping assets optional:
- Themes remain lightweight (<50KB vs ~2MB)
- You can mix and match (e.g., Modern theme with Kazya Mazya fonts)
- Your branding stays consistent when switching themes
- Faster theme downloads and distribution
