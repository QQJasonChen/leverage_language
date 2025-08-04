# Transcript Feature Troubleshooting Guide

## 🚨 **Most Common Issues & Solutions**

### Issue 1: "Could not establish connection. Receiving end does not exist"
**Cause**: Content script not loaded on YouTube page
**Solutions**:
1. **Reload the extension** in chrome://extensions/
2. **Refresh the YouTube page** (F5)
3. **Navigate to actual YouTube video** (not extensions page)
4. **Wait 2-3 seconds** for content script to load

### Issue 2: "Current tab is not a YouTube video"
**Cause**: Wrong tab selected
**Solutions**:
1. **Go to YouTube video page** (youtube.com/watch?v=...)
2. **Make sure video is playing** and has captions
3. **Click in the video area** to activate the tab

### Issue 3: "No captions found"
**Cause**: Video doesn't have auto-generated or manual captions
**Solutions**:
1. **Check CC button** on YouTube player - is it available?
2. **Try different video** with auto-generated captions
3. **Verify captions work** by clicking CC in YouTube

## 🔧 **Step-by-Step Testing Process**

### Step 1: Verify Setup
1. Go to chrome://extensions/
2. Find your extension
3. Click reload button 🔄
4. Ensure extension is enabled

### Step 2: Test Video
1. Go to YouTube
2. Find a video with auto-generated captions
3. **Test video**: https://youtube.com/watch?v=dQw4w9WgXcQ (has auto captions)
4. Click CC button to verify captions work

### Step 3: Test Extension
1. Open extension sidepanel
2. Click "📝 字幕重構" tab
3. Click "List Tabs" - should show YouTube video
4. Click "Check CC" - should detect captions

### Step 4: If Still Failing
1. Open Developer Console (F12)
2. Check for errors in Console tab
3. Look for "🎬 Enhanced YouTube transcript content script loaded"

## 🎯 **Quick Test Videos** (Known to have auto-captions)

- **English**: https://youtube.com/watch?v=dQw4w9WgXcQ
- **Dutch**: https://youtube.com/watch?v=_tkoK4nhpVU (your test video)
- **Any popular TED Talk** usually has auto-captions

## 📋 **Console Output - What to Look For**

**Good (Working):**
```
🎬 Enhanced YouTube transcript content script loaded
🚀 Processing enhanced transcript request...
📝 Found caption tracks: 2
🎯 Selected track: {vssId: "a.nl.asr", languageCode: "nl"}
✅ Transcript fetched via Method 1a: 234 segments
```

**Bad (Not Working):**
```
❌ Could not establish connection
❌ No captions found
❌ Current tab is not a YouTube video
```

## 🔄 **Last Resort - Complete Reset**

If nothing works:
1. Disable extension
2. Wait 5 seconds
3. Enable extension
4. Refresh YouTube page
5. Wait for page to fully load
6. Try again

## 💡 **Pro Tips**

- **Always be on the YouTube video page** when testing
- **Wait for page to fully load** before testing
- **Try multiple videos** - some don't have captions
- **Check browser console** for detailed error messages
- **Use "List Tabs"** to verify correct tab detection