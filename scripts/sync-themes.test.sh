#!/bin/sh
# Test theme sync script

set -e

echo "🧪 Testing theme sync..."

# Clean up test environment
rm -rf test-output
mkdir -p test-output/themes

# Create test theme structure
mkdir -p test-output/themes/test-theme/assets
echo "name: Test" > test-output/themes/test-theme/theme.yaml
echo "body {}" > test-output/themes/test-theme/styles.css
echo "preview" > test-output/themes/test-theme/assets/preview.png

# Create files that should NOT be synced
mkdir -p test-output/themes/test-theme/assets/fonts
echo "font" > test-output/themes/test-theme/assets/fonts/test.woff2
mkdir -p test-output/themes/test-theme/assets/logos
echo "logo" > test-output/themes/test-theme/assets/logos/logo.png

# Create recommended-assets directory (should be skipped)
mkdir -p test-output/themes/recommended-assets
echo "should be skipped" > test-output/themes/recommended-assets/readme.txt

# Test 1: Sync script copies correct files
echo "Test 1: Copying theme files..."
./scripts/sync-themes.sh > /dev/null 2>&1 || true

DEST="./packages/site/public/themes"

if [ -f "$DEST/test-theme/theme.yaml" ]; then
    echo "✓ theme.yaml copied"
else
    echo "✗ theme.yaml missing"
    exit 1
fi

if [ -f "$DEST/test-theme/styles.css" ]; then
    echo "✓ styles.css copied"
else
    echo "✗ styles.css missing"
    exit 1
fi

if [ -f "$DEST/test-theme/assets/preview.png" ]; then
    echo "✓ preview.png copied"
else
    echo "✗ preview.png missing"
    exit 1
fi

# Test 2: Font files should NOT be copied (pure themes)
if [ -f "$DEST/test-theme/assets/fonts/test.woff2" ]; then
    echo "✗ Font file was copied (should be skipped in pure themes)"
    exit 1
else
    echo "✓ Font files correctly skipped"
fi

# Test 3: Logo files should NOT be copied
if [ -f "$DEST/test-theme/assets/logos/logo.png" ]; then
    echo "✗ Logo file was copied (should be skipped in pure themes)"
    exit 1
else
    echo "✓ Logo files correctly skipped"
fi

# Test 4: recommended-assets should be skipped
if [ -f "$DEST/recommended-assets/readme.txt" ]; then
    echo "✗ recommended-assets was copied (should be skipped)"
    exit 1
else
    echo "✓ recommended-assets correctly skipped"
fi

# Clean up test fixture
rm -rf test-output/themes/test-theme

echo "✅ All sync tests passed"
