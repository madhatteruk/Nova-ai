#!/bin/bash
# Nova AI - One-Line Installer
# Usage: curl -sL https://raw.githubusercontent.com/YOUR_USERNAME/nova-ai/main/install.sh | bash

set -e

echo "🚀 Installing Nova AI Control Panel with Upgrades..."

# Stop existing API
pkill -f "python3 api.py" 2>/dev/null || true
sleep 1

# Create directory if needed
cd /opt/nova-ai || exit 1

# Download API
echo "📥 Downloading API..."
curl -sL https://raw.githubusercontent.com/YOUR_USERNAME/nova-ai/main/api.py > api.py

# Download Panel
echo "📥 Downloading Panel..."
curl -sL https://raw.githubusercontent.com/YOUR_USERNAME/nova-ai/main/panel.html > panel.html

# Start API
echo "✅ Starting Nova Control Panel..."
python3 api.py &

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ NOVA PANEL INSTALLED!           ║"
echo "║  Access: http://YOUR_IP:8080        ║"
echo "║  Features:                          ║"
echo "║  • Chat with Nova                   ║"
echo "║  • View Thoughts & Dreams           ║"
echo "║  • Unlock 10 Upgrades               ║"
echo "║  • Full Control Panel               ║"
echo "╚══════════════════════════════════════╝"
