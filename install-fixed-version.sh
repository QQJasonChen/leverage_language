#!/bin/bash

# Simple script to install the FIXED version of the extension

echo "🚀 Installing FIXED version of YouGlish Extension..."
echo ""

# Check if the fixed version exists
if [ ! -f "FINAL_RELEASE/leveragelanguage-v1.0.0-alpha-FIXED.zip" ]; then
    echo "❌ Error: FIXED version not found at FINAL_RELEASE/leveragelanguage-v1.0.0-alpha-FIXED.zip"
    exit 1
fi

# Create a temporary directory for extraction
TEMP_DIR="temp-fixed-install"
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR

# Extract the fixed version
echo "📦 Extracting fixed version..."
unzip -q "FINAL_RELEASE/leveragelanguage-v1.0.0-alpha-FIXED.zip" -d $TEMP_DIR

echo "✅ Fixed version extracted to: $TEMP_DIR"
echo ""
echo "📌 Installation steps:"
echo "1. Open Chrome and go to: chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. If you have the extension installed, remove it first"
echo "4. Click 'Load unpacked'"
echo "5. Select the folder: $(pwd)/$TEMP_DIR"
echo ""
echo "🎯 Alternative: Drag and drop the .zip file"
echo "   You can also drag: FINAL_RELEASE/leveragelanguage-v1.0.0-alpha-FIXED.zip"
echo "   directly into chrome://extensions/"
echo ""
echo "⚠️  Important: This is the stable FIXED version from FINAL_RELEASE"