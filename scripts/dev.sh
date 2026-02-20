#!/bin/sh

# Detect local network IP for display
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "")

# Check for tailnet mode (adds tailscale IP to display)
TAILSCALE_IP=""
if [ "$TAILNET" = "1" ] || [ "$TAILNET" = "true" ]; then
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null)
    if [ -z "$TAILSCALE_IP" ]; then
        echo "❌ Tailscale not running or no IPv4 address found"
        exit 1
    fi
    echo "🌐 Tailnet mode: also reachable at $TAILSCALE_IP"
fi

# All servers bind to 0.0.0.0 (all interfaces) by default
LISTEN_HOST="0.0.0.0"

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
npx serve "$FILES_DIR" --cors --listen "tcp://$LISTEN_HOST:3001" &
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

# Print startup banner
printf '\n  🎨 ArtSiteMaker\n  ────────────────────────────\n'
printf '  📱 Site:   http://localhost:4321\n'
printf '  🔧 Admin:  http://localhost:4322\n'
printf '  🖼️  Images: http://localhost:3001\n'
if [ -n "$LOCAL_IP" ]; then
    printf '\n  🌐 Network:\n'
    printf '  📱 Site:   http://%s:4321\n' "$LOCAL_IP"
    printf '  🔧 Admin:  http://%s:4322\n' "$LOCAL_IP"
    printf '  🖼️  Images: http://%s:3001\n' "$LOCAL_IP"
fi
if [ -n "$TAILSCALE_IP" ]; then
    printf '\n  🔒 Tailnet:\n'
    printf '  📱 Site:   http://%s:4321\n' "$TAILSCALE_IP"
    printf '  🔧 Admin:  http://%s:4322\n' "$TAILSCALE_IP"
    printf '  🖼️  Images: http://%s:3001\n' "$TAILSCALE_IP"
fi
printf '\n'
exec pnpm -r --parallel dev
