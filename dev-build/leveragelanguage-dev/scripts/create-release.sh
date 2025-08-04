#!/bin/bash

# YouGlish Extension Release Creator
# This script helps create version releases and triggers automated backups

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 YouGlish Extension Release Creator${NC}"
echo "==========================================="

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check if manifest.json exists
if [ ! -f "manifest.json" ]; then
    echo -e "${RED}❌ Error: manifest.json not found${NC}"
    exit 1
fi

# Get current version from manifest
CURRENT_VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "*\([^"]*\)".*/\1/')
echo -e "${YELLOW}📋 Current version: v$CURRENT_VERSION${NC}"

# Ask for new version
echo ""
echo "What type of release do you want to create?"
echo "1) Patch (bug fixes: $CURRENT_VERSION -> $(echo $CURRENT_VERSION | awk -F. '{$3=$3+1; print $1"."$2"."$3}'))"
echo "2) Minor (new features: $CURRENT_VERSION -> $(echo $CURRENT_VERSION | awk -F. '{$2=$2+1; $3=0; print $1"."$2"."$3}'))"
echo "3) Major (breaking changes: $CURRENT_VERSION -> $(echo $CURRENT_VERSION | awk -F. '{$1=$1+1; $2=0; $3=0; print $1"."$2"."$3}'))"
echo "4) Custom version"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$3=$3+1; print $1"."$2"."$3}')
        ;;
    2)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$2=$2+1; $3=0; print $1"."$2"."$3}')
        ;;
    3)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$1=$1+1; $2=0; $3=0; print $1"."$2"."$3}')
        ;;
    4)
        read -p "Enter custom version (e.g., 2.5.0): " NEW_VERSION
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✨ New version will be: v$NEW_VERSION${NC}"

# Confirm release
echo ""
read -p "Do you want to continue with this release? (y/N): " confirm

if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🚫 Release cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}📝 Creating release v$NEW_VERSION...${NC}"

# Update version in manifest.json
echo "Updating manifest.json..."
sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" manifest.json
rm manifest.json.bak

# Check if there are any uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "Staging changes..."
    git add .
    
    read -p "Enter commit message (or press Enter for default): " commit_msg
    if [ -z "$commit_msg" ]; then
        commit_msg="Release v$NEW_VERSION: Update version and prepare release"
    fi
    
    git commit -m "$commit_msg

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
fi

# Create and push tag
echo "Creating git tag..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

YouGlish Chrome Extension release v$NEW_VERSION
Features comprehensive language learning tools with AI analysis.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo "Pushing to GitHub..."
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo -e "${GREEN}🎉 Release v$NEW_VERSION created successfully!${NC}"
echo ""
echo "What happens next:"
echo "• ⚡ GitHub Actions will automatically create a release"
echo "• 📦 Extension packages will be generated"
echo "• 💾 Backup artifacts will be created"
echo "• 📊 Release notes will be auto-generated"
echo ""
echo -e "${BLUE}🔗 Check your releases at: https://github.com/$(git config remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases${NC}"

# Offer to open the releases page
if command -v open &> /dev/null; then
    read -p "Open releases page in browser? (y/N): " open_browser
    if [[ $open_browser =~ ^[Yy]$ ]]; then
        open "https://github.com/$(git config remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases"
    fi
fi

echo ""
echo -e "${GREEN}✅ Done! Your extension is now backed up and released.${NC}"