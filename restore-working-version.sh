#!/bin/bash

# Script to restore the extension to a working state
# This removes problematic crash-fix files and restores from backups

echo "🔧 Restoring YouGlish Extension to working state..."

# Remove crash-fix files that might have recursive logging issues
echo "🗑️  Removing crash-fix files..."
rm -f content.js.crash-fix
rm -f lib/gamification-manager.js.crash-fix
rm -f lib/storage-manager.js.crash-fix
rm -f lib/trial-api-manager.js.crash-fix
rm -f netflix-content.js.crash-fix
rm -f youtube-transcript-content.js.crash-fix

# Check if we need to restore from backups
if [ -f "sidepanel.js.backup" ]; then
    echo "📄 Found sidepanel.js.backup - Restoring..."
    cp sidepanel.js.backup sidepanel.js
fi

if [ -f "background.js.backup" ]; then
    echo "📄 Found background.js.backup - Restoring..."
    cp background.js.backup background.js
fi

if [ -f "content.js.backup" ]; then
    echo "📄 Found content.js.backup - Restoring..."
    cp content.js.backup content.js
fi

# Clean up any temporary files
echo "🧹 Cleaning up temporary files..."
rm -rf dev-build/
rm -rf temp-release-fix/

# Create a clean release build
echo "📦 Creating clean release build..."
./build-alpha-release.sh

echo "✅ Restoration complete!"
echo ""
echo "📌 Next steps:"
echo "1. Go to chrome://extensions/"
echo "2. Remove the current extension"
echo "3. Click 'Load unpacked' and select this folder"
echo "4. Or install from: release/leveragelanguage-v1.0.0-alpha.zip"
echo ""
echo "💡 If you still have issues:"
echo "   - Check the browser console for errors"
echo "   - Try the fixed version in FINAL_RELEASE/leveragelanguage-v1.0.0-alpha-FIXED.zip"