#!/bin/bash
# Deploy to VPS via rsync
# Usage: ./deploy-vps.sh
set -e

# Configuration - adjust these as needed
VPS_HOST="${VPS_HOST:-zurd}"
VPS_PATH="${VPS_PATH:-/var/www/dev.kazyamazya.com}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/packages/site/dist"

echo "🔨 Building site..."
cd "$PROJECT_ROOT"
npm run build:site

if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Build directory not found: $BUILD_DIR"
    exit 1
fi

echo "📡 Deploying to $VPS_HOST:$VPS_PATH..."
rsync -avz --delete \
    --exclude '.git' \
    --exclude '.DS_Store' \
    --exclude '*.map' \
    "$BUILD_DIR/" "$VPS_HOST:$VPS_PATH/"

echo "✅ Deployed to https://dev.kazyamazya.com"
