#!/bin/sh

# Sync themes before starting dev servers
echo "🔄 Syncing themes..."
./scripts/sync-themes.sh

# Start theme file watcher in the background
echo "👀 Starting theme file watcher..."
node scripts/watch-themes.mjs &
WATCHER_PID=$!

# Start image server in the background
echo "🖼️  Starting image server..."
npx serve files -p 3001 --cors &
IMAGE_SERVER_PID=$!

# Cleanup function to kill watcher and image server on exit
cleanup() {
    echo ""
    echo "🛑 Stopping theme watcher..."
    kill $WATCHER_PID 2>/dev/null
    
    echo "🛑 Stopping image server..."
    kill $IMAGE_SERVER_PID 2>/dev/null
    
    wait $WATCHER_PID 2>/dev/null
    wait $IMAGE_SERVER_PID 2>/dev/null
}

# Set trap to cleanup on exit, interrupt, or termination
trap cleanup EXIT INT TERM

# Start dev servers
printf '\n  🎨 ArtSiteMaker\n  ────────────────────────────\n  📱 Site:   http://localhost:4321\n  🔧 Admin:  http://localhost:4322\n  🖼️  Images: http://localhost:3001\n  🎨 Sample: http://localhost:4322/sample\n\n'
exec pnpm -r --parallel dev
