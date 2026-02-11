#!/bin/bash
# Update artwork YAML files to use new image URL
# Changes: images.artsitemaker.com/artsitemaker → images.kazyamazya.com
#
# Usage: ./update-artwork-urls.sh

set -e

ARTWORKS_DIR="${1:-content/content/artworks}"
OLD_URL="https://images.artsitemaker.com/artsitemaker"
NEW_URL="https://images.kazyamazya.com"

echo "🔄 Updating artwork URLs..."
echo "   From: $OLD_URL"
echo "   To:   $NEW_URL"
echo ""

count=0
for file in "$ARTWORKS_DIR"/*.yaml; do
    if grep -q "$OLD_URL" "$file" 2>/dev/null; then
        # Use sed to replace in-place (macOS compatible)
        sed -i '' "s|$OLD_URL|$NEW_URL|g" "$file"
        echo "   ✓ Updated: $(basename "$file")"
        ((count++))
    fi
done

echo ""
echo "✅ Updated $count artwork files"
