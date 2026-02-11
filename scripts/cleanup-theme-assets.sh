#!/bin/sh
# Clean up empty asset directories from themes, keeping only preview.png

echo "🧹 Cleaning theme asset directories..."

for theme_dir in themes/*/; do
    theme_name=$(basename "$theme_dir")

    # Skip recommended-assets
    [ "$theme_name" = "recommended-assets" ] && continue

    assets_dir="${theme_dir}assets"

    if [ -d "$assets_dir" ]; then
        # Remove empty subdirectories
        find "$assets_dir" -type d -empty -delete 2>/dev/null

        # Check what's left
        remaining=$(find "$assets_dir" -type f 2>/dev/null | wc -l)

        if [ "$remaining" -eq 0 ]; then
            # Completely empty, remove
            rm -rf "$assets_dir"
            echo "  ✓ Removed empty $theme_name/assets/"
        elif [ "$remaining" -eq 1 ]; then
            # Only preview.png, that's okay
            if [ -f "$assets_dir/preview.png" ]; then
                echo "  ✓ $theme_name: kept preview.png only"
            fi
        fi
    fi
done

echo "✓ Cleanup complete"
