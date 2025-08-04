# 🎭 Netflix Direct Capture Guide

## Overview

The Netflix Direct Capture feature allows you to capture subtitles directly from the Netflix video page without opening the sidepanel. This provides a seamless learning experience similar to YouTube's text selection functionality while maintaining the powerful sidepanel capabilities.

## Features

### 🎯 Floating Capture Overlay
- **Real-time subtitle display** that shows the current Netflix subtitle
- **Automatic positioning** in bottom-right corner of the video page
- **Netflix-styled design** with dark theme and Netflix red accents
- **Auto-show functionality** appears automatically on Netflix watch pages

### ⌨️ Hotkey Support (Mac-Optimized)
- `Cmd+Opt+Ctrl+C` - **Capture current subtitle** (works anywhere on the page)
- `Cmd+Opt+Ctrl+H` - **Toggle overlay visibility** (show/hide)
- `Cmd+Opt+Ctrl+S` - **Show overlay** (if hidden)

### 👀 Visual Feedback
- **Success state**: Green border and checkmark when capture succeeds
- **Error state**: Red border and error message when capture fails
- **Loading state**: Animated "Capturing..." text during process
- **Button animations**: Hover effects and visual feedback

### 🔄 Real-time Subtitle Monitoring
- **Automatic detection** of subtitle changes every 500ms
- **Smart updates** only when subtitle text actually changes
- **Disabled state** when no subtitles are visible
- **Context awareness** only shows relevant subtitles

## How to Use

### Quick Start
1. **Navigate** to any Netflix video with subtitles enabled
2. **Wait 3 seconds** for the overlay to automatically appear
3. **Watch** as the overlay displays the current subtitle in real-time
4. **Click "Capture"** button or press `Cmd+Opt+Ctrl+C` to save the subtitle
5. **View results** in the sidepanel or saved vocabulary list

### Detailed Workflow

#### Step 1: Enable Netflix Subtitles
- Turn on subtitles in Netflix player controls
- Choose your target learning language
- Ensure subtitles are visible on screen

#### Step 2: Overlay Appearance
- The floating overlay appears automatically after 3 seconds
- Shows "Waiting for subtitles..." initially
- Updates to show current subtitle text when available

#### Step 3: Capture Process
- **Direct capture**: Click the "Capture" button in the overlay
- **Hotkey capture**: Press `Cmd+Opt+Ctrl+C` anywhere on the page
- **Visual feedback**: Button shows "Capturing..." then "Captured!" or error
- **Data processing**: Text is sent to sidepanel for analysis and storage

#### Step 4: Results
- Captured text appears in the sidepanel vocabulary list
- Saved with Netflix platform tag and timestamp
- Replay button (🎭) returns to Netflix video (not YouGlish)
- Full integration with existing learning tools

## Advanced Features

### Overlay Management
- **Hide overlay**: Press `Cmd+Opt+Ctrl+H` or click the X button
- **Show overlay**: Press `Cmd+Opt+Ctrl+S` to restore hidden overlay
- **Persistent settings**: Overlay state maintained during video playback

### Error Handling
- **No subtitle error**: "No subtitle text to capture" when nothing visible
- **Connection error**: "Failed to capture" if sidepanel communication fails
- **Auto-recovery**: Overlay resets to normal state after errors

### Integration with Sidepanel
- **Seamless connection**: Uses same backend as manual sidepanel capture
- **Unified storage**: All captures stored in same vocabulary system
- **Platform awareness**: Netflix captures tagged separately from YouTube
- **Cross-platform**: Works alongside existing YouTube functionality

## Technical Details

### Subtitle Detection
The overlay monitors multiple Netflix subtitle selectors:
- `.player-timedtext-text-container`
- `.ltr-11vo9g5` (Netflix-specific)
- `[data-uia="player-subtitle-text"]`
- Multiple fallback selectors for reliability

### Performance Optimization
- **Smart monitoring**: Only active when overlay is visible
- **Efficient polling**: 500ms intervals balance responsiveness and performance
- **Memory management**: Proper cleanup when overlay is hidden
- **Context validation**: Handles Netflix's dynamic content loading

### Data Format
Captured subtitles include:
```json
{
  "text": "Captured subtitle text",
  "url": "https://www.netflix.com/watch/12345#t=123s",
  "title": "Netflix Video Title",
  "language": "en",
  "source": "netflix-direct-capture",
  "platform": "netflix",
  "videoId": "12345",
  "timestamp": 123
}
```

## Troubleshooting

### Overlay Not Appearing
- **Check URL**: Must be on netflix.com/watch/ page
- **Wait for loading**: Allow 3 seconds for auto-show
- **Manual show**: Press `Cmd+Opt+Ctrl+S`
- **Refresh page**: Reload if Netflix content didn't load properly

### Subtitles Not Detected
- **Enable subtitles**: Turn on in Netflix player controls
- **Check visibility**: Ensure subtitles are actually displayed
- **Try different content**: Some Netflix content may have different subtitle formats
- **Console logs**: Check browser console for debugging information

### Capture Not Working
- **Check sidepanel**: Ensure extension sidepanel is functional
- **Network connection**: Verify stable internet connection
- **Extension permissions**: Ensure all required permissions are granted
- **Error messages**: Read error feedback in overlay for specific issues

### Hotkeys Not Responding
- **Focus check**: Click on the Netflix page to ensure focus
- **Other extensions**: Disable conflicting browser extensions
- **Key combination**: Ensure exact key combination (Cmd+Opt+Ctrl+C/H/S)
- **Browser support**: Verify browser supports the hotkey API

## Comparison with YouTube

| Feature | Netflix Direct Capture | YouTube Text Selection |
|---------|----------------------|----------------------|
| **Subtitle Display** | Real-time overlay | Direct video text |
| **Capture Method** | Button + Hotkeys | Text selection |
| **Timestamp Support** | Not functional | Full seeking |
| **Replay** | Return to video | YouGlish + seeking |
| **Platform Integration** | Netflix-specific | YouTube API |
| **Settings** | Minimal (capture-only) | Full configuration |

## Best Practices

### For Language Learning
1. **Choose appropriate content** with clear, educational subtitles
2. **Capture full sentences** rather than individual words
3. **Review captures** in sidepanel for better retention
4. **Use consistently** to build vocabulary over time

### For Performance
1. **Hide overlay** when not actively learning to save resources
2. **Clear captures** periodically to maintain performance
3. **Use hotkeys** for faster workflow
4. **Close unused tabs** to prevent memory issues

## Future Enhancements

- **Sentence boundary detection** for smarter capture
- **Automatic vocabulary extraction** from longer subtitles
- **Capture history** with undo/redo functionality
- **Custom styling options** for overlay appearance
- **Batch capture** for multiple consecutive subtitles

## Support

For issues or feature requests:
1. Check the browser console for error messages
2. Test with the included `test-direct-capture.html` page
3. Verify all extension permissions are granted
4. Report bugs with specific Netflix content and browser version

---

*This direct capture feature enhances your Netflix language learning experience while maintaining the full power of the existing sidepanel functionality.*