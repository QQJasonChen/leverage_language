# YouTube Transcript Restructuring Feature

## 🎯 Overview
This feature automatically restructures YouTube's auto-generated subtitles into properly formatted sentences with correct punctuation and capitalization, similar to what Trancy offers.

## ✨ Features
- **Automatic transcript fetching** from YouTube videos
- **Smart sentence boundary detection** using pause analysis
- **AI-powered text restructuring** for better punctuation
- **Rule-based fallback** for basic punctuation
- **Interactive timeline** - click sentences to jump to video time
- **Export functionality** - save restructured transcripts
- **Multi-language support** (currently optimized for English)

## 🚀 How to Use

### 1. Open YouTube Video
Navigate to any YouTube video with available subtitles (auto-generated or manual).

### 2. Access Transcript Restructurer
- Open the extension sidepanel
- Click on "📝 字幕重構" (Transcript) tab
- The transcript restructurer interface will load

### 3. Fetch and Restructure
- Click "Get Transcript" button
- Wait for the system to:
  1. Extract transcript from YouTube
  2. Analyze pause patterns
  3. Apply AI restructuring (if enabled)
  4. Display results

### 4. Review Results
- **Original**: Raw auto-generated subtitles
- **Restructured**: Properly formatted sentences
- Click any sentence to jump to that time in the video

### 5. Export or Copy
- Use "Copy All" to copy restructured text
- Use "Export" to save as JSON file
- Use "Toggle View" to switch between original/restructured

## ⚙️ Configuration Options

### AI Restructuring
- **Enabled** (default): Uses your configured AI service for best results
- **Disabled**: Uses rule-based punctuation only

### Pause Threshold
- **Default**: 1.5 seconds
- **Range**: 0.5 - 5.0 seconds
- Higher values create longer sentences
- Lower values create shorter, more frequent breaks

## 🔧 Technical Details

### How It Works
1. **Transcript Extraction**: Multiple methods to get YouTube captions
   - YouTube's caption track API
   - Page data extraction
   - Fallback to transcript button

2. **Sentence Segmentation**: 
   - Groups subtitle segments by natural pauses
   - Configurable pause threshold
   - Preserves timing information

3. **AI Enhancement**:
   - Sends text chunks to your AI service
   - Adds proper punctuation and capitalization
   - Maintains original word order

4. **Display**: 
   - Interactive sentences with timestamps
   - Click-to-seek functionality
   - Copy and export options

### Supported Video Types
- ✅ Videos with auto-generated captions
- ✅ Videos with manual captions  
- ✅ Multiple languages (AI dependent)
- ❌ Videos without any captions
- ❌ Private or restricted videos

## 🛠️ Troubleshooting

### "No transcript available"
- Ensure video has captions (check YouTube's CC button)
- Try refreshing the page
- Some videos may have restricted caption access

### "AI restructuring failed"
- Check your AI service configuration in settings
- Verify API keys are valid and have quota
- Feature will fall back to basic punctuation

### "Failed to fetch transcript"
- Ensure you're on a YouTube video page
- Check if video is publicly accessible
- Try reloading the extension

## 📱 Browser Compatibility
- ✅ Chrome (recommended)
- ✅ Edge
- ⚠️ Firefox (limited - manifest v3 support)
- ❌ Safari (not supported)

## 🔄 Updates and Improvements
Future enhancements may include:
- Support for more video platforms
- Better language detection
- Batch processing multiple videos
- Integration with note-taking apps
- Custom formatting templates

## 💡 Tips for Best Results
1. **Use AI enhancement** for better punctuation accuracy
2. **Adjust pause threshold** based on speaker pace
3. **Verify AI settings** in extension options
4. **Test with different video types** to understand capabilities
5. **Export transcripts** for offline study or note-taking

## 🔗 Related Features
This feature works well with other extension capabilities:
- **YouGlish Integration**: Search specific phrases
- **AI Analysis**: Analyze transcript content
- **Flashcard Creation**: Convert sentences to study materials
- **Translation Services**: Translate restructured text