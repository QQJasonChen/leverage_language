#!/bin/bash

# Build script for Alpha Release
echo "🚀 Building LeverageLanguage Alpha Release v1.0.0-alpha..."

# Create release directory
RELEASE_DIR="release/leveragelanguage-v1.0.0-alpha"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Copy essential files (excluding test and development files)
echo "📦 Copying essential files..."

# Core files
cp manifest.json "$RELEASE_DIR/"
cp LICENSE "$RELEASE_DIR/"
cp ALPHA_TEST_README.md "$RELEASE_DIR/"

# Locales
cp -r _locales "$RELEASE_DIR/"

# JavaScript files (excluding test files)
for file in *.js; do
    if [[ ! "$file" =~ test|debug|fixed|simple|stable|enhanced|hybrid|bak ]]; then
        cp "$file" "$RELEASE_DIR/"
    fi
done

# HTML files (excluding test files)
for file in *.html; do
    if [[ ! "$file" =~ test|debug ]]; then
        cp "$file" "$RELEASE_DIR/"
    fi
done

# Directories
cp -r components "$RELEASE_DIR/"
cp -r icons "$RELEASE_DIR/"
cp -r lib "$RELEASE_DIR/"
cp -r styles "$RELEASE_DIR/"

# Remove backup files
find "$RELEASE_DIR" -name "*.bak" -delete
find "$RELEASE_DIR" -name "*.backup" -delete

echo "📋 Files included in release:"
find "$RELEASE_DIR" -type f | wc -l
echo "files total"

# Create ZIP file
echo "🗜️ Creating ZIP file..."
cd release
zip -r "leveragelanguage-v1.0.0-alpha.zip" "leveragelanguage-v1.0.0-alpha" -x "*.DS_Store" "*/.git/*"

echo "✅ Release package created: release/leveragelanguage-v1.0.0-alpha.zip"
echo ""
echo "📝 Next steps:"
echo "1. Test the extension by loading the unpacked folder in Chrome"
echo "2. Upload the ZIP file to Chrome Web Store Developer Dashboard"
echo "3. Follow the publishing guide in CHROME_STORE_PUBLISHING_GUIDE.md"