#!/bin/bash

# Rollback script for AI optimization changes
echo "🔄 Rolling back AI optimization changes..."

# Check if backup files exist
if [ -f "temp-fixed-install/lib/ai-service.js.backup-before-optimization" ]; then
    echo "✅ Found backup file, restoring..."
    cp temp-fixed-install/lib/ai-service.js.backup-before-optimization temp-fixed-install/lib/ai-service.js
    echo "✅ ai-service.js restored"
else
    echo "❌ Backup file not found!"
    exit 1
fi

if [ -f "temp-fixed-install/lib/ai-service-prompts.js.backup-before-optimization" ]; then
    cp temp-fixed-install/lib/ai-service-prompts.js.backup-before-optimization temp-fixed-install/lib/ai-service-prompts.js
    echo "✅ ai-service-prompts.js restored"
fi

echo "✅ Rollback complete!"
echo ""
echo "📌 Next steps:"
echo "1. Reload the extension in Chrome"
echo "2. Test that AI analysis works as before"