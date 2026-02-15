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
# Resolve files path from artis.config.yaml (user-data project)
FILES_DIR=$(node -e "
const y=require('js-yaml'),f=require('fs'),p=require('path');
try {
  const c=y.load(f.readFileSync('artis.config.yaml','utf-8'));
  const udp=c.userDataPath||c.contentPath||'';
  if(udp){const r=p.isAbsolute(udp)?udp:p.resolve(udp);const fp=p.join(r,'files');if(f.existsSync(fp)){console.log(fp);process.exit(0)}}
} catch{}
console.log('files');
" 2>/dev/null)
echo "   Serving from: $FILES_DIR"
npx serve "$FILES_DIR" -p 3001 --cors &
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
