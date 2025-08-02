# 🎭 Netflix Capture Button Test Steps

## 🔧 I Just Fixed the Issue!

The problem was that the platform detection wasn't working properly when the sidepanel first opened. I've added several fixes:

1. **Enhanced platform detection** with detailed logging
2. **Automatic refresh** when reusing the transcript restructurer 
3. **Manual refresh button** next to the platform badge
4. **Better error handling** and debugging info

## 📋 Test Steps

### Step 1: Refresh and Load Extension
1. **Refresh any Netflix page** you have open
2. **Click the YouGlish extension icon** to open sidepanel
3. **Click on the "Transcript" tab** (if not already there)

### Step 2: Check Platform Detection
1. Look at the header - you should see **"🎭 Netflix"** badge
2. If you see **"📺 YouTube"** instead, click the **refresh button** (⟳) next to the platform badge
3. **Open browser console** (F12) and look for platform detection messages:
   - `🔍 Platform detection - Current URL: https://netflix.com/...`
   - `✅ Detected Netflix platform`

### Step 3: Look for Capture Button
Once the platform shows "🎭 Netflix", you should see:
- **"Collect" button** (for continuous capture)
- **"Capture" button** (for manual capture) ← This is the one you need!

### Step 4: Test Manual Capture
1. **Enable Netflix subtitles** (CC button on video player)
2. **Play a video** and wait for subtitle text to appear
3. **Click the red "Capture" button** when subtitles are visible
4. You should see: `✅ Captured: "subtitle text here"`

## 🔍 Debugging

If the Capture button still doesn't appear:

### Check Console Logs
Open F12 console and look for:
```
🔍 Platform detection - Current URL: [current URL]
✅ Detected Netflix platform  (or ❌ if failed)
🎬 Platform detected: netflix
🚀 Creating new TranscriptRestructurer...
```

### Manual Refresh
1. Click the **⟳ refresh button** next to platform badge
2. Check console for: `🔄 Platform changed from youtube to netflix, reinitializing UI...`

### Force Reload
1. Close sidepanel completely
2. Refresh Netflix page
3. Reopen sidepanel
4. Click Transcript tab

## ✅ Expected Result

You should now see:
- Platform badge showing **"🎭 Netflix"**
- **Red "Capture" button** next to the "Collect" button
- Console showing successful platform detection

## 📞 If Still Not Working

Please share:
1. **Console logs** (F12 → Console) showing platform detection
2. **Current URL** you're testing on
3. **Screenshot** of the sidepanel Transcript tab

The Netflix functionality should now work! 🎉