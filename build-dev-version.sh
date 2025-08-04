#!/bin/bash

# Build script for Development Version (for personal use)
echo "🔧 Building LeverageLanguage Development Version..."

# Create development directory
DEV_DIR="dev-build/leveragelanguage-dev"
rm -rf "$DEV_DIR"
mkdir -p "$DEV_DIR"

# Copy ALL files (including test files for development)
echo "📦 Copying all files for development..."

# Copy everything except release and node_modules
rsync -av --exclude='release/' --exclude='node_modules/' --exclude='.git/' --exclude='dev-build/' . "$DEV_DIR/"

# Modify manifest.json to indicate dev version
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' 's/"version_name": "1.0.0-alpha (Early Test Version)"/"version_name": "1.0.0-dev (Development Build)"/' "$DEV_DIR/manifest.json"
else
    # Linux
    sed -i 's/"version_name": "1.0.0-alpha (Early Test Version)"/"version_name": "1.0.0-dev (Development Build)"/' "$DEV_DIR/manifest.json"
fi

echo "📋 Files included in dev build:"
find "$DEV_DIR" -type f | wc -l
echo "files total (including test files)"

# Create ZIP file with different name
echo "🗜️ Creating development ZIP file..."
cd dev-build
zip -r "leveragelanguage-DEV-$(date +%Y%m%d-%H%M%S).zip" "leveragelanguage-dev" -x "*.DS_Store" "*/.git/*"

echo "✅ Development package created: dev-build/leveragelanguage-DEV-*.zip"
echo ""
echo "📝 This version includes:"
echo "- All test files for debugging"
echo "- Development tools and scripts"
echo "- Full source code without optimization"
echo ""
echo "⚠️  DO NOT upload this version to Chrome Web Store!"
echo "Use build-alpha-release.sh for production builds instead."