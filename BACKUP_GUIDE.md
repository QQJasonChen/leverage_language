# 📁 YouGlish Extension Backup Guide

Your extension now has comprehensive automated backup workflows! Here's how everything works.

## 🔄 Automated Backup Types

### 1. **Continuous Backup** (Auto-runs)
- **Triggers:** Every push to main branch
- **Schedule:** Daily at 2 AM UTC (10 AM Taiwan time)
- **What it does:**
  - ✅ Validates extension files
  - 📊 Creates backup reports
  - 🗃️ Archives to GitHub
  - 📈 Tracks file changes

### 2. **Manual Backup** (On-demand)
- **How to run:** Go to GitHub → Actions → "Manual Backup" → Run workflow
- **Options:**
  - `full` - Complete extension backup
  - `code-only` - Just the essential code files
  - `config-only` - Configuration files only
  - Include/exclude test files
  - Create compressed archives

### 3. **Version Release Backup** (Tag-triggered)
- **Triggers:** When you create version tags (v2.4.0, v2.4.1, etc.)
- **What it creates:**
  - 📦 Ready-to-install extension package
  - 📋 Complete source code archive
  - 🔐 SHA256 checksums for security
  - 📝 Auto-generated changelog
  - 🎯 GitHub release with download links

## 🚀 Quick Start Commands

### Create a New Release (Recommended)
```bash
# Navigate to your extension folder
cd "/Users/qinchen/Downloads/00_語文學習youglish計畫/youglish-extension"

# Run the release script
./scripts/create-release.sh
```

This script will:
1. 📋 Show current version
2. 🎯 Help you choose patch/minor/major release
3. ✏️ Update manifest.json automatically
4. 🏷️ Create git tag
5. 🚀 Push to GitHub and trigger automated release

### Manual Git Commands
```bash
# For manual version release
git add .
git commit -m "Release v2.5.0: New features added"
git tag -a "v2.5.0" -m "Release v2.5.0"
git push origin main
git push origin v2.5.0
```

## 📊 Backup Locations

### GitHub Actions Artifacts
- **Location:** Your repo → Actions → Workflow runs → Artifacts
- **Retention:** 30-90 days depending on workflow
- **Contents:** Reports, compressed backups, validation logs

### GitHub Releases
- **Location:** Your repo → Releases tab
- **Retention:** Permanent
- **Contents:** Installable packages, source code, checksums

### Repository Backup
- **Location:** Your entire repo is always backed up on GitHub
- **Retention:** Permanent
- **Contents:** Complete version history, all files

## 🛠️ How to Restore from Backup

### Option 1: From GitHub Release
1. Go to your repository's Releases page
2. Download the latest `youglish-extension-vX.X.X.zip`
3. Extract and load in Chrome

### Option 2: Clone Repository
```bash
git clone https://github.com/QQJasonChen/leverage_language.git
cd leverage_language
```

### Option 3: From Actions Artifacts
1. Go to Actions → Recent workflow run
2. Download backup artifacts
3. Extract and use files

## 🔧 Backup Configuration

### Scheduled Backup Settings
- **Time:** 2 AM UTC daily (adjustable in `.github/workflows/auto-backup.yml`)
- **Retention:** 90 days for reports, permanent for releases
- **Validation:** Automatic file structure and manifest.json checks

### Manual Backup Options
Configure in GitHub when running manual backup:
- **Backup Type:** Full, code-only, or config-only
- **Test Files:** Include or exclude test HTML files
- **Compression:** Create ZIP/TAR archives

## 📝 Best Practices

### When to Create Releases
- ✨ **Minor version (2.4 → 2.5):** New features added
- 🐛 **Patch version (2.4.0 → 2.4.1):** Bug fixes
- 🔄 **Major version (2.x → 3.0):** Breaking changes

### Backup Schedule Recommendations
- **After major changes:** Use manual backup
- **Before experimenting:** Create release tag
- **Weekly:** Check automated backup status
- **Monthly:** Download release archives locally

## 🚨 Emergency Restore

If you lose your local files:

1. **Quick restore:**
   ```bash
   git clone https://github.com/QQJasonChen/leverage_language.git youglish-extension-restore
   ```

2. **Specific version restore:**
   ```bash
   git clone --branch v2.4.0 https://github.com/QQJasonChen/leverage_language.git
   ```

3. **From release package:**
   - Download latest release ZIP from GitHub
   - Extract to desired location
   - Load unpacked in Chrome

## 🔍 Monitoring Your Backups

### Check Backup Status
1. **GitHub Actions:** Your repo → Actions tab
2. **Email notifications:** GitHub will email on workflow failures
3. **Release page:** Check for latest automated releases

### Backup Health Indicators
- ✅ Green checkmarks in Actions tab
- 📅 Recent backup dates
- 📦 Successful release artifacts
- 🔢 File count consistency

## 🆘 Troubleshooting

### Common Issues
- **Workflow fails:** Check Actions tab for error details
- **Version mismatch:** Ensure manifest.json version matches tag
- **Missing files:** Verify .gitignore isn't excluding important files

### Getting Help
- Check workflow logs in Actions tab
- Review this guide
- Examine backup artifacts for completeness

---

## 🎉 You're All Set!

Your YouGlish extension now has enterprise-grade backup and version control:
- 🔄 **Automated daily backups**
- 🏷️ **Version-controlled releases**
- 📦 **Multiple backup formats**
- 🚀 **One-command releases**
- 🔐 **Security checksums**

Your code is now safer than most commercial software! 🛡️