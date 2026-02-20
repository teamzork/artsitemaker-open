#!/bin/sh
# Sync pure theme packages to site public directory
# Copies only styling files (theme.yaml, styles.css, preview.png)
# Does NOT copy content assets (fonts, logos, textures)

set -e

THEMES_SRC="./themes"
THEMES_DEST="./packages/site/public/themes"

echo "🎨 Syncing theme styles..."

# Create destination if it doesn't exist
mkdir -p "$THEMES_DEST"

# Remove old themes (clean slate)
rm -rf "$THEMES_DEST"/*

# Track what we sync
synced_count=0

# Copy each theme directory
for theme_dir in "$THEMES_SRC"/*; do
    # Skip if not a directory
    [ ! -d "$theme_dir" ] && continue

    theme_name=$(basename "$theme_dir")

    # Skip recommended-assets directory
    if [ "$theme_name" = "recommended-assets" ]; then
        continue
    fi

    echo "  → $theme_name"

    # Create theme destination
    mkdir -p "$THEMES_DEST/$theme_name"

    # Copy core theme files
    if [ -f "$theme_dir/theme.yaml" ]; then
        cp "$theme_dir/theme.yaml" "$THEMES_DEST/$theme_name/"
    fi

    if [ -f "$theme_dir/styles.css" ]; then
        cp "$theme_dir/styles.css" "$THEMES_DEST/$theme_name/"
    fi

    # Copy assets directory if it exists (includes preview.png and nav arrows)
    if [ -d "$theme_dir/assets" ]; then
        mkdir -p "$THEMES_DEST/$theme_name/assets"
        cp -r "$theme_dir/assets/"* "$THEMES_DEST/$theme_name/assets/"
    fi

    # Fallback: Copy preview.png from root if not in assets
    if [ ! -f "$THEMES_DEST/$theme_name/assets/preview.png" ] && [ -f "$theme_dir/preview.png" ]; then
        cp "$theme_dir/preview.png" "$THEMES_DEST/$theme_name/"
    fi

    synced_count=$((synced_count + 1))
done

# Verify we synced something
if [ $synced_count -eq 0 ]; then
    echo "⚠️  Warning: No themes found to sync"
    exit 1
fi

echo "✓ Synced $synced_count theme(s) to $THEMES_DEST"

# Show what was synced (for debugging)
if [ -n "$DEBUG" ]; then
    echo ""
    echo "Synced theme structure:"
    tree "$THEMES_DEST" -L 2 2>/dev/null || ls -R "$THEMES_DEST"
fi
