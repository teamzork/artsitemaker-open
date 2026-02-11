#!/bin/bash
# Deploy to Cloudflare Pages via separate repo
# Usage: ./deploy-cf-pages.sh [commit message]
set -e

# Configuration
SITE_REPO="${SITE_REPO:-$HOME/Git/kazyamazya-site}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/packages/site/dist"
MESSAGE="${1:-Deploy from Artis $(date +%Y-%m-%d_%H:%M)}"

echo "🔨 Building site..."
cd "$PROJECT_ROOT"
npm run build:site

if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Build directory not found: $BUILD_DIR"
    exit 1
fi

# Check if site repo exists
if [ ! -d "$SITE_REPO" ]; then
    echo "❌ Site repository not found: $SITE_REPO"
    echo "   Create it first with: mkdir -p $SITE_REPO && cd $SITE_REPO && git init"
    exit 1
fi

echo "📦 Copying to site repo..."
# Keep .git folder but replace everything else
find "$SITE_REPO" -mindepth 1 -maxdepth 1 -not -name '.git' -exec rm -rf {} +
cp -r "$BUILD_DIR"/* "$SITE_REPO/"

echo "🚀 Committing and pushing..."
cd "$SITE_REPO"
git add -A

if git diff --cached --quiet; then
    echo "ℹ️  No changes to commit"
else
    git commit -m "$MESSAGE"
    git push origin main
    echo "✅ Deployed! CF Pages will update automatically."
fi
