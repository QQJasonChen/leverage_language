# Chrome Web Store Publishing Guide

## Step 1: Create Developer Account
1. Go to https://chrome.google.com/webstore/devconsole
2. Pay one-time $5 registration fee
3. Verify your account

## Step 2: Prepare Your Extension

### Required Files
- [x] manifest.json (updated)
- [x] privacy-policy.html (created - host this online)
- [ ] Icons: 16x16, 48x48, 128x128 PNG files
- [ ] Screenshots: At least 1 (1280x800 or 640x400)
- [ ] Promotional images (optional): 440x280, 920x680

### Create Icons
```bash
# If you have a base icon, you can resize it:
# brew install imagemagick
# convert icon.png -resize 16x16 icon-16.png
# convert icon.png -resize 48x48 icon-48.png
# convert icon.png -resize 128x128 icon-128.png
```

## Step 3: Testing Strategy

### Alpha Testing (Private)
1. Upload as "Private" visibility
2. Add tester emails (up to 100)
3. Test for 1-2 weeks
4. Collect feedback

### Beta Testing  
1. Change to "Unlisted" visibility
2. Share link with beta testers
3. Monitor for issues
4. Test for 2-4 weeks

## Step 4: Upload to Chrome Web Store

1. Create ZIP file:
```bash
zip -r youglish-extension.zip . -x ".*" -x "__MACOSX" -x "*.git*" -x "PUBLISHING_GUIDE.md"
```

2. In Developer Dashboard:
   - Click "New Item"
   - Upload ZIP file
   - Fill in store listing:
     - Extension name
     - Summary (132 chars max)
     - Description
     - Category: "Productivity" or "Education"
     - Language
     - Screenshots
     - Icons
     - Privacy policy URL

3. Set Distribution:
   - Visibility: Private → Unlisted → Public
   - Distribution: Selected regions or worldwide
   - Pricing: Free

## Step 5: Submit for Review

1. Review checklist:
   - [ ] All permissions justified
   - [ ] No minified code
   - [ ] Privacy policy accessible
   - [ ] Accurate description
   - [ ] Working functionality

2. Submit and wait 1-3 days for review

## Step 6: After Publishing

1. Monitor reviews and ratings
2. Respond to user feedback  
3. Regular updates (bug fixes, features)
4. Track installation metrics

## Version Management

Current: 2.4.0 Beta

Versioning scheme:
- Major.Minor.Patch (e.g., 2.4.0)
- Beta: Add "Beta" to version_name
- Production: Remove "Beta"

## Support Resources

- Chrome Web Store Documentation: https://developer.chrome.com/docs/webstore/
- Review Guidelines: https://developer.chrome.com/docs/webstore/program-policies/
- Developer Dashboard: https://chrome.google.com/webstore/devconsole