// Transcript Restructurer Component
// Handles UI and interaction for restructuring YouTube and Netflix subtitles

class TranscriptRestructurer {
  constructor(container, aiService) {
    this.container = container;
    this.aiService = aiService;
    this.currentPlatform = 'youtube'; // Default
    this.transcriptFetcher = null;
    this.currentTranscript = null;
    this.restructuredSentences = null;
    this.lastCapturedTimestamp = null; // Store last timestamp for B shortcut
    this.lastCapturedText = null; // Store last text for A shortcut
    this.currentVideoUrl = null; // Track current video to clear data on video change
    
    // Initialize asynchronously
    this.initializeAsync();
  }

  async initializeAsync() {
    try {
      console.log('🔄 Starting TranscriptRestructurer initialization...');
      
      // Detect platform first
      this.currentPlatform = await this.detectPlatform();
      console.log('🎬 Platform detected:', this.currentPlatform);
      console.log('🔍 Will show Netflix Capture button:', this.currentPlatform === 'netflix');
      
      // Initialize platform-specific components
      if (this.currentPlatform === 'youtube') {
        // Check if YouTubeTranscriptFetcher is available
        if (typeof YouTubeTranscriptFetcher === 'undefined') {
          console.error('YouTubeTranscriptFetcher not found. Make sure youtube-transcript.js is loaded first.');
          throw new Error('YouTubeTranscriptFetcher dependency not found');
        }
        this.transcriptFetcher = new YouTubeTranscriptFetcher();
      } else if (this.currentPlatform === 'netflix') {
        console.log('🎭 Netflix platform - using subtitle extractor');
        this.transcriptFetcher = null; // Netflix uses different extraction method
      } else if (this.currentPlatform === 'udemy') {
        console.log('📚 Udemy platform - using subtitle capture');
        this.transcriptFetcher = null; // Udemy uses content script subtitle capture
      }
      
      // Initialize UI
      console.log('🔧 Initializing UI with platform:', this.currentPlatform);
      this.init();
      console.log('✅ TranscriptRestructurer initialization completed');
      
      // Update video title after initialization
      this.updateVideoTitle();
      
      // For Udemy, also try updating course info with retry
      if (this.currentPlatform === 'udemy') {
        this.retryUdemyInfoUpdate();
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize TranscriptRestructurer:', error);
      // Fallback to YouTube mode
      this.currentPlatform = 'youtube';
      if (typeof YouTubeTranscriptFetcher !== 'undefined') {
        this.transcriptFetcher = new YouTubeTranscriptFetcher();
      }
      this.init();
    }
  }

  // Update video title in platform note with retry and fallback
  async updateVideoTitle() {
    if (this.currentPlatform !== 'netflix' && this.currentPlatform !== 'udemy') return;
    
    // Add delay to allow content scripts to load
    setTimeout(async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          let titleResult;
          
          // Try to get title based on platform
          try {
            if (this.currentPlatform === 'netflix') {
              titleResult = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getNetflixTitle' });
            } else if (this.currentPlatform === 'udemy') {
              titleResult = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getUdemyVideoInfo' });
            }
          } catch (connectionError) {
            console.log('🔄 Content script not ready, extracting from page title...');
            
            // Fallback: Extract title from document.title
            if (this.currentPlatform === 'netflix') {
              let title = tabs[0].title;
              if (title && title !== 'Netflix') {
                title = title.replace(' - Netflix', '').replace('Watch ', '').trim();
                if (title.length > 5) {
                  titleResult = { success: true, title: title };
                }
              }
            } else if (this.currentPlatform === 'udemy') {
              let title = tabs[0].title;
              if (title && title !== 'Udemy') {
                // Extract course and lecture info from document title
                title = title.replace(/^Course:\s*/, '').trim();
                let courseTitle = title;
                let lectureTitle = 'Current Lecture';
                
                // Try to split course and lecture if format is "Course - Lecture | Udemy"
                const parts = title.split(/\s*-\s*/);
                if (parts.length >= 2) {
                  courseTitle = parts[0].trim();
                  lectureTitle = parts[1].replace(/\s*\|\s*Udemy.*$/, '').trim();
                } else {
                  courseTitle = title.replace(/\s*\|\s*Udemy.*$/, '').trim();
                }
                
                if (courseTitle.length > 3) {
                  titleResult = { 
                    success: true, 
                    data: { 
                      courseTitle: courseTitle, 
                      lectureTitle: lectureTitle,
                      url: tabs[0].url
                    } 
                  };
                }
              }
            }
          }
          
          if (titleResult && titleResult.success) {
            const platformNoteEl = this.container.querySelector('.platform-note');
            if (platformNoteEl && this.currentPlatform === 'netflix') {
              platformNoteEl.innerHTML = `📹 ${titleResult.title} • 📝 Capture subtitles for vocabulary learning (click multiple times to collect more sentences)`;
              console.log('🎬 Updated Netflix video title:', titleResult.title);
            } else if (platformNoteEl && this.currentPlatform === 'udemy' && titleResult.data) {
              platformNoteEl.innerHTML = `📚 ${titleResult.data.courseTitle} • Capture course subtitles with lecture context for learning`;
              console.log('📚 Updated Udemy course title:', titleResult.data.courseTitle);
              
              // Update the course info section
              this.updateUdemyCourseInfo(titleResult.data);
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Could not update video title:', error.message);
      }
    }, 2000); // Wait 2 seconds for content scripts to load
  }

  // Update Udemy course information in the UI
  updateUdemyCourseInfo(courseInfo) {
    console.log('📚 Updating Udemy course info:', courseInfo);
    
    const courseInfoEl = this.container.querySelector('#udemy-course-info');
    if (courseInfoEl) {
      const courseTitleEl = courseInfoEl.querySelector('.course-title');
      const lectureTitleEl = courseInfoEl.querySelector('.lecture-title');
      const courseUrlEl = courseInfoEl.querySelector('#udemy-url');
      
      // Only update if we have better data than "Loading..."
      if (courseTitleEl) {
        const currentText = courseTitleEl.textContent || '';
        const newCourseTitle = courseInfo.courseTitle || 'Unknown Course';
        
        // Update if current is "Loading..." or we have better data
        if (currentText.includes('Loading...') || 
            (newCourseTitle !== 'Unknown Course' && newCourseTitle !== 'Udemy Course')) {
          courseTitleEl.textContent = `📚 Course: ${newCourseTitle}`;
          courseTitleEl.style.color = newCourseTitle === 'Unknown Course' ? '#666' : '#2563eb';
        }
      }
      
      if (lectureTitleEl) {
        const currentText = lectureTitleEl.textContent || '';
        const newLectureTitle = courseInfo.lectureTitle || 'Unknown Lecture';
        
        // Update if current is "Loading..." or we have better data
        if (currentText.includes('Loading...') || 
            (newLectureTitle !== 'Unknown Lecture' && newLectureTitle !== 'Current Lecture')) {
          lectureTitleEl.textContent = `📝 Lecture: ${newLectureTitle}`;
          lectureTitleEl.style.color = newLectureTitle === 'Unknown Lecture' ? '#666' : '#059669';
        }
      }
      
      if (courseUrlEl) {
        const url = courseInfo.url || window.location.href;
        courseUrlEl.innerHTML = `<a href="${url}" target="_blank" style="color: #007bff; text-decoration: none; font-size: 12px;">🔗 Open Course</a>`;
      }
      
      // Add a manual refresh button for course info
      const existingRefreshBtn = courseInfoEl.querySelector('.refresh-course-info');
      if (!existingRefreshBtn) {
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'refresh-course-info';
        refreshBtn.innerHTML = '🔄 Refresh Info';
        refreshBtn.style.cssText = 'margin-left: 10px; padding: 4px 8px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 11px;';
        refreshBtn.onclick = () => {
          console.log('🔄 Manual refresh requested');
          this.retryUdemyInfoUpdate();
        };
        courseInfoEl.appendChild(refreshBtn);
      }
      
      console.log('✅ Udemy course info updated successfully');
    } else {
      console.log('❌ Udemy course info element not found');
    }
  }

  // Retry mechanism for Udemy course info update
  async retryUdemyInfoUpdate() {
    console.log('🔄 Starting Udemy course info retry mechanism...');
    
    const maxRetries = 5; // Increased retries
    const initialDelay = 1000; // Start with 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Udemy info update attempt ${attempt}/${maxRetries}`);
      
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0] || !tabs[0].url.includes('udemy.com')) {
          console.log('❌ Not on Udemy page, stopping retry');
          return;
        }
        
        // First ping to check if content script is ready
        try {
          await chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' });
          console.log('✅ Content script is ready');
        } catch (pingError) {
          console.log('⚠️ Content script not ready, waiting...');
          throw new Error('Content script not ready');
        }
        
        const response = await chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'getUdemyVideoInfo' 
        });
        
        console.log('📋 Raw response from content script:', response);
        
        if (response && response.success && response.data) {
          console.log('✅ Udemy course info retrieved successfully:', response.data);
          
          // Validate that we have meaningful data
          if (response.data.courseTitle && response.data.courseTitle !== 'Udemy Course' &&
              response.data.lectureTitle && response.data.lectureTitle !== 'Current Lecture') {
            this.updateUdemyCourseInfo(response.data);
            return; // Success, stop retrying
          } else {
            console.log('⚠️ Received generic data, trying fallback extraction');
            throw new Error('Generic course data received');
          }
        } else {
          throw new Error(`Invalid response: ${JSON.stringify(response)}`);
        }
      } catch (error) {
        console.log(`❌ Attempt ${attempt} failed:`, error.message);
        
        // If this is the last attempt, try immediate fallback
        if (attempt === maxRetries) {
          console.log('🔄 Trying immediate fallback extraction...');
          await this.tryFallbackExtraction();
          return;
        }
      }
      
      // Progressive delay - wait longer for later attempts
      const delay = initialDelay * attempt;
      console.log(`⏰ Waiting ${delay}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.log('⚠️ All Udemy course info update attempts failed');
  }

  // Enhanced fallback extraction
  async tryFallbackExtraction() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0] || !tabs[0].url.includes('udemy.com')) return;
      
      let title = tabs[0].title;
      console.log('🔍 Fallback: Extracting from page title:', title);
      
      if (title && title !== 'Udemy') {
        // Clean up the title
        title = title.replace(/^Course:\s*/, '').trim();
        title = title.replace(/\s*\|\s*Udemy.*$/, '').trim();
        
        let courseTitle = 'Unknown Course';
        let lectureTitle = 'Current Lecture';
        
        // Try different parsing strategies
        if (title.includes(' - ')) {
          // Format: "Course Name - Lecture Name"
          const parts = title.split(' - ');
          courseTitle = parts[0].trim();
          if (parts.length > 1) {
            lectureTitle = parts[1].trim();
          }
        } else if (title.includes(': ')) {
          // Format: "Course Name: Lecture Name"
          const parts = title.split(': ');
          courseTitle = parts[0].trim();
          if (parts.length > 1) {
            lectureTitle = parts[1].trim();
          }
        } else {
          // Use entire title as course name
          courseTitle = title;
        }
        
        // Clean up extracted titles
        courseTitle = courseTitle.replace(/^\d+\.\s*/, ''); // Remove numbering
        lectureTitle = lectureTitle.replace(/^\d+\.\s*/, ''); // Remove numbering
        
        if (courseTitle && courseTitle.length > 3) {
          const fallbackData = {
            courseTitle: courseTitle,
            lectureTitle: lectureTitle,
            url: tabs[0].url,
            platform: 'udemy'
          };
          
          console.log('✅ Fallback extraction successful:', fallbackData);
          this.updateUdemyCourseInfo(fallbackData);
          return;
        }
      }
      
      console.log('❌ Fallback extraction failed, using generic info');
      this.updateUdemyCourseInfo({
        courseTitle: 'Udemy Course',
        lectureTitle: 'Current Lecture',
        url: tabs[0].url,
        platform: 'udemy'
      });
    } catch (error) {
      console.log('❌ Fallback extraction error:', error.message);
    }
  }

  // 🏗️ ARCHITECTURE: Platform Detection System
  // This is the core platform detection method that determines which platform-specific
  // features to load. When adding new platforms, follow this pattern:
  //
  // 1. Add URL detection pattern (e.g., url.includes('coursera.org'))
  // 2. Return platform string that matches naming convention
  // 3. Ensure platform string is used consistently across all files
  async detectPlatform() {
    try {
      // First try to get platform from active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const url = tabs[0].url;
        console.log('🔍 Platform detection - Current URL:', url);
        
        // Check if we're on a different video than before
        if (this.currentVideoUrl && this.currentVideoUrl !== url) {
          console.log('🔄 Video changed - clearing stored shortcut data');
          this.lastCapturedText = null;
          this.lastCapturedTimestamp = null;
        }
        this.currentVideoUrl = url;
        
        // 📝 PATTERN: Add new platforms here following the same pattern
        // Each platform should have a unique domain identifier
        if (url.includes('youtube.com')) {
          console.log('✅ Detected YouTube platform');
          return 'youtube';
        } else if (url.includes('netflix.com')) {
          console.log('✅ Detected Netflix platform');
          return 'netflix';
        } else if (url.includes('udemy.com')) {
          console.log('✅ Detected Udemy platform');
          return 'udemy';
        } else if (url.includes('coursera.org')) {
          console.log('✅ Detected Coursera platform');
          return 'coursera';
        }
        // 🚀 FUTURE: Add new platforms here:
        //   console.log('✅ Detected Coursera platform');
        //   return 'coursera';
        // } else if (url.includes('khanacademy.org')) {
        //   console.log('✅ Detected Khan Academy platform');
        //   return 'khanacademy';
        // } else if (url.includes('edx.org')) {
        //   console.log('✅ Detected edX platform');
        //   return 'edx';
        // }
      }
      
      // Fallback to checking available objects
      if (typeof YouTubeTranscriptFetcher !== 'undefined') {
        console.log('📺 Fallback to YouTube (YouTubeTranscriptFetcher available)');
        return 'youtube';
      }
      
      console.log('📺 Default fallback to YouTube');
      return 'youtube'; // Default fallback
    } catch (error) {
      console.log('⚠️ Platform detection error:', error);
      return 'youtube'; // Default fallback
    }
  }

  init() {
    console.log('🔧 Initializing UI for platform:', this.currentPlatform);
    
    // 🎨 ARCHITECTURE: Platform UI Customization System
    // This section defines platform-specific UI elements. When adding new platforms:
    //
    // 1. Add platform icon (emoji or SVG)
    // 2. Add platform display name  
    // 3. Add platform-specific button text and descriptions
    // 4. Add platform-specific feature notes
    //
    // 🔧 PATTERN: Use ternary chains or switch statements for 4+ platforms
    const platformIcon = this.currentPlatform === 'netflix' ? '🎭' : 
                         this.currentPlatform === 'udemy' ? '📚' : 
                         this.currentPlatform === 'coursera' ? '🎓' :
                         // 🚀 FUTURE: Add new platform icons:
                         // this.currentPlatform === 'khanacademy' ? '📊' :
                         // this.currentPlatform === 'edx' ? '🏛️' :
                         '📺'; // Default: YouTube
    
    const platformName = this.currentPlatform === 'netflix' ? 'Netflix' : 
                         this.currentPlatform === 'udemy' ? 'Udemy' : 
                         this.currentPlatform === 'coursera' ? 'Coursera' :
                         // 🚀 FUTURE: Add new platform names:
                         // this.currentPlatform === 'khanacademy' ? 'Khan Academy' :
                         // this.currentPlatform === 'edx' ? 'edX' :
                         'YouTube'; // Default
    
    const collectTitle = this.currentPlatform === 'netflix' ? 
      'Start Netflix subtitle collection' : 
      this.currentPlatform === 'udemy' ?
      'Capture Udemy course subtitles' :
      this.currentPlatform === 'coursera' ?
      'Collect Coursera lecture subtitles' :
      'Start caption collection (click stop when ready)'; // Default
      
    const platformNote = this.currentPlatform === 'netflix' ? 
      '📹 Netflix Content • 📝 Capture subtitles for vocabulary learning' : 
      this.currentPlatform === 'udemy' ?
      '📚 Udemy Course • Capture course subtitles with lecture context for learning' :
      this.currentPlatform === 'coursera' ?
      '🎓 Coursera • Capture lecture subtitles with course context' :
      '🎬 YouTube Video • Full transcript with timestamp navigation'; // Default
      
    const willShowCaptureButton = this.currentPlatform === 'netflix' || this.currentPlatform === 'udemy' || this.currentPlatform === 'coursera';
    console.log('🎯 Will generate Capture button HTML:', willShowCaptureButton);

    this.container.innerHTML = `
      <div class="transcript-restructurer">
        ${this.currentPlatform === 'udemy' ? `
        <div class="course-info" id="udemy-course-info">
          <div class="course-title">📚 Course: Loading...</div>
          <div class="lecture-title">📝 Lecture: Loading...</div>
          <div class="course-url">🔗 <span id="udemy-url">-</span></div>
        </div>` : ''}
        <div class="transcript-header">
          <h3>${platformIcon} ${platformName} Transcript Restructurer</h3>
          <div class="platform-indicator">
            <span class="platform-badge platform-${this.currentPlatform}">${platformName}</span>
            <button class="refresh-platform-btn" title="Refresh platform detection">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M23 4v6h-6"/>
                <path d="M1 20v-6h6"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
            </button>
          </div>
          <div class="header-buttons">
            ${this.currentPlatform === 'youtube' ? `
            <button class="start-collection-btn" title="${collectTitle}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="10,8 16,12 10,16"/>
              </svg>
              Collect
            </button>` : ''}
            ${this.currentPlatform === 'netflix' ? `
            <button class="capture-subtitle-btn" title="Capture currently visible Netflix subtitle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M8 21h8"/>
                <path d="M12 17v4"/>
                <path d="M5.5 17h13a2 2 0 0 0 1.8-2.9L14.6 3.1a2 2 0 0 0-3.2 0L5.7 14.1A2 2 0 0 0 7.5 17z"/>
              </svg>
              Capture
            </button>` : ''}
            ${this.currentPlatform === 'udemy' ? `
            <button class="capture-subtitle-btn" title="Capture currently visible course subtitle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Capture
            </button>` : ''}
            ${this.currentPlatform === 'coursera' ? `
            <button class="capture-subtitle-btn" title="Capture currently visible Coursera subtitle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 4h16v12H4z"/>
                <path d="M8 20h8"/>
              </svg>
              Capture
            </button>` : ''}
            <button class="clear-all-btn" title="Clear all captured sentences" style="display: none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Clear All
            </button>
            <button class="debug-platform-btn" title="Debug platform detection">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
              Debug
            </button>
          </div>
        </div>
        
        <div class="platform-note platform-${this.currentPlatform}">
          ${platformNote}
        </div>
        
        <!-- Unified controls section for all platforms -->
        
        <!-- Timing offset control for YouTube -->
        ${this.currentPlatform === 'youtube' ? `
        <div class="timing-offset-control" style="margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">
          <label style="display: flex; align-items: center; gap: 10px; font-size: 13px;">
            <span>⏰ Timing Offset:</span>
            <input type="range" class="timing-offset-slider" min="0" max="3" step="0.5" value="1" 
                   style="flex: 1; margin: 0 5px;">
            <span class="timing-offset-value" style="min-width: 40px; font-weight: bold;">1.0s</span>
          </label>
          <div style="font-size: 11px; color: #666; margin-top: 5px;">
            Capture from <span class="timing-offset-desc">1.0</span> seconds before click (0-3s)
          </div>
        </div>
        ` : ''}
        
        <!-- Platform-aware keyboard shortcuts hint for ALL platforms -->
        <div class="keyboard-shortcuts-hint" style="margin: 5px 0; padding: 8px; background: ${
          this.currentPlatform === 'netflix' ? '#fdf1f1' : 
          this.currentPlatform === 'udemy' ? '#f0f2ff' : 
          this.currentPlatform === 'coursera' ? '#f5f0ff' :
          '#e3f2fd'
        }; border-radius: 4px; border-left: 3px solid ${
          this.currentPlatform === 'netflix' ? '#e50914' : 
          this.currentPlatform === 'udemy' ? '#a435f0' : 
          this.currentPlatform === 'coursera' ? '#5624d0' :
          '#2196f3'
        };">
          <div style="font-size: 12px; color: ${
            this.currentPlatform === 'netflix' ? '#831a1a' : 
            this.currentPlatform === 'udemy' ? '#6a1b5a' : 
            this.currentPlatform === 'coursera' ? '#3a1a5a' :
            '#1976d2'
          }; display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
            ${platformIcon} <strong>Keys:</strong> 
            <span style="background: white; padding: 1px 4px; border-radius: 2px; margin: 0 2px; font-weight: bold;">H</span>${this.currentPlatform === 'youtube' ? 'Collect' : 'Capture'}
            ${this.currentPlatform === 'netflix' ? '<span style="background: #ffeaa7; padding: 1px 4px; border-radius: 2px; margin: 0 2px; font-weight: bold;">N</span>Netflix' : ''}
            ${this.currentPlatform === 'udemy' ? '<span style="background: #dda0dd; padding: 1px 4px; border-radius: 2px; margin: 0 2px; font-weight: bold;">U</span>Udemy' : ''}
            ${this.currentPlatform === 'coursera' ? '<span style="background: #d8bfd8; padding: 1px 4px; border-radius: 2px; margin: 0 2px; font-weight: bold;">C</span>Coursera' : ''}
            <span style="background: white; padding: 1px 4px; border-radius: 2px; margin: 0 2px;">A</span>Analyze
            <span style="background: white; padding: 1px 4px; border-radius: 2px; margin: 0 2px;">B</span>Jump
            <br><strong>Global:</strong>
            <span style="background: #e3f2fd; padding: 1px 4px; border-radius: 2px; margin: 0 2px; font-weight: bold;">Ctrl+Shift+C</span>${this.currentPlatform === 'youtube' ? 'Collect' : 'Capture'}
            <span style="background: #e3f2fd; padding: 1px 4px; border-radius: 2px; margin: 0 2px;">Ctrl+Shift+A</span>Analyze
          </div>
        </div>
        
        <div class="transcript-status"></div>
        
        <!-- ✅ NEW: Real-time audio quality indicator during recording -->
        <div class="live-audio-monitor" id="live-audio-monitor" style="display: none;">
          <div class="monitor-header">
            🎙️ Live Audio Monitor
            <div class="monitor-level-bar" id="monitor-level-bar"></div>
          </div>
          <div class="monitor-text" id="monitor-text">Initializing audio monitoring...</div>
        </div>
        
        <div class="transcript-content">
          <!-- ✅ SIMPLIFIED: Only reader mode container -->
          
          <!-- Captured Sentences Container - Unified for all platforms -->
          <div class="captured-sentences-container" id="captured-sentences-container">
            <!-- ✅ Enhanced Header with stats and actions -->
            <div class="captured-viewer-header" style="display: none;">
              <div class="captured-title-section">
                <h3 class="captured-title">
                  ${this.currentPlatform === 'youtube' ? '📖 Captured Segments' : 
                    this.currentPlatform === 'netflix' ? '🎭 Netflix Subtitles' :
                    this.currentPlatform === 'udemy' ? '📚 Course Subtitles' :
                    this.currentPlatform === 'coursera' ? '🎓 Lecture Subtitles' : '📝 Captured Subtitles'}
                </h3>
                <div class="captured-stats">
                  <span class="captured-count">0 items</span>
                </div>
              </div>
              <div class="captured-actions">
                <button class="export-captured-btn" title="Export all captured subtitles">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export
                </button>
              </div>
            </div>
            
            <!-- ✅ Modern table with enhanced styling -->
            <div class="captured-table-container" style="display: none;">
              <table class="captured-sentences">
                <thead>
                  <tr>
                    <th class="time-header">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                      Time
                    </th>
                    <th class="text-header">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10,9 9,9 8,9"/>
                      </svg>
                      Subtitle Text
                    </th>
                    <th class="actions-header">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                      </svg>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
            
            <!-- ✅ Empty state message -->
            <div class="captured-empty-state" id="captured-empty-state">
              <div class="empty-icon">${platformIcon}</div>
              <p class="empty-message">No subtitles captured yet</p>
              <p class="empty-hint">Use the ${this.currentPlatform === 'youtube' ? 'Collect' : 'Capture'} button above to start collecting subtitles</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // ✅ DEBUG: Check if Capture button was actually added to DOM
    const captureButton = this.container.querySelector('.capture-subtitle-btn');
    console.log('🔍 Capture button found in DOM after HTML generation:', !!captureButton);
    if (captureButton) {
      console.log('✅ Capture button element:', captureButton);
    } else {
      console.log('❌ Capture button NOT found in DOM');
    }
    
    this.attachEventListeners();
    this.addStyles();
  }

  attachEventListeners() {
    const collectBtn = this.container.querySelector('.start-collection-btn');
    
    // Bind collect button for YouTube only (Netflix and Udemy use single capture)
    if (collectBtn && this.currentPlatform === 'youtube') {
      collectBtn.addEventListener('click', () => this.toggleCollection());
    }
    
    // Platform-specific capture buttons
    const captureBtn = this.container.querySelector('.capture-subtitle-btn');
    if (captureBtn && this.currentPlatform === 'netflix') {
      captureBtn.addEventListener('click', () => this.captureCurrentSubtitle());
    } else if (captureBtn && this.currentPlatform === 'udemy') {
      captureBtn.addEventListener('click', () => {
        console.log('🎯 UDEMY CAPTURE BUTTON CLICKED - Platform:', this.currentPlatform);
        this.captureCurrentSubtitle(); // Now works for both Netflix and Udemy
      });
    } else if (captureBtn && this.currentPlatform === 'coursera') {
      captureBtn.addEventListener('click', () => {
        console.log('🎯 COURSERA CAPTURE BUTTON CLICKED - Platform:', this.currentPlatform);
        this.captureCurrentSubtitle();
      });
    }
    
    // Platform refresh button
    const refreshBtn = this.container.querySelector('.refresh-platform-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshPlatform());
    }
    
    // Debug platform button
    const debugBtn = this.container.querySelector('.debug-platform-btn');
    if (debugBtn) {
      debugBtn.addEventListener('click', () => this.debugPlatformDetection());
    }
    
    // Clear All button
    const clearAllBtn = this.container.querySelector('.clear-all-btn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => this.clearAllCapturedSentences());
    }
    
    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Timing offset controls
    this.setupTimingOffsetControls();
    
    // ✅ NEW: Add interactive card selection for subtitle modes
    this.setupSubtitleModeCards();
    
    // ✅ NEW: Add test audio permissions button
    const testAudioBtn = this.container.querySelector('#test-audio-permissions');
    if (testAudioBtn) {
      testAudioBtn.addEventListener('click', () => this.testAudioPermissions());
    }
    
    // ✅ NEW: Add event listeners for Whisper timing controls
    this.setupWhisperTimingControls();
    
    // Export captured sentences button
    const exportBtn = this.container.querySelector('.export-captured-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportCapturedSentences());
    }
    
    // ✅ SIMPLIFIED: Reader mode handles its own interactions
    // No more classic view buttons to attach
  }
  
  setupSubtitleModeCards() {
    const cards = this.container.querySelectorAll('.subtitle-mode-card');
    const radios = this.container.querySelectorAll('input[name="subtitle-mode"]');
    
    // Handle card clicks
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          this.updateCardActiveStates();
        }
      });
    });
    
    // Handle radio changes (for keyboard navigation)
    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        this.updateCardActiveStates();
      });
    });
    
    // Initial state
    this.updateCardActiveStates();
  }
  
  updateCardActiveStates() {
    const cards = this.container.querySelectorAll('.subtitle-mode-card');
    const checkedRadio = this.container.querySelector('input[name="subtitle-mode"]:checked');
    
    cards.forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio === checkedRadio) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  async listYouTubeTabs() {
    const statusEl = this.container.querySelector('.transcript-status');
    statusEl.textContent = 'Listing YouTube tabs...';
    statusEl.className = 'transcript-status loading';
    
    try {
      // Get all tabs
      const allTabs = await chrome.tabs.query({});
      const youtubeTabs = allTabs.filter(tab => tab.url && tab.url.includes('youtube.com/watch'));
      
      console.log('🎬 All YouTube video tabs:', youtubeTabs);
      
      if (youtubeTabs.length === 0) {
        statusEl.textContent = '❌ No YouTube video tabs found';
        statusEl.className = 'transcript-status error';
        return;
      }
      
      // Show list of YouTube tabs
      let tabList = `Found ${youtubeTabs.length} YouTube tab(s):\n`;
      youtubeTabs.forEach((tab, index) => {
        const isActive = tab.active ? ' (ACTIVE)' : '';
        tabList += `${index + 1}. ${tab.title}${isActive}\n`;
      });
      
      statusEl.innerHTML = tabList.replace(/\n/g, '<br>');
      statusEl.className = 'transcript-status success';
      
      console.log('📋 YouTube tabs found:', tabList);
      
    } catch (error) {
      console.error('❌ List tabs error:', error);
      statusEl.textContent = `Error: ${error.message}`;
      statusEl.className = 'transcript-status error';
    }
  }

  async testConnection() {
    const statusEl = this.container.querySelector('.transcript-status');
    statusEl.textContent = 'Testing content script connection...';
    statusEl.className = 'transcript-status loading';
    
    try {
      // Get current YouTube tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      console.log('🧪 Testing connection to tab:', {
        id: tab.id,
        url: tab.url,
        title: tab.title
      });
      
      if (!tab.url.includes('youtube.com')) {
        statusEl.textContent = `❌ Not on YouTube. Current: ${new URL(tab.url).hostname}`;
        statusEl.className = 'transcript-status error';
        return;
      }
      
      // Test simple ping message
      console.log('📡 Sending ping message...');
      const response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { action: 'ping' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      
      console.log('📨 Ping response:', response);
      
      if (response && response.pong) {
        statusEl.textContent = '✅ Content script connected successfully!';
        statusEl.className = 'transcript-status success';
      } else {
        statusEl.textContent = '❌ Content script not responding. Try refreshing YouTube page.';
        statusEl.className = 'transcript-status error';
      }
      
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      
      if (error.message.includes('Receiving end does not exist')) {
        statusEl.textContent = '❌ Content script not loaded. Refresh YouTube page and try again.';
      } else if (error.message === 'Timeout') {
        statusEl.textContent = '❌ Content script timeout. Refresh YouTube page.';
      } else {
        statusEl.textContent = `❌ Connection failed: ${error.message}`;
      }
      statusEl.className = 'transcript-status error';
    }
  }

  async checkCaptions() {
    const statusEl = this.container.querySelector('.transcript-status');
    statusEl.textContent = 'Checking for captions...';
    statusEl.className = 'transcript-status loading';
    
    try {
      console.log('🔍 Checking tabs...');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('📍 Found tabs:', tabs.length);
      
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }
      
      const tab = tabs[0];
      console.log('🎯 Current tab:', {
        id: tab.id,
        url: tab.url,
        title: tab.title
      });
      
      if (!tab.url.includes('youtube.com/watch')) {
        throw new Error(`Current tab is not a YouTube video. Tab URL: ${tab.url}`);
      }
      
      statusEl.textContent = `Checking captions on: ${tab.title}...`;
      
      // Send a test message to check caption availability
      console.log('📡 Sending message to tab:', tab.id);
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'getYouTubeTranscript' 
      });
      
      console.log('📨 Response received:', response);
      
      if (response && response.success) {
        statusEl.textContent = `✅ Captions available! Found ${response.transcript.length} segments via ${response.method}`;
        statusEl.className = 'transcript-status success';
      } else {
        statusEl.textContent = `❌ ${response?.error || 'No captions found'}`;
        statusEl.className = 'transcript-status error';
      }
      
    } catch (error) {
      console.error('❌ Check captions error:', error);
      statusEl.textContent = `Error: ${error.message}`;
      statusEl.className = 'transcript-status error';
    }
  }

  async fetchAndRestructure() {
    const statusEl = this.container.querySelector('.transcript-status');
    statusEl.textContent = 'Fetching transcript...';
    statusEl.className = 'transcript-status loading';
    
    try {
      console.log('🎬 Starting transcript fetch...');
      console.log('📋 Current state:', {
        hasTranscriptViewer: typeof TranscriptViewer !== 'undefined',
        hasYouTubeTranscriptFetcher: typeof YouTubeTranscriptFetcher !== 'undefined',
        currentTranscript: this.currentTranscript?.length || 0,
        restructuredSentences: this.restructuredSentences?.length || 0
      });
      
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      console.log('📍 Current tab URL:', tab.url);
      
      if (!tab.url.includes('youtube.com/watch')) {
        throw new Error('Please open a YouTube video first');
      }
      
      statusEl.textContent = 'Connecting to YouTube page...';
      
      // Send message to content script
      console.log('📡 Sending message to content script...');
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getYouTubeTranscript' });
      
      console.log('📨 Content script response:', response);
      
      if (!response || !response.success) {
        const errorMsg = response?.error || 'Failed to fetch transcript - no response from content script';
        console.error('❌ Transcript fetch failed:', errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!response.transcript || response.transcript.length === 0) {
        throw new Error('No transcript data found. Video may not have captions available.');
      }
      
      // Check if we only got metadata
      if (response.method === 'metadataOnly' && response.warning) {
        statusEl.textContent = '⚠️ ' + response.warning;
        statusEl.className = 'transcript-status warning';
        
        // Add helper buttons for alternative methods
        const actionsHtml = `
          <div style="margin-top: 10px;">
            <p style="font-size: 12px; margin-bottom: 8px;">No real captions found. Try these alternatives:</p>
            <button class="alt-method-btn" onclick="document.querySelector('.start-collection-btn').click()">
              🔴 Use Real-time Collection
            </button>
            <button class="alt-method-btn" onclick="window.open('https://www.youtube.com/watch?v=${response.videoId}', '_blank')">
              📝 Open YouTube Transcript Panel
            </button>
          </div>
        `;
        
        // Add styles for helper buttons
        if (!document.querySelector('#alt-method-styles')) {
          const style = document.createElement('style');
          style.id = 'alt-method-styles';
          style.textContent = `
            .alt-method-btn {
              margin: 4px;
              padding: 6px 12px;
              background: #ff5722;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            }
            .alt-method-btn:hover {
              background: #e64a19;
            }
            .transcript-status.warning {
              background: #fff3cd;
              color: #856404;
              border: 1px solid #ffeeba;
            }
          `;
          document.head.appendChild(style);
        }
        
        statusEl.innerHTML += actionsHtml;
      }
      
      this.currentTranscript = response.transcript;
      console.log('✅ Transcript fetched:', this.currentTranscript.length, 'segments via', response.method);
      statusEl.textContent = `Fetched ${this.currentTranscript.length} segments. Restructuring...`;
      
      // Restructure the transcript
      await this.restructureTranscript();
      
      console.log('✅ Restructuring complete:', this.restructuredSentences.length, 'sentences');
      statusEl.textContent = `Restructured into ${this.restructuredSentences.length} sentences`;
      statusEl.className = 'transcript-status success';
      
      // Display results
      this.displayTranscript();
      
    } catch (error) {
      console.error('❌ Transcript fetch error:', error);
      statusEl.textContent = `Error: ${error.message}`;
      statusEl.className = 'transcript-status error';
      
      // Show more detailed error information
      if (error.message.includes('content script')) {
        statusEl.textContent += ' (Try refreshing the YouTube page)';
      }
    }
  }

  async restructureTranscript() {
    const useAI = this.container.querySelector('#use-ai-restructure').checked;
    const pauseThreshold = parseFloat(this.container.querySelector('#pause-threshold').value);
    
    // Clean up duplicates first
    const cleanedTranscript = this.removeDuplicateSegments(this.currentTranscript);
    console.log(`🧹 Cleaned transcript: ${this.currentTranscript.length} → ${cleanedTranscript.length} segments`);
    
    // Ensure AI service is available and properly initialized
    let aiServiceToUse = null;
    if (useAI) {
      if (this.aiService && typeof this.aiService.generateAnalysis === 'function') {
        aiServiceToUse = this.aiService;
      } else if (window.aiService && typeof window.aiService.generateAnalysis === 'function') {
        aiServiceToUse = window.aiService;
      } else {
        console.warn('⚠️ AI service not available, using basic punctuation only');
      }
    }
    
    this.restructuredSentences = await this.transcriptFetcher.restructureTranscript(
      cleanedTranscript,
      {
        useAI: !!aiServiceToUse,
        aiService: aiServiceToUse,
        language: this.detectLanguage() || 'en'
      }
    );
  }

  removeDuplicateSegments(segments) {
    if (!segments || segments.length === 0) return [];
    
    console.log('🧹 Starting cleanup of', segments.length, 'segments');
    
    // Step 1: Get all text and apply super aggressive cleaning
    const allText = segments.map(s => s.text).join(' ');
    console.log('📝 Original combined text length:', allText.length);
    
    // Step 2: Ultra-aggressive pattern removal
    const cleanedText = this.superAggressiveClean(allText);  
    console.log('🔥 After super aggressive clean:', cleanedText.length);
    
    // Step 3: Extract meaningful content
    const meaningfulSentences = this.extractMeaningfulContent(cleanedText);
    console.log('✨ Meaningful sentences found:', meaningfulSentences.length);
    
    // Step 4: Create clean segments 
    if (meaningfulSentences.length === 0) {
      return [{
        start: segments[0]?.start || 0,
        end: segments[0]?.start + 5 || 5,
        duration: 5,
        text: "Could not extract meaningful content from repetitive captions. Try using 'Collect' feature while playing the video."
      }];
    }
    
    const avgDuration = segments.length > 0 ? 
      Math.max((segments[segments.length - 1].start - segments[0].start) / meaningfulSentences.length, 3) : 3;
    
    return meaningfulSentences.map((text, index) => ({
      start: (segments[0]?.start || 0) + (index * avgDuration),
      end: (segments[0]?.start || 0) + ((index + 1) * avgDuration),
      duration: avgDuration,
      text: text
    }));
  }

  superAggressiveClean(text) {
    console.log('🔥 Starting super aggressive cleaning...');
    
    let cleaned = text;
    
    // Step 1: Handle exact sentence repetitions (like "I'm very excited. I'm very excited. I'm very excited.")
    cleaned = this.removeExactSentenceRepetitions(cleaned);
    
    // Step 2: Handle partial sentence repetitions (like "And because of our meal program, And because of our meal program,")
    cleaned = this.removePartialSentenceRepetitions(cleaned);
    
    // Step 3: Find and eliminate phrase-level repetitive patterns
    const words = cleaned.split(' ');
    const patterns = new Map();
    
    // Find all 3-15 word patterns and count them (extended range)
    for (let len = 3; len <= 15; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const pattern = words.slice(i, i + len).join(' ');
        patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
      }
    }
    
    // Remove patterns that occur more than once, keeping only first occurrence
    const sortedPatterns = Array.from(patterns.entries())
      .filter(([pattern, count]) => count > 1)
      .sort(([a], [b]) => b.length - a.length); // Longer patterns first
    
    console.log('🎯 Found', sortedPatterns.length, 'repetitive patterns');
    
    for (const [pattern, count] of sortedPatterns) {
      if (count > 1) {
        // Replace all but first occurrence with empty string
        const regex = new RegExp(this.escapeRegex(pattern), 'g');
        let replacements = 0;
        cleaned = cleaned.replace(regex, (match) => {
          replacements++;
          return replacements === 1 ? match : '';
        });
      }
    }
    
    // Step 4: Remove immediate word repetitions
    cleaned = cleaned.replace(/\b(\w+)(\s+\1)+\b/g, '$1');
    
    // Step 5: Normalize whitespace  
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    console.log('✨ Cleaning reduced text from', text.length, 'to', cleaned.length, 'characters');
    
    return cleaned;
  }

  removeExactSentenceRepetitions(text) {
    console.log('🎯 Removing exact sentence repetitions...');
    
    // Split by sentence-ending punctuation, but keep the punctuation
    const sentences = text.split(/([.!?]+\s*)/).filter(s => s.trim());
    const cleanedSentences = [];
    const seenSentences = new Set();
    
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i]?.trim();
      const punctuation = sentences[i + 1] || '';
      
      if (sentence && sentence.length > 5) {
        // Normalize sentence for comparison (remove extra spaces, convert to lowercase)
        const normalizedSentence = sentence.toLowerCase().replace(/\s+/g, ' ').trim();
        
        if (!seenSentences.has(normalizedSentence)) {
          seenSentences.add(normalizedSentence);
          cleanedSentences.push(sentence + punctuation);
        } else {
          console.log('🗑️ Removed duplicate sentence:', sentence.substring(0, 50) + '...');
        }
      }
    }
    
    return cleanedSentences.join(' ');
  }

  removePartialSentenceRepetitions(text) {
    console.log('🎯 Removing partial sentence repetitions...');
    
    // Handle patterns like "And because of our meal program, And because of our meal program,"
    let cleaned = text;
    
    // Split into potential sentence fragments by commas and periods
    const fragments = cleaned.split(/([,.]\s*)/);
    const processedFragments = [];
    
    for (let i = 0; i < fragments.length; i += 2) {
      const fragment = fragments[i]?.trim();
      const separator = fragments[i + 1] || '';
      
      if (fragment && fragment.length > 10) {
        // Check if this fragment appears immediately again
        const nextFragment = fragments[i + 2]?.trim();
        
        if (nextFragment && this.areSimilarFragments(fragment, nextFragment)) {
          // Skip the repetition, keep only the first occurrence
          console.log('🗑️ Removed duplicate fragment:', fragment.substring(0, 30) + '...');
          processedFragments.push(fragment + separator);
          i += 2; // Skip the next fragment since it's a duplicate
        } else {
          processedFragments.push(fragment + separator);
        }
      } else if (fragment) {
        processedFragments.push(fragment + separator);
      }
    }
    
    return processedFragments.join('');
  }

  areSimilarFragments(fragment1, fragment2) {
    // Check if two fragments are similar enough to be considered duplicates
    const norm1 = fragment1.toLowerCase().replace(/\s+/g, ' ').trim();
    const norm2 = fragment2.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Exact match
    if (norm1 === norm2) return true;
    
    // Check if one is a subset of the other (for partial repetitions)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const similarity = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
      return similarity > 0.8; // 80% similarity threshold
    }
    
    return false;
  }

  extractMeaningfulContent(text) {
    console.log('✨ Extracting meaningful content from cleaned text...');
    
    // Step 1: Split into natural sentences first
    const naturalSentences = this.splitIntoNaturalSentences(text);
    console.log('📝 Found', naturalSentences.length, 'natural sentences');
    
    // Step 2: Filter and clean each sentence
    const meaningfulSentences = [];
    const seenNormalizedSentences = new Set();
    
    for (const sentence of naturalSentences) {
      const cleanedSentence = this.cleanSentence(sentence);
      
      if (cleanedSentence.length < 10) continue; // Too short
      
      // Normalize for duplicate detection
      const normalized = cleanedSentence.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      
      if (seenNormalizedSentences.has(normalized)) {
        console.log('🗑️ Skipped duplicate sentence:', cleanedSentence.substring(0, 40) + '...');
        continue;
      }
      
      // Validate sentence quality
      if (this.isHighQualitySentence(cleanedSentence)) {
        meaningfulSentences.push(cleanedSentence);
        seenNormalizedSentences.add(normalized);
      } else {
        console.log('🗑️ Filtered low quality sentence:', cleanedSentence.substring(0, 40) + '...');
      }
    }
    
    console.log('✅ Extracted', meaningfulSentences.length, 'high-quality sentences');
    return meaningfulSentences.slice(0, 15); // Allow up to 15 good sentences
  }

  splitIntoNaturalSentences(text) {
    // Split by strong sentence boundaries but preserve the structure
    const sentences = [];
    
    // First split by clear sentence endings
    const parts = text.split(/([.!?]+\s+)/);
    
    let currentSentence = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.match(/[.!?]+\s+/)) {
        // This is punctuation + space
        currentSentence += part.replace(/\s+$/, ''); // Remove trailing space
        if (currentSentence.trim().length > 5) {
          sentences.push(currentSentence.trim());
        }
        currentSentence = '';
      } else {
        currentSentence += part;
      }
    }
    
    // Add any remaining content
    if (currentSentence.trim().length > 5) {
      sentences.push(currentSentence.trim());
    }
    
    // If we got very few sentences, try splitting by other methods
    if (sentences.length < 3) {
      console.log('🔄 Few sentences found, trying alternative splitting...');
      return this.splitByAlternativeMethod(text);
    }
    
    return sentences;
  }

  splitByAlternativeMethod(text) {
    // Alternative splitting when punctuation is poor
    const words = text.split(' ').filter(w => w.trim());
    const sentences = [];
    
    // Create sentences of reasonable length (10-20 words)
    for (let i = 0; i < words.length; i += 12) {
      const sentenceWords = words.slice(i, i + 15);
      if (sentenceWords.length >= 4) {
        const sentence = sentenceWords.join(' ').trim();
        sentences.push(sentence);
      }
    }
    
    return sentences;
  }

  cleanSentence(sentence) {
    return sentence
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/^[^\w]+/, '') // Remove leading non-word characters
      .replace(/[^\w]+$/, '') // Remove trailing non-word characters  
      .trim();
  }

  isHighQualitySentence(sentence) {
    const words = sentence.split(' ').filter(w => w.trim());
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));
    
    // Quality checks
    const hasGoodLength = words.length >= 4 && words.length <= 30;
    const hasGoodUniqueness = uniqueWords.size >= Math.floor(words.length * 0.6); // 60% unique words
    const hasReasonableLength = sentence.length >= 15 && sentence.length <= 250;
    const notTooRepetitive = !this.isTooRepetitive(sentence);
    
    return hasGoodLength && hasGoodUniqueness && hasReasonableLength && notTooRepetitive;
  }

  isTooRepetitive(sentence) {
    const words = sentence.toLowerCase().split(' ');
    const wordCounts = {};
    
    for (const word of words) {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 2) {
        wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
      }
    }
    
    // Check if any significant word appears too many times
    for (const [word, count] of Object.entries(wordCounts)) {
      if (count > 2 && word.length > 3) {
        return true; // Too repetitive
      }
    }
    
    return false;
  }

  cleanCollectedSegments(segments) {
    console.log('🧹 Cleaning collected segments...');
    
    if (!segments || segments.length === 0) return [];
    
    // ✅ NEW: Detect if this looks like auto-generated captions
    if (this.isAutoGeneratedPattern(segments) || this.hasAutoGeneratedMarkers(segments)) {
      console.log('🤖 Detected auto-generated captions - using enhanced stream reconstruction');
      const reconstructed = this.reconstructAutoGeneratedStream(segments);
      // Apply additional master cleanup for auto-generated content
      return this.masterCleanupSegments(reconstructed);
    }
    
    // Enhanced cleaning for manual captions
    const textCleanedSegments = segments.map(segment => ({
      ...segment,
      text: this.cleanSingleSegmentText(segment.text)
    })).filter(segment => segment.text && segment.text.length > 3);
    
    const uniqueSegments = this.removeExactDuplicateSegments(textCleanedSegments);
    const mergedSegments = this.mergeRepetitiveSegments(uniqueSegments);
    
    console.log(`📊 Segment cleaning: ${segments.length} → ${textCleanedSegments.length} → ${uniqueSegments.length} → ${mergedSegments.length}`);
    
    return mergedSegments;
  }

  isAutoGeneratedPattern(segments) {
    if (segments.length < 3) return false;
    
    // Check for cascading overlap pattern
    let overlapCount = 0;
    for (let i = 1; i < Math.min(segments.length, 5); i++) {
      const current = segments[i].text.toLowerCase();
      const previous = segments[i-1].text.toLowerCase();
      
      // Check if current segment contains significant portion of previous
      const words1 = previous.split(' ');
      const words2 = current.split(' ');
      
      if (words1.length > 3 && words2.length > 3) {
        const lastWords = words1.slice(-3).join(' ');
        if (current.includes(lastWords)) {
          overlapCount++;
        }
      }
    }
    
    // If 60%+ segments show overlap pattern, likely auto-generated
    return overlapCount / Math.min(segments.length - 1, 4) > 0.6;
  }

  reconstructAutoGeneratedStream(segments) {
    console.log('🔄 Reconstructing auto-generated stream from', segments.length, 'segments');
    
    // Step 1: Build continuous text stream with timing info
    let streamText = '';
    let wordTimings = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const cleanText = segment.text.replace(/[^\w\s.!?]/g, ' ').replace(/\s+/g, ' ').trim();
      
      if (i === 0) {
        // First segment - add everything
        streamText += cleanText + ' ';
        const words = cleanText.split(' ');
        words.forEach(word => {
          if (word.length > 0) {
            wordTimings.push({
              word: word,
              time: segment.start,
              originalIndex: i
            });
          }
        });
      } else {
        // Find what's new in this segment
        const newContent = this.extractNewContent(streamText, cleanText);
        if (newContent && newContent.length > 2) {
          streamText += newContent + ' ';
          const newWords = newContent.split(' ');
          newWords.forEach(word => {
            if (word.length > 0) {
              wordTimings.push({
                word: word,
                time: segment.start,
                originalIndex: i
              });
            }
          });
        }
      }
    }
    
    console.log('📝 Reconstructed stream:', streamText.substring(0, 100) + '...');
    
    // Step 2: Break into proper sentences
    const sentences = this.intelligentSentenceSegmentation(streamText, wordTimings);
    
    console.log('✅ Reconstructed', sentences.length, 'proper sentences');
    return sentences;
  }

  extractNewContent(existingText, newSegmentText) {
    const existing = existingText.toLowerCase();
    const newText = newSegmentText.toLowerCase();
    
    // Find the longest matching suffix of existing with prefix of new
    let bestOverlapLength = 0;
    let bestStartPos = 0;
    
    const existingWords = existing.split(' ');
    const newWords = newText.split(' ');
    
    // Look for overlap in last 10 words of existing text
    for (let overlapLen = 1; overlapLen <= Math.min(10, existingWords.length, newWords.length); overlapLen++) {
      const existingSuffix = existingWords.slice(-overlapLen).join(' ');
      const newPrefix = newWords.slice(0, overlapLen).join(' ');
      
      if (existingSuffix === newPrefix && overlapLen > bestOverlapLength) {
        bestOverlapLength = overlapLen;
        bestStartPos = overlapLen;
      }
    }
    
    // Return the non-overlapping part
    const uniqueWords = newWords.slice(bestStartPos);
    return uniqueWords.join(' ');
  }

  intelligentSentenceSegmentation(text, wordTimings) {
    // Clean up text first
    let cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Add periods at natural break points (simple heuristic)
    cleanText = cleanText.replace(/\b(and|but|so|then|now|well|okay|right)\s+/gi, (match, word, offset) => {
      // Don't break if it's at the start or if there's already punctuation nearby
      if (offset < 10 || /[.!?]\s*$/.test(cleanText.substring(Math.max(0, offset - 10), offset))) {
        return match;
      }
      return '. ' + match.charAt(0).toUpperCase() + match.slice(1);
    });
    
    // Split into sentences
    const sentences = cleanText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    
    // Create segments with estimated timings
    const segments = [];
    let wordIndex = 0;
    const wordsPerSentence = Math.floor(wordTimings.length / Math.max(sentences.length, 1));
    
    sentences.forEach((sentence, index) => {
      const sentenceWords = sentence.split(' ').length;
      const startWordIndex = Math.floor((wordIndex / wordTimings.length) * wordTimings.length);
      const endWordIndex = Math.min(startWordIndex + sentenceWords, wordTimings.length - 1);
      
      const startTime = wordTimings[startWordIndex]?.time || 0;
      const endTime = wordTimings[endWordIndex]?.time || startTime + 5;
      
      // Capitalize first word
      const capitalizedSentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      
      segments.push({
        start: startTime,
        end: endTime,
        duration: endTime - startTime,
        text: capitalizedSentence,
        timestamp: Date.now(),
        reconstructed: true,
        originalSegments: Math.floor(sentenceWords / 3) // Rough estimate
      });
      
      wordIndex += sentenceWords;
    });
    
    return segments;
  }

  cleanSingleSegmentText(text) {
    if (!text) return '';
    
    console.log('🧽 Cleaning segment text:', text.substring(0, 100) + '...');
    
    let cleaned = text;
    
    // Step 1: Remove word-level repetitions: "word word word" -> "word"
    cleaned = cleaned.replace(/\b(\w+)(\s+\1)+\b/g, '$1');
    
    // Step 2: Ultra-aggressive pattern matching for complex repetitions
    cleaned = this.removeComplexRepetitions(cleaned);
    
    // Step 3: Remove phrase repetitions: "hello world hello world" -> "hello world"
    const words = cleaned.split(' ').filter(w => w.trim());
    
    // Check various repetition patterns
    cleaned = this.detectAndRemovePatternRepetitions(words);
    
    console.log('✨ Cleaned result:', cleaned.substring(0, 100) + '...');
    return cleaned.trim();
  }

  removeComplexRepetitions(text) {
    // Handle patterns like "families but let me start going after families but let me start going after weddings"
    let cleaned = text;
    
    // Find all sequences of 3-15 words and remove repetitions
    const words = text.split(' ').filter(w => w.trim());
    
    for (let patternLength = 3; patternLength <= Math.min(15, Math.floor(words.length / 2)); patternLength++) {
      for (let i = 0; i <= words.length - patternLength * 2; i++) {
        const pattern = words.slice(i, i + patternLength);
        const patternText = pattern.join(' ');
        
        // Check if this pattern repeats immediately after
        const nextPattern = words.slice(i + patternLength, i + patternLength * 2);
        const nextPatternText = nextPattern.join(' ');
        
        if (this.arePatternsSimilar(patternText, nextPatternText)) {
          // Found repetition - remove all but first occurrence
          const beforePattern = words.slice(0, i).join(' ');
          const afterPattern = words.slice(i + patternLength * 2).join(' ');
          
          console.log('🗑️ Removed complex repetition:', patternText);
          cleaned = [beforePattern, patternText, afterPattern].filter(p => p.trim()).join(' ');
          
          // Re-split for next iteration
          words.splice(0, words.length, ...cleaned.split(' ').filter(w => w.trim()));
          break;
        }
      }
    }
    
    return cleaned;
  }

  detectAndRemovePatternRepetitions(words) {
    if (words.length < 6) return words.join(' ');
    
    // Strategy 1: Check if first half matches second half
    const halfLength = Math.floor(words.length / 2);
    if (halfLength >= 3) {
      const firstHalf = words.slice(0, halfLength);
      const secondHalf = words.slice(halfLength, halfLength * 2);
      
      if (this.areWordArraysSimilar(firstHalf, secondHalf)) {
        console.log('🗑️ Removed half-repetition:', firstHalf.join(' '));
        return firstHalf.join(' ');
      }
    }
    
    // Strategy 2: Check for triple repetitions
    const thirdLength = Math.floor(words.length / 3);
    if (thirdLength >= 3) {
      const firstThird = words.slice(0, thirdLength);
      const secondThird = words.slice(thirdLength, thirdLength * 2);
      const thirdThird = words.slice(thirdLength * 2, thirdLength * 3);
      
      if (this.areWordArraysSimilar(firstThird, secondThird) && 
          this.areWordArraysSimilar(firstThird, thirdThird)) {
        console.log('🗑️ Removed triple-repetition:', firstThird.join(' '));
        return firstThird.join(' ');
      }
    }
    
    // Strategy 3: Look for any repeating subsequences
    for (let patternLength = 4; patternLength <= Math.floor(words.length / 2); patternLength++) {
      for (let start = 0; start <= words.length - patternLength * 2; start++) {
        const pattern = words.slice(start, start + patternLength);
        const nextPattern = words.slice(start + patternLength, start + patternLength * 2);
        
        if (this.areWordArraysSimilar(pattern, nextPattern)) {
          // Found repetition - keep only the first occurrence
          const before = words.slice(0, start);
          const after = words.slice(start + patternLength * 2);
          
          console.log('🗑️ Removed pattern repetition:', pattern.join(' '));
          return [...before, ...pattern, ...after].join(' ');
        }
      }
    }
    
    return words.join(' ');
  }

  arePatternsSimilar(pattern1, pattern2) {
    const norm1 = pattern1.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const norm2 = pattern2.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    
    // Exact match
    if (norm1 === norm2) return true;
    
    // High similarity (90%+ overlap)
    if (norm1.length > 10 && norm2.length > 10) {
      const similarity = this.calculateSimilarity(norm1, norm2);
      return similarity > 0.9;
    }
    
    return false;
  }

  areWordArraysSimilar(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    
    const norm1 = arr1.map(w => w.toLowerCase().replace(/[^\w]/g, '')).join(' ');
    const norm2 = arr2.map(w => w.toLowerCase().replace(/[^\w]/g, '')).join(' ');
    
    return norm1 === norm2;
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  removeExactDuplicateSegments(segments) {
    const uniqueSegments = [];
    const seenTexts = new Set();
    
    for (const segment of segments) {
      const normalizedText = segment.text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      
      if (!seenTexts.has(normalizedText) && normalizedText.length > 5) {
        seenTexts.add(normalizedText);
        uniqueSegments.push(segment);
      } else {
        console.log('🗑️ Removed duplicate segment:', segment.text.substring(0, 40) + '...');
      }
    }
    
    return uniqueSegments;
  }

  mergeRepetitiveSegments(segments) {
    const mergedSegments = [];
    
    for (let i = 0; i < segments.length; i++) {
      const currentSegment = segments[i];
      let mergedText = currentSegment.text;
      
      // Look ahead for similar segments to merge
      let j = i + 1;
      while (j < segments.length && j < i + 3) { // Only look 3 segments ahead
        const nextSegment = segments[j];
        
        if (this.areSegmentsSimilar(currentSegment.text, nextSegment.text)) {
          console.log('🔗 Merging similar segments:', currentSegment.text.substring(0, 30), 'with', nextSegment.text.substring(0, 30));
          // Take the longer, more complete text
          if (nextSegment.text.length > mergedText.length) {
            mergedText = nextSegment.text;
          }
          j++;
        } else {
          break;
        }
      }
      
      // Create merged segment
      mergedSegments.push({
        ...currentSegment,
        text: mergedText
      });
      
      // Skip the segments we merged
      i = j - 1;
    }
    
    return mergedSegments;
  }

  areSegmentsSimilar(text1, text2) {
    const norm1 = text1.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const norm2 = text2.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    
    // Check if one contains the other (partial duplicates)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const similarity = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
      return similarity > 0.7; // 70% similarity
    }
    
    return false;
  }

  isGoodSentence(sentence) {
    const words = sentence.split(' ');
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));
    
    return (
      words.length >= 4 && 
      words.length <= 25 &&
      uniqueWords.size >= Math.floor(words.length * 0.6) && // At least 60% unique words
      sentence.length >= 20 &&
      sentence.length <= 200
    );
  }

  extractSentences(text) {
    console.log('🔍 Original text length:', text.length);
    
    // Step 1: Aggressive deduplication - split by pattern repetitions
    const patterns = this.findRepetitivePatterns(text);
    let cleanText = text;
    
    // Remove the most obvious repetitive patterns
    for (const pattern of patterns) {
      const regex = new RegExp(this.escapeRegex(pattern) + '\\s*', 'g');
      const matches = cleanText.match(regex);
      if (matches && matches.length > 2) {
        // Keep only first occurrence
        cleanText = cleanText.replace(regex, pattern + ' ');
      }
    }
    
    console.log('🧹 After pattern removal:', cleanText.length);
    
    // Step 2: Extract meaningful phrases
    const meaningfulPhrases = this.extractMeaningfulPhrases(cleanText);
    console.log('📝 Meaningful phrases found:', meaningfulPhrases.length);
    
    return meaningfulPhrases;
  }

  findRepetitivePatterns(text) {
    const patterns = new Set();
    const words = text.split(' ');
    
    // Look for 3-8 word patterns that repeat
    for (let len = 3; len <= 8; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const pattern = words.slice(i, i + len).join(' ');
        const count = (text.match(new RegExp(this.escapeRegex(pattern), 'g')) || []).length;
        
        if (count >= 3) {
          patterns.add(pattern);
        }
      }
    }
    
    // Sort by length (longer patterns first)
    return Array.from(patterns).sort((a, b) => b.length - a.length);
  }

  extractMeaningfulPhrases(text) {
    const phrases = [];
    const words = text.split(' ');
    let currentPhrase = [];
    const seenPhrases = new Set();
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].trim();
      if (!word) continue;
      
      currentPhrase.push(word);
      
      // End phrase when we hit punctuation or reach reasonable length
      if (word.match(/[.!?]$/) || currentPhrase.length >= 12) {
        let phrase = currentPhrase.join(' ').trim();
        
        // Clean the phrase
        phrase = this.cleanPhrase(phrase);
        
        // Only add if it's new and meaningful
        if (phrase.length > 10 && !seenPhrases.has(phrase.toLowerCase())) {
          const words = phrase.split(' ');
          const uniqueWords = new Set(words.map(w => w.toLowerCase()));
          
          // Good ratio of unique words (avoid repetitive phrases)
          if (uniqueWords.size / words.length > 0.7) {
            phrases.push(phrase);
            seenPhrases.add(phrase.toLowerCase());
          }
        }
        
        currentPhrase = [];
      }
    }
    
    // Add final phrase if exists
    if (currentPhrase.length > 2) {
      let phrase = this.cleanPhrase(currentPhrase.join(' ').trim());
      if (phrase.length > 10 && !seenPhrases.has(phrase.toLowerCase())) {
        phrases.push(phrase);
      }
    }
    
    return phrases;
  }

  cleanPhrase(phrase) {
    return phrase
      .replace(/\b(\w+)(\s+\1)+/g, '$1') // Remove word repetitions
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/^[^a-zA-Z]+/, '') // Remove leading non-letters
      .trim();
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  isValidSentence(sentence) {
    // Basic validation for reasonable sentences
    const wordCount = sentence.split(' ').length;
    const hasRepeatedPhrases = /(.{10,})\1/.test(sentence.toLowerCase());
    const tooManyRepeats = (sentence.match(/\b\w+\b/g) || []).length !== 
                          [...new Set(sentence.toLowerCase().match(/\b\w+\b/g) || [])].length * 1.5;
    
    return wordCount >= 3 && wordCount <= 50 && !hasRepeatedPhrases && !tooManyRepeats;
  }

  detectLanguage() {
    // Try to detect language from current transcript
    if (!this.currentTranscript || this.currentTranscript.length === 0) {
      return 'en';
    }
    
    const sampleText = this.currentTranscript.slice(0, 3).map(t => t.text).join(' ').toLowerCase();
    
    // Simple language detection based on common words
    if (sampleText.includes('het ') || sampleText.includes('de ') || sampleText.includes('een ')) {
      return 'nl';
    } else if (sampleText.includes('the ') || sampleText.includes('and ') || sampleText.includes('is ')) {
      return 'en';
    }
    
    return 'en'; // Default to English
  }

  displayTranscript() {
    // ✅ SIMPLIFIED: Only show reader view - no more classic view toggle
    this.showReaderView();
  }


  displayTranscriptInReader(segments) {
    // ✅ NEW: Force display segments in reader
    console.log('📖 Forcing display of', segments.length, 'segments in reader');
    
    // Create reader container if not exists
    let readerContainer = this.container.querySelector('.transcript-reader-container');
    if (!readerContainer) {
      readerContainer = document.createElement('div');
      readerContainer.className = 'transcript-reader-container';
      this.container.querySelector('.transcript-content').appendChild(readerContainer);
    }
    
    // Initialize or update TranscriptViewer
    if (typeof TranscriptViewer !== 'undefined') {
      if (!this.transcriptViewer) {
        console.log('📖 Creating new TranscriptViewer with', segments.length, 'segments for platform:', this.currentPlatform);
        this.transcriptViewer = new TranscriptViewer(readerContainer, segments, this.currentPlatform);
        console.log('✅ TranscriptViewer created successfully');
      } else {
        console.log('📖 Updating existing TranscriptViewer with', segments.length, 'segments');
        this.transcriptViewer.updateTranscriptData(segments);
        console.log('✅ TranscriptViewer updated successfully');
      }
    } else {
      console.error('❌ TranscriptViewer not loaded - check if transcript-viewer.js is included');
      readerContainer.innerHTML = `
        <div style="color: red; padding: 20px; text-align: center;">
          TranscriptViewer not loaded. Please check console for errors.
        </div>
      `;
    }
  }

  showReaderView() {
    // ✅ SIMPLIFIED: Only reader view exists now
    
    // Create reader container if not exists
    let readerContainer = this.container.querySelector('.transcript-reader-container');
    if (!readerContainer) {
      readerContainer = document.createElement('div');
      readerContainer.className = 'transcript-reader-container';
      this.container.querySelector('.transcript-content').appendChild(readerContainer);
      
      // Initialize TranscriptViewer with current transcript data
      if (typeof TranscriptViewer !== 'undefined') {
        // ✅ FIX: Use current transcript (real-time collected) if available, otherwise restructured
        const dataToUse = this.currentTranscript && this.currentTranscript.length > 0 ? 
          this.currentTranscript : 
          (this.restructuredSentences || []);
        
        console.log('📖 Initializing TranscriptViewer with', dataToUse.length, 'items');
        this.transcriptViewer = new TranscriptViewer(readerContainer, dataToUse, this.currentPlatform);
        console.log('✅ TranscriptViewer initialized successfully');
      } else {
        console.error('❌ TranscriptViewer not loaded - check if transcript-viewer.js is included');
        readerContainer.innerHTML = `
          <div style="color: red; padding: 20px; text-align: center;">
            <p>❌ Reader mode not available</p>
            <p style="font-size: 12px;">TranscriptViewer component not loaded</p>
          </div>
        `;
      }
    } else {
      // ✅ FIX: If reader container exists, update it with latest data
      if (this.transcriptViewer && typeof this.transcriptViewer.updateTranscriptData === 'function') {
        const dataToUse = this.currentTranscript && this.currentTranscript.length > 0 ? 
          this.currentTranscript : 
          (this.restructuredSentences || []);
        
        console.log('🔄 Updating existing transcript viewer with', dataToUse.length, 'items');
        this.transcriptViewer.updateTranscriptData(dataToUse);
      }
    }
    
    readerContainer.style.display = 'block';
  }

  // ✅ REMOVED: copyTranscript and exportTranscript - reader mode handles these features

  // ✅ REMOVED: toggleView - no longer needed with single reader mode

  showAIPolishButton(segments) {
    // Remove existing AI polish button if any
    const existingBtn = this.container.querySelector('.ai-polish-btn');
    if (existingBtn) existingBtn.remove();
    
    // Calculate estimated cost and word count
    const totalWords = segments.map(s => s.text.split(' ').length).reduce((a, b) => a + b, 0);
    const estimatedCost = this.calculateAICost(totalWords);
    
    // Create AI Polish button
    const statusEl = this.container.querySelector('.transcript-status');
    const aiPolishBtn = document.createElement('button');
    aiPolishBtn.className = 'ai-polish-btn';
    aiPolishBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      🤖 AI Polish (~$${estimatedCost}, ${totalWords} words)
    `;
    aiPolishBtn.title = `Use AI to improve grammar and remove any remaining repetitions. Estimated cost: $${estimatedCost}`;
    
    // Insert after status
    statusEl.parentNode.insertBefore(aiPolishBtn, statusEl.nextSibling);
    
    // Add click handler
    aiPolishBtn.addEventListener('click', () => this.performAIPolish(segments, aiPolishBtn));
  }

  calculateAICost(wordCount) {
    // Estimate tokens (roughly 0.75 tokens per word)
    const estimatedTokens = Math.ceil(wordCount * 0.75);
    
    // Use Gemini Flash pricing (cheapest option)
    const inputCost = (estimatedTokens / 1000000) * 0.075; // $0.075 per 1M tokens
    const outputCost = (estimatedTokens / 1000000) * 0.30;  // $0.30 per 1M tokens (assuming similar output size)
    
    const totalCost = inputCost + outputCost;
    return totalCost.toFixed(4);
  }

  async performAIPolish(segments, button) {
    const originalText = button.innerHTML;
    button.innerHTML = '🤖 AI Polishing...';
    button.disabled = true;
    
    try {
      console.log('🤖 Starting AI polish of', segments.length, 'segments');
      
      // Check if AI service is available
      let aiService = null;
      if (this.aiService && typeof this.aiService.generateAnalysis === 'function') {
        aiService = this.aiService;
      } else if (window.aiService && typeof window.aiService.generateAnalysis === 'function') {
        aiService = window.aiService;
      } else {
        throw new Error('AI service not available. Please configure OpenAI or Gemini API in settings.');
      }
      
      // ✅ FIX: Process each segment individually to preserve count
      const polishedSegments = [];
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        button.innerHTML = `🤖 AI Polishing... (${Math.floor((i/segments.length)*100)}%)`;
        
        // Only polish if the segment has repetitive patterns or poor grammar
        if (this.needsAIPolish(segment.text)) {
          try {
            const polishedText = await this.polishSingleSentence(segment.text, aiService);
            
            // ✅ Skip empty segments (meta-commentary was removed entirely)
            if (polishedText && polishedText.trim().length > 0) {
              polishedSegments.push({
                ...segment,
                text: polishedText.trim(),
                aiPolished: true
              });
            } else {
              console.log('🗑️ Segment removed entirely (was only meta-commentary)');
              // Don't add empty segments
            }
          } catch (error) {
            console.log('⚠️ Failed to polish segment, keeping original:', error.message);
            // Keep original if AI fails for this segment
            polishedSegments.push(segment);
          }
        } else {
          // Keep original if it doesn't need polishing
          polishedSegments.push(segment);
        }
        
        // Small delay to prevent API rate limiting (every 5 segments)
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log('✅ AI polish completed:', polishedSegments.length, 'segments (same count preserved)');
      
      // Update the transcript data
      this.currentTranscript = polishedSegments;
      
      // Update the reader view
      if (this.transcriptViewer && typeof this.transcriptViewer.updateTranscriptData === 'function') {
        this.transcriptViewer.updateTranscriptData(polishedSegments);
      }
      
      // Update status
      const statusEl = this.container.querySelector('.transcript-status');
      const removedCount = segments.length - polishedSegments.length;
      if (removedCount > 0) {
        statusEl.textContent = `✨ AI Polish completed! Enhanced ${polishedSegments.length} segments, removed ${removedCount} meta-commentary segments`;
      } else {
        statusEl.textContent = `✨ AI Polish completed! Enhanced ${polishedSegments.length} segments`;
      }
      statusEl.className = 'transcript-status success';
      
      // Remove the AI polish button (already done)
      button.remove();
      
    } catch (error) {
      console.error('❌ AI polish failed:', error);
      
      // Restore button
      button.innerHTML = originalText;
      button.disabled = false;
      
      // Show error
      const statusEl = this.container.querySelector('.transcript-status');
      statusEl.textContent = `❌ AI Polish failed: ${error.message}`;
      statusEl.className = 'transcript-status error';
    }
  }

  needsAIPolish(text) {
    // Check if text has issues that need AI polishing
    const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    
    const issues = [
      // Has repetitive words (3+ times)
      /\b(\w+)\s+\1\s+\1\b/i.test(text),
      
      // ✅ FIX: Detect sentence-level repetitions like your examples
      this.hasSentenceRepetition(normalizedText),
      
      // Has very poor grammar (multiple issues)
      text.split(' ').length > 15 && !/[.!?]$/.test(text.trim()),
      
      // Still has some repetitive patterns the rules missed
      /(.{10,})\s+\1/.test(text),
      
      // Has obvious transcript artifacts
      /\b(um|uh|like|you know)\s+(um|uh|like|you know)\b/i.test(text),
      
      // ✅ NEW: Detect phrase repetitions
      this.hasPhraseRepetition(normalizedText),
      
      // ✅ NEW: Detect word duplications within sentence
      this.hasWordDuplication(normalizedText)
    ];
    
    return issues.some(issue => issue);
  }

  hasSentenceRepetition(normalizedText) {
    // Check if the sentence is essentially repeated
    // Example: "this is how they all looked like at some point this is how they all looked like at some point"
    
    const words = normalizedText.split(' ');
    const length = words.length;
    
    // Check if first half matches second half (90%+ similarity)
    if (length >= 8) { // Only check for sentences with 8+ words
      const halfLength = Math.floor(length / 2);
      const firstHalf = words.slice(0, halfLength).join(' ');
      const secondHalf = words.slice(-halfLength).join(' ');
      
      // Calculate similarity
      const similarity = this.calculateTextSimilarity(firstHalf, secondHalf);
      if (similarity > 0.85) {
        console.log('🔍 Detected sentence repetition:', firstHalf, '≈', secondHalf);
        return true;
      }
    }
    
    return false;
  }

  hasPhraseRepetition(normalizedText) {
    // Check for repeated phrases of 4-8 words
    const words = normalizedText.split(' ');
    
    for (let phraseLength = 4; phraseLength <= 8; phraseLength++) {
      for (let i = 0; i <= words.length - phraseLength * 2; i++) {
        const phrase1 = words.slice(i, i + phraseLength).join(' ');
        const phrase2 = words.slice(i + phraseLength, i + phraseLength * 2).join(' ');
        
        if (this.calculateTextSimilarity(phrase1, phrase2) > 0.9) {
          console.log('🔍 Detected phrase repetition:', phrase1);
          return true;
        }
      }
    }
    
    return false;
  }

  hasWordDuplication(normalizedText) {
    // Check for immediate word duplications that rules might have missed
    const patterns = [
      /\b(\w{3,})\s+\1\b/g, // Same word repeated immediately
      /\b(\w+)\s+(\w+)\s+\1\s+\2\b/g, // Two-word pattern repeated
    ];
    
    return patterns.some(pattern => pattern.test(normalizedText));
  }

  calculateTextSimilarity(text1, text2) {
    if (text1 === text2) return 1;
    if (!text1 || !text2) return 0;
    
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1;
    
    // Simple similarity: count matching characters in order
    let matches = 0;
    const minLength = Math.min(text1.length, text2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (text1[i] === text2[i]) matches++;
    }
    
    return matches / longer.length;
  }

  async polishSingleSentence(text, aiService) {
    // ✅ Pre-clean obvious issues before sending to AI
    let preCleanedText = this.preCleanSentence(text);
    
    // If pre-cleaning removed everything (meta-commentary only), return empty
    if (!preCleanedText || preCleanedText.trim().length < 5) {
      console.log('🗑️ Pre-cleaning removed entire sentence (meta-commentary only)');
      return '';
    }
    
    // If pre-cleaning already fixed everything, don't waste AI call
    if (preCleanedText !== text && !this.needsAIPolish(preCleanedText)) {
      console.log('✅ Pre-cleaning fixed issues:', text.substring(0, 40), '→', preCleanedText.substring(0, 40));
      return preCleanedText;
    }
    
    const prompt = `Fix this transcript sentence. It may have spacing issues, repetitions, poor grammar, or YouTube meta-commentary.

EXAMPLES:
- "changea family" → "change a family"
- "and each home is going to change a family's life. and each home is going to change a family's life." → "And each home is going to change a family's life."
- "This is how they alllooked like at some point. This is how they all looked like at some point." → "This is how they all looked like at some point."
- "I'm gonna tell you what I think this meansthen you tell me what it means, okay?" → "I'm going to tell you what I think this means."
- "In this video, we're gonna be exploringdozens of ancient temples," → "We're exploring dozens of ancient temples."

RULES:
1. Fix spacing issues (like "changea" → "change a", "alllooked" → "all looked")
2. If sentence repeats itself completely, keep only ONE copy
3. Remove duplicate phrases within the sentence
4. Fix grammar, punctuation, and capitalization
5. Remove YouTube meta-commentary and instructions:
   - Remove "then you tell me what it means, okay?"
   - Remove "let me know what you think"
   - Remove "tell me in the comments"
   - Remove "make sure to like and subscribe"
   - Simplify "In this video, we're gonna be..." to just the main content
6. Keep the educational content, remove the video housekeeping
7. Return ONLY the fixed sentence, nothing else

Sentence to fix: "${preCleanedText}"`;

    try {
      const response = await aiService.generateAnalysis(prompt, 'en');
      let cleaned = response.content || response.text || response;
      
      // Clean up the AI response
      cleaned = this.cleanAIResponse(cleaned);
      
      // ✅ Additional validation for your specific patterns
      if (this.isValidCleanedSentence(preCleanedText, cleaned)) {
        console.log('✅ AI polished:', preCleanedText.substring(0, 40), '→', cleaned.substring(0, 40));
        return cleaned;
      } else {
        console.log('⚠️ AI response invalid, using pre-cleaned:', preCleanedText.substring(0, 40));
        return preCleanedText;
      }
      
    } catch (error) {
      console.error('AI polish error:', error);
      // Return pre-cleaned version if AI fails
      return preCleanedText;
    }
  }

  preCleanSentence(text) {
    let cleaned = text;
    
    // ✅ FIRST: Remove YouTube meta-commentary before other processing
    cleaned = this.removeYouTubeMetaCommentary(cleaned);
    
    // Fix common spacing issues in transcripts
    cleaned = cleaned
      .replace(/\b(\w+)([a-z])(\s+)([A-Z])/g, '$1$2 $4') // "changea family" → "change a family"
      .replace(/\b(\w+)([a-z]{2,})([A-Z]\w+)/g, '$1$2 $3') // "alllooked" → "all looked"
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Fix missing spaces between words
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    // Handle exact sentence repetitions
    const sentences = cleaned.split(/([.!?]+)/).filter(s => s.trim());
    if (sentences.length >= 4) { // At least 2 sentences
      const firstSentence = (sentences[0] + (sentences[1] || '')).trim();
      const secondSentence = (sentences[2] + (sentences[3] || '')).trim();
      
      if (this.areSentencesSimilar(firstSentence, secondSentence)) {
        cleaned = firstSentence;
        console.log('🧹 Pre-cleaned repetition:', text.substring(0, 40), '→', cleaned.substring(0, 40));
      }
    }
    
    return cleaned;
  }

  removeYouTubeMetaCommentary(text) {
    let cleaned = text;
    
    console.log('🎬 Removing YouTube meta-commentary from:', text.substring(0, 50) + '...');
    
    // Remove specific meta-commentary patterns
    cleaned = cleaned
      // Remove audience interaction phrases
      .replace(/\bthen you tell me what it means,?\s*(okay|alright)?\s*[.!?]?/gi, '')
      .replace(/\blet me know what (you think|it means|this means)\s*[.!?]?/gi, '')
      .replace(/\btell me in the comments\s*[.!?]?/gi, '')
      .replace(/\bmake sure to like and subscribe\s*[.!?]?/gi, '')
      .replace(/\blet me know in the comments\s*[.!?]?/gi, '')
      .replace(/\bwhat do you think\?\s*/gi, '')
      .replace(/\bsmash that like button\s*[.!?]?/gi, '')
      .replace(/\bdon't forget to subscribe\s*[.!?]?/gi, '')
      
      // Simplify video intro patterns
      .replace(/\bin this video,?\s*we're\s*(going to|gonna)\s*be\s*(exploring|looking at|talking about|discussing)\s*/gi, "We're exploring ")
      .replace(/\bin today's video,?\s*we're\s*(going to|gonna)\s*/gi, "We're ")
      .replace(/\btoday we're\s*(going to|gonna)\s*(be\s*)?(exploring|looking at|talking about|discussing)\s*/gi, "We're exploring ")
      .replace(/\bso today\s*we're\s*(going to|gonna)\s*/gi, "We're ")
      
      // Remove video housekeeping
      .replace(/\bbefore we get started\s*[,.]?\s*/gi, '')
      .replace(/\bif you're new here\s*[,.]?\s*/gi, '')
      .replace(/\bwelcome back to (my|the) channel\s*[,.]?\s*/gi, '')
      .replace(/\bthank you for watching\s*[.!?]?/gi, '')
      .replace(/\bi'll see you in the next (video|one)\s*[.!?]?/gi, '')
      
      // Clean up extra punctuation and spaces
      .replace(/\s*[,.]?\s*[,.]?\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove sentence if it becomes too short or meaningless after cleaning
    if (cleaned.length < 10 || /^(we're|today|so|now|here)\s*$/i.test(cleaned)) {
      console.log('🗑️ Sentence too short after meta-commentary removal, removing entirely');
      return '';
    }
    
    if (cleaned !== text) {
      console.log('✨ Removed meta-commentary:', text.substring(0, 40), '→', cleaned.substring(0, 40));
    }
    
    return cleaned;
  }

  areSentencesSimilar(sent1, sent2) {
    const norm1 = sent1.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const norm2 = sent2.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    
    // Check exact match or very high similarity
    if (norm1 === norm2) return true;
    
    const similarity = this.calculateTextSimilarity(norm1, norm2);
    return similarity > 0.9;
  }

  cleanAIResponse(response) {
    let cleaned = response;
    
    // Remove common AI response patterns
    cleaned = cleaned
      .replace(/^["'`]|["'`]$/g, '') // Remove quotes
      .replace(/^(cleaned|result|fixed|answer):\s*/i, '') // Remove prefixes
      .replace(/\n.*$/s, '') // Remove everything after first line
      .trim();
    
    // Ensure proper capitalization
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    return cleaned;
  }

  isValidCleanedSentence(original, cleaned) {
    // Validate that the AI response is reasonable
    if (!cleaned || cleaned.length < 5) return false;
    
    // Length should be 30%-150% of original (allowing for repetition removal)
    if (cleaned.length < original.length * 0.3 || cleaned.length > original.length * 1.5) {
      return false;
    }
    
    // Should still contain some key words from original
    const originalWords = original.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const cleanedWords = cleaned.toLowerCase().match(/\b\w{4,}\b/g) || [];
    
    if (originalWords.length > 0) {
      const commonWords = originalWords.filter(word => cleanedWords.includes(word));
      const overlap = commonWords.length / originalWords.length;
      
      // At least 50% of significant words should remain
      if (overlap < 0.5) return false;
    }
    
    return true;
  }

  async toggleCollection() {
    const collectBtn = this.container.querySelector('.start-collection-btn');
    const statusEl = this.container.querySelector('.transcript-status');
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      // Platform-specific validation
      if (this.currentPlatform === 'youtube' && !tab.url.includes('youtube.com/watch')) {
        statusEl.textContent = '❌ Please open a YouTube video first';
        statusEl.className = 'transcript-status error';
        return;
      } else if (this.currentPlatform === 'netflix' && !tab.url.includes('netflix.com/watch')) {
        statusEl.textContent = '❌ Please open a Netflix video first';
        statusEl.className = 'transcript-status error';
        return;
      } else if (this.currentPlatform === 'udemy' && !tab.url.includes('udemy.com/course')) {
        statusEl.textContent = '❌ Please open a Udemy course video first';
        statusEl.className = 'transcript-status error';
        return;
      } else if (this.currentPlatform === 'unknown') {
        statusEl.textContent = '❌ Please open a YouTube, Netflix, Udemy, or Coursera video first';
        statusEl.className = 'transcript-status error';
        return;
      }
      
      // Check if collection is already in progress with better error handling
      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch (connectionError) {
        if (connectionError.message.includes('Could not establish connection')) {
          const platformName = this.currentPlatform === 'netflix' ? 'Netflix' : 
                              this.currentPlatform === 'udemy' ? 'Udemy' : 'YouTube';
          statusEl.textContent = `❌ Please refresh the ${platformName} page and try again`;
          statusEl.className = 'transcript-status error';
          console.log('🔄 Content script not ready, user needs to refresh page');
          return;
        }
        throw connectionError; // Re-throw if it's a different error
      }
      
      if (response.isCollecting) {
        // Stop collection - platform-specific  
        const stopAction = this.currentPlatform === 'udemy' ? 'stopUdemySubtitleCollection' : 
                          this.currentPlatform === 'netflix' ? 'stopNetflixSubtitleCollection' : 'stopCaptionCollection';
        const platformDesc = this.currentPlatform === 'udemy' ? 'Udemy subtitle' : 
                            this.currentPlatform === 'netflix' ? 'Netflix subtitle' : 'real-time';
        statusEl.textContent = `Stopping ${platformDesc} collection...`;
        statusEl.className = 'transcript-status loading';
        
        let result;
        try {
          result = await chrome.tabs.sendMessage(tab.id, { action: stopAction });
        } catch (connectionError) {
          if (connectionError.message.includes('Could not establish connection')) {
            statusEl.textContent = '❌ Connection lost. Please refresh the page.';
            statusEl.className = 'transcript-status error';
            this.resetCollectionButton(collectBtn);
            return;
          }
          throw connectionError;
        }
        
        // Use the appropriate completion handler
        if (this.currentPlatform === 'udemy') {
          this.handleUdemyCollectionComplete(result, statusEl, collectBtn);
        } else if (this.currentPlatform === 'netflix') {
          this.handleNetflixCollectionComplete(result, statusEl, collectBtn);
        } else {
          this.handleCollectionComplete(result, statusEl, collectBtn);
        }
        
      } else {
        // Start collection - platform-specific
        if (this.currentPlatform === 'udemy') {
          await this.startUdemyCollection(collectBtn, statusEl, tab);
        } else if (this.currentPlatform === 'netflix') {
          await this.startNetflixCollection(collectBtn, statusEl, tab);
        } else {
          await this.startYouTubeCollection(collectBtn, statusEl, tab);
        }
      }
      
    } catch (error) {
      console.error('❌ Toggle collection error:', error);
      
      if (error.message.includes('Could not establish connection')) {
        const platformName = this.currentPlatform === 'netflix' ? 'Netflix' : 
                            this.currentPlatform === 'udemy' ? 'Udemy' : 'YouTube';
        statusEl.textContent = `❌ Page connection lost. Please refresh ${platformName} and try again.`;
      } else {
        statusEl.textContent = `❌ Error: ${error.message}`;
      }
      statusEl.className = 'transcript-status error';
      
      // Reset button state on any error
      this.resetCollectionButton(collectBtn);
      // Show button and clear timer on error
      collectBtn.style.display = 'block';
      if (this.currentAutoStopTimer) {
        clearTimeout(this.currentAutoStopTimer);
        this.currentAutoStopTimer = null;
      }
    }
  }
  
  // Helper method to reset collection button state
  resetCollectionButton(collectBtn) {
    if (collectBtn) {
      collectBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="10,8 16,12 10,16"/>
        </svg>
        Collect
      `;
    }
  }
  
  // ✅ NEW: Handle collection completion with popup and button hiding
  handleCollectionComplete(result, statusEl, collectBtn) {
    // Clear auto-stop timer if it exists
    if (this.currentAutoStopTimer) {
      clearTimeout(this.currentAutoStopTimer);
      this.currentAutoStopTimer = null;
    }
    
    if (result.success && result.segments.length > 0) {
      console.log('🧹 Starting deduplication of collected segments...');
      
      // Apply cleaning to collected segments
      const cleanedSegments = this.cleanCollectedSegments(result.segments);
      console.log(`✨ Cleaned segments: ${result.segments.length} → ${cleanedSegments.length}`);
      
      this.currentTranscript = cleanedSegments;
      statusEl.textContent = `✅ Collection complete! Captured ${cleanedSegments.length} segments`;
      statusEl.className = 'transcript-status success';
      
      // ✅ RESET BUTTON for potential reuse
      this.resetCollectionButton(collectBtn);
      collectBtn.style.display = 'block';
      
      // ✅ CREATE POPUP WINDOW to show transcript
      this.showTranscriptPopup(cleanedSegments);
      
      // Update transcript viewer
      if (this.transcriptViewer && typeof this.transcriptViewer.updateTranscriptData === 'function') {
        this.transcriptViewer.updateTranscriptData(cleanedSegments);
      } else {
        this.displayTranscriptInReader(cleanedSegments);
      }
      
      // Show AI Polish button
      this.showAIPolishButton(cleanedSegments);
      
      // Restructure for classic view
      this.restructureTranscript();
      this.displayTranscript();
      
    } else {
      statusEl.textContent = '❌ No captions collected. Try playing the video with captions enabled.';
      statusEl.className = 'transcript-status error';
      // Show button again on failure
      collectBtn.style.display = 'block';
      this.resetCollectionButton(collectBtn);
    }
  }
  
  // ✅ NEW: Show transcript in popup window
  showTranscriptPopup(segments) {
    const transcriptText = segments.map(segment => segment.text).join(' ');
    const platformIcon = this.currentPlatform === 'netflix' ? '🎭' : 
                         this.currentPlatform === 'udemy' ? '📚' : 
                         this.currentPlatform === 'coursera' ? '🎓' :
                         '📺'; // Default: YouTube
    const platformName = this.currentPlatform === 'netflix' ? 'Netflix' : 
                         this.currentPlatform === 'udemy' ? 'Udemy' : 
                         this.currentPlatform === 'coursera' ? 'Coursera' :
                         'YouTube';
    
    // Create popup content
    const popupContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #1976d2; margin-bottom: 15px;">${platformIcon} ${platformName} Transcript Collected</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; line-height: 1.6; max-height: 400px; overflow-y: auto;">
          ${transcriptText}
        </div>
        <div style="margin-top: 15px; text-align: center;">
          <button onclick="window.close()" style="background: #1976d2; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Close</button>
        </div>
      </div>
    `;
    
    // Open popup window
    const popup = window.open('', 'TranscriptPopup', 'width=700,height=500,scrollbars=yes,resizable=yes');
    if (popup) {
      popup.document.write(`
        <html>
        <head><title>${platformName} Transcript Collection</title></head>
        <body>${popupContent}</body>
        </html>
      `);
      popup.document.close();
      popup.focus();
    } else {
      // Fallback if popup blocked
      alert(`${platformName} transcript collected!\n\n${transcriptText.substring(0, 500)}${transcriptText.length > 500 ? '...' : ''}`);
    }
  }

  // ✅ Netflix-style manual caption capture for YouTube
  async startYouTubeCollection(collectBtn, statusEl, tab) {
    statusEl.textContent = 'Capturing current caption...';
    statusEl.className = 'transcript-status loading';
    
    console.log('🎬 YouTube manual caption capture (Netflix-style)...');
    
    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, { 
        action: 'captureCurrentSubtitle'
        // Netflix-style manual capture
      });
    } catch (connectionError) {
      if (connectionError.message.includes('Could not establish connection')) {
        statusEl.textContent = '❌ Cannot connect to YouTube page. Please refresh and try again.';
        statusEl.className = 'transcript-status error';
        return;
      }
      throw connectionError;
    }
    
    if (result.success) {
      // Add captured caption to the queue (like Netflix)
      if (result.text && result.text.trim()) {
        const transcriptTypeIcon = result.transcriptType === 'automatic' ? '🤖' : '👤';
        const transcriptTypeName = result.transcriptType === 'automatic' ? 'Auto' : 'Manual';
        
        // Apply user-configurable timing offset (0-3s range)
        const offsetAmount = this.timingOffset || 1.0; // Default to 1s if not set
        let adjustedTimestamp = result.timestamp;
        if (adjustedTimestamp > 0 && offsetAmount > 0) {
          adjustedTimestamp = Math.max(0, adjustedTimestamp - offsetAmount);
          console.log(`⏰ Applied user timing offset (-${offsetAmount}s): ${result.timestamp}s → ${adjustedTimestamp}s`);
        }
        
        this.addCapturedSentence({
          text: result.text,
          timestamp: adjustedTimestamp,
          originalTimestamp: result.timestamp, // Keep original for reference
          transcriptType: result.transcriptType,
          transcriptInfo: result.transcriptInfo,
          videoInfo: result.videoInfo
        });
        
        statusEl.textContent = `✅ Captured ${transcriptTypeIcon} ${transcriptTypeName}: "${result.text.substring(0, 40)}${result.text.length > 40 ? '...' : ''}"`;
        statusEl.className = 'transcript-status success';
        
        // Reset button for next capture
        setTimeout(() => {
          statusEl.textContent = 'Ready to capture next caption';
          statusEl.className = 'transcript-status ready';
        }, 2000);
      } else {
        statusEl.textContent = '⚠️ No caption text captured';
        statusEl.className = 'transcript-status warning';
      }
      
      // Keep button ready for next capture (Netflix-style)
      collectBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
        </svg>
        Collect from YouTube
      `;
      collectBtn.style.display = 'block'; // Ensure button stays visible
      
    } else {
      statusEl.textContent = `❌ ${result.error || 'No caption found. Make sure captions are enabled.'}`;
      statusEl.className = 'transcript-status error';
      collectBtn.style.display = 'block';
    }
  }

  // Add captured sentence to display (Netflix-style table format)
  addCapturedSentence(captureData) {
    console.log('🎬 Adding captured sentence:', captureData.text);
    
    // Store the timestamp and text for shortcut durability
    if (captureData.timestamp) {
      this.lastCapturedTimestamp = captureData.timestamp;
      console.log('📍 Stored latest timestamp for B shortcut:', this.lastCapturedTimestamp);
    }
    if (captureData.text) {
      this.lastCapturedText = captureData.text;
      console.log('🎯 Stored latest text for A shortcut:', this.lastCapturedText.substring(0, 50) + '...');
    }
    
    // Show header and table container when adding first item
    const header = this.container.querySelector('.captured-viewer-header');
    const tableContainer = this.container.querySelector('.captured-table-container');
    const emptyState = this.container.querySelector('.captured-empty-state');
    
    if (header && tableContainer && emptyState) {
      header.style.display = 'flex';
      tableContainer.style.display = 'block';
      emptyState.style.display = 'none';
    }
    
    // Find captured sentences table
    const transcriptTable = this.container.querySelector('.captured-sentences');
    if (transcriptTable) {
      const tbody = transcriptTable.querySelector('tbody');
      
      // Create row with Netflix-style format
      const row = document.createElement('tr');
      row.className = 'transcript-row';
      row.setAttribute('data-start', captureData.timestamp);
      row.setAttribute('data-timestamp', this.formatTimestamp(captureData.timestamp));
      
      // Timestamp column
      const timestampCell = document.createElement('td');
      timestampCell.className = 'timestamp-cell';
      
      const timestampBtn = document.createElement('button');
      timestampBtn.className = 'timestamp-btn youtube-enabled';
      timestampBtn.textContent = this.formatTimestamp(captureData.timestamp);
      
      // Set platform-appropriate title
      const platformName = captureData.videoInfo?.platform === 'udemy' ? 'Udemy' :
                          captureData.videoInfo?.platform === 'netflix' ? 'Netflix' :
                          captureData.videoInfo?.platform === 'coursera' ? 'Coursera' : 'YouTube';
      
      // Different titles based on platform capabilities
      if (captureData.videoInfo?.platform === 'udemy') {
        timestampBtn.title = `Switch to Udemy (timestamp: ${this.formatTimestamp(captureData.timestamp)})`;
      } else if (captureData.videoInfo?.platform === 'coursera' || captureData.videoInfo?.platform === 'netflix') {
        timestampBtn.title = `${platformName} timestamp: ${this.formatTimestamp(captureData.timestamp)} (navigation not available)`;
      } else {
        timestampBtn.title = `Jump to ${platformName} at ${this.formatTimestamp(captureData.timestamp)}`;
      }
      
      // Make timestamp clickable for YouTube and Udemy only
      console.log('🔍 Setting up timestamp click handler for:', {
        platform: captureData.videoInfo?.platform,
        platformName: platformName,
        captureData: captureData
      });
      
      if (captureData.videoInfo && captureData.videoInfo.platform === 'youtube') {
        timestampBtn.addEventListener('click', async () => {
          try {
            // Find YouTube tab and seek to timestamp
            const tabs = await chrome.tabs.query({});
            const youtubeTab = tabs.find(tab => 
              tab.url && tab.url.includes('youtube.com/watch') && 
              tab.url.includes(captureData.videoInfo.videoId)
            );
            
            if (youtubeTab) {
              // Switch to YouTube tab
              await chrome.tabs.update(youtubeTab.id, { active: true });
              
              // Send seek command to YouTube content script
              await chrome.tabs.sendMessage(youtubeTab.id, {
                action: 'seekToTime',
                timestamp: captureData.timestamp
              });
            } else {
              // Fallback: open new tab with timestamp
              const url = `https://www.youtube.com/watch?v=${captureData.videoInfo.videoId}&t=${captureData.timestamp}s`;
              chrome.tabs.create({ url: url });
            }
          } catch (error) {
            console.error('Failed to seek to timestamp:', error);
            // Fallback: open new tab
            const url = `https://www.youtube.com/watch?v=${captureData.videoInfo.videoId}&t=${captureData.timestamp}s`;
            chrome.tabs.create({ url: url });
          }
        });
      } else if (captureData.videoInfo && captureData.videoInfo.platform === 'udemy') {
        console.log('✅ Setting up Udemy timestamp click handler (simplified mode)');
        timestampBtn.addEventListener('click', async () => {
          console.log('🔍 Udemy timestamp clicked - switching to Udemy tab');
          try {
            // Find any Udemy tab and switch to it (don't try to seek to specific timestamp)
            const tabs = await chrome.tabs.query({});
            const udemyTab = tabs.find(tab => tab.url && tab.url.includes('udemy.com'));
            
            if (udemyTab) {
              console.log('📚 Switching to Udemy tab:', udemyTab.id);
              await chrome.tabs.update(udemyTab.id, { active: true });
              // Show visual feedback that we switched tabs
              timestampBtn.style.background = '#7c4dff';
              timestampBtn.style.color = 'white';
              setTimeout(() => {
                timestampBtn.style.background = '';
                timestampBtn.style.color = '';
              }, 1000);
            } else {
              console.log('❌ No Udemy tab found to switch to');
              // Show error feedback
              timestampBtn.style.background = '#ff5722';
              timestampBtn.style.color = 'white';
              setTimeout(() => {
                timestampBtn.style.background = '';
                timestampBtn.style.color = '';
              }, 1000);
            }
          } catch (error) {
            console.error('Failed to switch to Udemy tab:', error);
          }
        });
      } else if (captureData.videoInfo && (captureData.videoInfo.platform === 'coursera' || captureData.videoInfo.platform === 'netflix')) {
        // For Coursera and Netflix, just show timestamp without navigation
        timestampBtn.style.cursor = 'default';
        timestampBtn.style.textDecoration = 'none';
        timestampBtn.title = `${platformName} timestamp: ${this.formatTimestamp(captureData.timestamp)} (navigation not available)`;
      } else {
        console.log('⚠️ No platform-specific handler found, adding generic click handler');
        timestampBtn.addEventListener('click', () => {
          console.log('❌ Generic timestamp click - platform not detected properly:', {
            platform: captureData.videoInfo?.platform,
            hasVideoInfo: !!captureData.videoInfo,
            captureData: captureData
          });
          alert('❌ No platform detected. Please capture a new subtitle.');
        });
      }
      
      timestampCell.appendChild(timestampBtn);
      
      // Text column
      const textCell = document.createElement('td');
      textCell.className = 'text-cell';
      const textSpan = document.createElement('span');
      textSpan.className = 'clean-text';
      textSpan.textContent = captureData.text;
      textCell.appendChild(textSpan);
      
      // Actions column
      const actionsCell = document.createElement('td');
      actionsCell.className = 'actions-cell';
      
      // Analyze button (exactly like Netflix)
      const analyzeBtn = document.createElement('button');
      analyzeBtn.className = 'capture-sentence-btn';
      analyzeBtn.innerHTML = '✨';
      analyzeBtn.title = 'Analyze with AI';
      analyzeBtn.addEventListener('click', () => {
        this.analyzeCapture(captureData, analyzeBtn);
      });
      
      // Edit button for manual text correction
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-text-btn';
      editBtn.innerHTML = '✏️';
      editBtn.title = 'Edit captured text';
      editBtn.addEventListener('click', () => {
        this.editCapturedText(textSpan, captureData, editBtn);
      });
      
      // Delete row button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-row-btn';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = 'Delete this captured sentence';
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this sentence?')) {
          row.remove();
          this.toggleClearAllButton(); // Update clear all button visibility
        }
      });
      
      actionsCell.appendChild(analyzeBtn);
      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(deleteBtn);
      
      // Add cells to row
      row.appendChild(timestampCell);
      row.appendChild(textCell);
      row.appendChild(actionsCell);
      
      // Add row to table
      tbody.appendChild(row);
      
      // Show Clear All button now that we have content
      this.toggleClearAllButton();
      
      // Update captured sentences count
      this.updateCapturedSentencesCount();
      
      // Scroll to show new sentence
      row.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      console.log('⚠️ No transcript table found');
    }
  }
  
  // Update captured sentences count in the header
  updateCapturedSentencesCount() {
    const countElement = this.container.querySelector('.captured-count');
    if (countElement) {
      const rows = this.container.querySelectorAll('.transcript-row');
      const count = rows.length;
      countElement.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    }
  }
  
  // Export captured sentences to clipboard and file
  exportCapturedSentences() {
    const rows = this.container.querySelectorAll('.transcript-row');
    if (rows.length === 0) {
      alert('No captured sentences to export');
      return;
    }
    
    const platformName = this.currentPlatform === 'netflix' ? 'Netflix' :
                         this.currentPlatform === 'udemy' ? 'Udemy' :
                         this.currentPlatform === 'coursera' ? 'Coursera' : 'YouTube';
    
    let exportText = `# ${platformName} Captured Subtitles\\n\\n`;
    exportText += `**Date**: ${new Date().toLocaleDateString()}\\n`;
    exportText += `**Items**: ${rows.length} captured subtitles\\n\\n`;
    
    rows.forEach((row, index) => {
      const timestamp = row.querySelector('.timestamp-btn')?.textContent || '';
      const text = row.querySelector('.clean-text')?.textContent || '';
      
      exportText += `## ${index + 1}. [${timestamp}]\\n\\n`;
      exportText += `${text}\\n\\n`;
      exportText += `---\\n\\n`;
    });
    
    // Copy to clipboard and download
    navigator.clipboard.writeText(exportText).then(() => {
      this.showToast(`✅ ${rows.length} subtitles copied to clipboard!`);
      this.downloadFile(exportText, `${platformName.toLowerCase()}-subtitles-${new Date().toISOString().split('T')[0]}.md`);
    }).catch(() => {
      this.downloadFile(exportText, `${platformName.toLowerCase()}-subtitles-${new Date().toISOString().split('T')[0]}.md`);
      this.showToast(`✅ ${rows.length} subtitles downloaded!`);
    });
  }
  
  // Download file helper
  downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // Show toast notification
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'export-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      transform: translateY(100px);
      transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      toast.style.transform = 'translateY(100px)';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  // Create Netflix-style transcript table
  createTranscriptTable() {
    const transcriptArea = document.querySelector('.transcript-content') || 
                          document.querySelector('#transcript-content') ||
                          document.querySelector('.restructured-transcript');
    
    if (transcriptArea) {
      transcriptArea.innerHTML = `
        <div class="transcript-table-container">
          <table class="transcript-table">
            <thead>
              <tr>
                <th class="timestamp-column">Timestamp</th>
                <th class="text-column">Transcript</th>
                <th class="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <style>
          .transcript-table-container {
            width: 100%;
            overflow-x: auto;
          }
          .transcript-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          .transcript-table th,
          .transcript-table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
          }
          .transcript-table th {
            background: #f5f5f5;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            color: #666;
          }
          .timestamp-column {
            width: 80px;
          }
          .text-column {
            width: auto;
          }
          .actions-column {
            width: 100px;
          }
          .timestamp-btn.youtube-enabled {
            background: #e3f2fd;
            border: 1px solid #2196f3;
            color: #1976d2;
            cursor: pointer;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            font-family: monospace;
          }
          .timestamp-btn.youtube-enabled:hover {
            background: #bbdefb;
          }
          .clean-text {
            font-size: 14px;
            line-height: 1.4;
          }
          .actions-cell {
            display: flex;
            gap: 4px;
          }
          .capture-sentence-btn {
            background: #FF9800;
            border: none;
            padding: 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .capture-sentence-btn:hover {
            background: #F57C00;
          }
          .delete-row-btn {
            background: #dc3545;
            border: none;
            padding: 6px;
            border-radius: 4px;
            cursor: pointer;
            color: white;
            font-size: 14px;
          }
          .delete-row-btn:hover {
            background: #c82333;
          }
          .edit-text-btn {
            background: #17a2b8;
            border: none;
            padding: 6px;
            border-radius: 4px;
            cursor: pointer;
            color: white;
            font-size: 14px;
          }
          .edit-text-btn:hover {
            background: #138496;
          }
          
          /* Timing offset slider styles */
          .timing-offset-slider {
            -webkit-appearance: none;
            appearance: none;
            height: 5px;
            background: #ddd;
            outline: none;
            border-radius: 5px;
          }
          
          .timing-offset-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 15px;
            height: 15px;
            background: #4CAF50;
            cursor: pointer;
            border-radius: 50%;
          }
          
          .timing-offset-slider::-moz-range-thumb {
            width: 15px;
            height: 15px;
            background: #4CAF50;
            cursor: pointer;
            border-radius: 50%;
            border: none;
          }
        </style>
      `;
    }
  }

  // Analyze capture (exactly like Netflix)
  async analyzeCapture(captureData, button) {
    console.log('🎯 Starting analyzeCapture with data:', captureData);
    const originalHTML = button.innerHTML;
    button.innerHTML = '⚡';
    button.disabled = true;
    
    try {
      // First get the current platform tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      console.log('🎯 Current tab:', tab?.url);
      
      const isYouTube = tab && tab.url.includes('youtube.com');
      const isUdemy = tab && tab.url.includes('udemy.com');
      const isNetflix = tab && tab.url.includes('netflix.com');
      
      if (!tab || (!isYouTube && !isUdemy && !isNetflix)) {
        throw new Error('No supported platform tab found - please open YouTube, Udemy, or Netflix first');
      }
      
      // Send to YouTube content script, which will forward to background
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'analyzeTextInSidepanel',
        text: captureData.text
      });
      
      if (response && response.success) {
        button.innerHTML = '✅';
        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.disabled = false;
        }, 2000);
      } else {
        throw new Error(response?.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      button.innerHTML = '❌';
      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.disabled = false;
      }, 2000);
    }
  }

  // Format timestamp for display
  formatTimestamp(seconds) {
    // Handle invalid input
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      console.log('⚠️ Invalid timestamp value:', seconds, 'using 0 as fallback');
      seconds = 0;
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Clear all captured sentences
  clearAllCapturedSentences() {
    if (confirm('Are you sure you want to clear all captured sentences?')) {
      const transcriptTable = document.querySelector('.captured-sentences');
      if (transcriptTable) {
        const tbody = transcriptTable.querySelector('tbody');
        if (tbody) {
          tbody.innerHTML = '';
          this.toggleClearAllButton(); // Hide clear all button when table is empty
        }
      }
      
      // Hide header and table, show empty state
      const header = this.container.querySelector('.captured-viewer-header');
      const tableContainer = this.container.querySelector('.captured-table-container');
      const emptyState = this.container.querySelector('.captured-empty-state');
      
      if (header && tableContainer && emptyState) {
        header.style.display = 'none';
        tableContainer.style.display = 'none';
        emptyState.style.display = 'block';
      }
      
      // Clear platform-specific segments arrays
      if (this.netflixSegments) {
        this.netflixSegments = [];
        console.log('🧹 Netflix segments cleared');
      }
      
      if (this.udemySegments) {
        this.udemySegments = [];
        console.log('🧹 Udemy segments cleared');
      }
      
      // Clear transcript viewer if it exists
      if (this.transcriptViewer) {
        this.transcriptViewer.clearTranscript?.();
      }
      
      // Reset status based on platform
      const statusEl = this.container.querySelector('.transcript-status');
      if (statusEl) {
        if (this.currentPlatform === 'netflix') {
          statusEl.textContent = '📹 Netflix Content • Click "Capture" to capture subtitles';
        } else if (this.currentPlatform === 'udemy') {
          statusEl.textContent = '📚 Udemy Course • Click "Capture" to capture subtitles';
        } else {
          statusEl.textContent = '🎬 Ready to collect content';
        }
        statusEl.className = 'transcript-status';
      }
    }
  }

  // Show/hide Clear All button based on whether table has content
  toggleClearAllButton() {
    const clearAllBtn = this.container.querySelector('.clear-all-btn');
    const transcriptTable = document.querySelector('.captured-sentences');
    
    if (clearAllBtn && transcriptTable) {
      const tbody = transcriptTable.querySelector('tbody');
      const hasRows = tbody && tbody.children.length > 0;
      clearAllBtn.style.display = hasRows ? 'flex' : 'none';
    }
  }

  // Edit captured text inline
  editCapturedText(textSpan, captureData, editBtn) {
    const originalText = textSpan.textContent;
    const originalHTML = editBtn.innerHTML;
  
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.style.width = '100%';
    input.style.padding = '4px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '3px';
    input.style.fontSize = '14px';
    
    // Replace text with input
    textSpan.innerHTML = '';
    textSpan.appendChild(input);
    input.focus();
    input.select();
    
    // Change edit button to save button
    editBtn.innerHTML = '💾';
    editBtn.title = 'Save changes';
    
    // Save function
    const saveChanges = () => {
      const newText = input.value.trim();
      if (newText && newText !== originalText) {
        // Update the text
        textSpan.textContent = newText;
        captureData.text = newText; // Update the data object
        console.log('📝 Text updated:', newText);
      } else {
        // Restore original text
        textSpan.textContent = originalText;
      }
      
      // Restore edit button
      editBtn.innerHTML = originalHTML;
      editBtn.title = 'Edit captured text';
    };
    
    // Cancel function
    const cancelEdit = () => {
      textSpan.textContent = originalText;
      editBtn.innerHTML = originalHTML;
      editBtn.title = 'Edit captured text';
    };
    
    // Handle save on Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveChanges();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });
    
    // Handle save on blur (when input loses focus)
    input.addEventListener('blur', saveChanges);
    
    // Update edit button click handler to save
    const newClickHandler = (e) => {
      e.preventDefault();
      saveChanges();
      // Remove this temporary handler and restore original
      editBtn.removeEventListener('click', newClickHandler);
      editBtn.addEventListener('click', () => {
        this.editCapturedText(textSpan, captureData, editBtn);
      });
    };
    
    // Temporarily replace click handler
    editBtn.removeEventListener('click', () => {
      this.editCapturedText(textSpan, captureData, editBtn);
    });
    editBtn.addEventListener('click', newClickHandler);
  }

  // Setup keyboard shortcuts
  setupKeyboardShortcuts() {
    console.log('🔧 Setting up keyboard shortcuts...');
    
    // Make sure the container can receive focus for keyboard events
    if (this.container && !this.container.getAttribute('tabindex')) {
      this.container.setAttribute('tabindex', '-1');
    }
    
    // Add debugging visual feedback
    this.container.style.outline = '2px solid blue';
    setTimeout(() => {
      this.container.style.outline = '';
    }, 3000);
    
    // Add keyboard event listener for single-key shortcuts
    document.addEventListener('keydown', async (e) => {
      console.log('🔍 Keydown event detected:', e.key, 'Target:', e.target.tagName, 'Ctrl:', e.ctrlKey, 'Alt:', e.altKey);
      
      // Special debug for A and C keys
      if (e.key.toLowerCase() === 'a') {
        console.log('🎯 A KEY DETECTED! Target:', e.target.tagName, 'Class:', e.target.className);
      }
      // Skip if user is typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
        console.log('🔍 Skipping keyboard shortcut - user is typing in input field');
        return;
      }
      
      // Get current active tab to check platform FIRST
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      const isYouTube = currentTab?.url?.includes('youtube.com');
      const isUdemy = currentTab?.url?.includes('udemy.com');
      const isNetflix = currentTab?.url?.includes('netflix.com');
      const isSupportedPlatform = isYouTube || isUdemy || isNetflix;
      
      // No more problematic debug logging
      
      // Single key shortcuts (no modifiers)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        console.log('⌨️ Keyboard shortcut detected:', e.key, 'isYouTube:', isYouTube);
        switch(e.key.toLowerCase()) {
          case 'h': // Universal Capture/Collect - Works on all platforms
            e.preventDefault();
            console.log('⌨️ H key pressed - attempting capture for platform:', this.currentPlatform);
            this.showShortcutFeedback(`${this.currentPlatform === 'netflix' ? '🎭' : this.currentPlatform === 'udemy' ? '📚' : '📺'} Capturing...`);
            try {
              if (this.currentPlatform === 'youtube') {
                // YouTube: Trigger the same collection system that the "Collect" button uses
                this.toggleCollection();
              } else {
                this.captureCurrentSubtitle(); // Now works for Netflix, Udemy, and others
              }
            } catch (error) {
              console.error('❌ Capture error:', error);
              this.showShortcutFeedback('❌ Capture failed', 'error');
            }
            break;
            
          case 'n': // Netflix-specific capture shortcut
            if (this.currentPlatform === 'netflix') {
              e.preventDefault();
              console.log('⌨️ N shortcut triggered for Netflix');
              this.showShortcutFeedback('🎭 Netflix Capture!');
              try {
                this.captureCurrentSubtitle();
              } catch (error) {
                console.error('❌ Netflix capture error:', error);
                this.showShortcutFeedback('❌ Netflix capture failed', 'error');
              }
            }
            break;
            
          case 'u': // Udemy-specific capture shortcut
            if (this.currentPlatform === 'udemy') {
              e.preventDefault();
              console.log('⌨️ U shortcut triggered for Udemy');
              this.showShortcutFeedback('📚 Udemy Capture!');
              try {
                this.captureCurrentSubtitle();
              } catch (error) {
                console.error('❌ Udemy capture error:', error);
                this.showShortcutFeedback('❌ Udemy capture failed', 'error');
              }
            }
            break;
            
          case 'e': // Edit last captured item
            e.preventDefault();
            const editBtns = this.container.querySelectorAll('.edit-text-btn');
            if (editBtns.length > 0) {
              const lastEditBtn = editBtns[editBtns.length - 1];
              console.log('⌨️ Shortcut: E = Edit last item');
              lastEditBtn.click();
            }
            break;
            
          case 'd': // Delete last captured item
            e.preventDefault();
            const deleteBtns = this.container.querySelectorAll('.delete-row-btn');
            if (deleteBtns.length > 0) {
              const lastDeleteBtn = deleteBtns[deleteBtns.length - 1];
              console.log('⌨️ Shortcut: D = Delete last item');
              lastDeleteBtn.click();
            }
            break;
            
          case 'a': // Analyze last captured item and switch to AI tab
            e.preventDefault();
            console.log('⌨️ Shortcut: A = Analyze & switch to AI Analysis tab');
            console.log('🎯 Stored text available:', !!this.lastCapturedText);
            console.log('🎯 Stored timestamp available:', !!this.lastCapturedTimestamp);
            if (this.lastCapturedText) {
              console.log('🎯 Stored text preview:', this.lastCapturedText.substring(0, 50) + '...');
            }
            this.showShortcutFeedback('🎯 Analyzing last sentence...');
            await this.analyzeLastAndSwitchTab();
            break;
            
          case 'x': // Clear all (with confirmation)
            e.preventDefault();
            const clearAllBtn = this.container.querySelector('.clear-all-btn');
            if (clearAllBtn && clearAllBtn.style.display !== 'none') {
              console.log('⌨️ Shortcut: X = Clear all');
              clearAllBtn.click();
            }
            break;
            
          case 'b': // Back to latest timestamp
            if (isSupportedPlatform) {
              e.preventDefault();
              const platformName = isYouTube ? 'YouTube' : isUdemy ? 'Udemy' : 'Netflix';
              console.log(`⌨️ Shortcut: B = Back to latest timestamp on ${platformName}`);
              this.showShortcutFeedback('📍 Jumping to latest timestamp...');
              try {
                await this.jumpToLatestTimestamp();
              } catch (error) {
                console.error('⌨️ B shortcut error:', error);
                this.showShortcutFeedback('❌ No timestamp found', 'error');
              }
            } else {
              console.log('⌨️ B shortcut - not on supported platform');
            }
            break;
            
          case 'h': // Show help
            e.preventDefault();
            this.showKeyboardShortcutHelp();
            break;
        }
      }
      
      // Alt + C for collect (backup shortcut) - DISABLED DUE TO BROWSER FREEZE
      if (e.altKey && e.key.toLowerCase() === 'c') {
        console.log('⚠️ Alt+C shortcut temporarily disabled to prevent browser freezing');
        e.preventDefault();
        return;
      }
    });
    
    // Add visual keyboard shortcut hints
    this.addKeyboardHints();
    
    // Update course info for Udemy
    if (this.currentPlatform === 'udemy') {
      setTimeout(() => this.updateCourseInfo(), 1000); // Delay to ensure content script is ready
    }
    
    // Add debug test buttons
    // this.addDebugButtons();
    
    console.log(`⌨️ Keyboard shortcuts initialized for ${this.currentPlatform}: H=Universal Capture${this.currentPlatform === 'netflix' ? ', N=Netflix Capture' : ''}${this.currentPlatform === 'udemy' ? ', U=Udemy Capture' : ''}, E=Edit, D=Delete, A=Analyze, B=Jump, X=Clear`);
  }
  
  // Update course information display for Udemy
  async updateCourseInfo() {
    if (this.currentPlatform !== 'udemy') return;
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      if (!tab || !tab.url.includes('udemy.com')) return;
      
      // Get course info from Udemy content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getUdemyVideoInfo' });
      
      if (response.success && response.data) {
        const courseInfo = response.data;
        const courseInfoEl = document.getElementById('udemy-course-info');
        
        if (courseInfoEl) {
          courseInfoEl.querySelector('.course-title').textContent = 
            `📚 Course: ${courseInfo.courseTitle || 'Unknown Course'}`;
          courseInfoEl.querySelector('.lecture-title').textContent = 
            `📝 Lecture: ${courseInfo.lectureTitle || 'Unknown Lecture'}`;
          courseInfoEl.querySelector('#udemy-url').textContent = 
            courseInfo.url ? courseInfo.url.split('?')[0] : tab.url.split('?')[0];
          
          console.log('📚 Updated Udemy course info:', courseInfo);
        }
      }
    } catch (error) {
      console.error('❌ Failed to update course info:', error);
    }
  }
  
  // Add visual hints for keyboard shortcuts
  addKeyboardHints() {
    // Add hints to buttons
    const collectBtn = this.container.querySelector('.start-collection-btn');
    if (collectBtn) {
      collectBtn.title += ' (C)';
    }
    
    const clearAllBtn = this.container.querySelector('.clear-all-btn');
    if (clearAllBtn) {
      clearAllBtn.title += ' (X)';
    }
  }
  
  // Show visual feedback for keyboard shortcuts
  showShortcutFeedback(message, type = 'info') {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 50px;
      right: 50px;
      background: ${type === 'error' ? '#ff4444' : '#4CAF50'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    `;
    feedback.textContent = message;
    
    document.body.appendChild(feedback);
    
    // Animate in
    setTimeout(() => {
      feedback.style.transform = 'translateX(-10px)';
    }, 10);
    
    // Remove after 2 seconds
    setTimeout(() => {
      feedback.style.opacity = '0';
      feedback.style.transform = 'translateX(100px)';
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }
  
  // Add debug test buttons
  addDebugButtons() {
    const debugContainer = document.createElement('div');
    debugContainer.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #f0f0f0;
      padding: 10px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 9999;
      font-size: 12px;
    `;
    
    debugContainer.innerHTML = `
      <div>DEBUG PANEL</div>
      <button id="testAButton" style="margin: 2px; padding: 5px;">Test A (Analyze)</button>
      <button id="testBButton" style="margin: 2px; padding: 5px;">Test B (Back)</button>
      <button id="testAnalyzeBtn" style="margin: 2px; padding: 5px;">Test Analyze Button</button>
      <button id="showStoredData" style="margin: 2px; padding: 5px;">Show Stored Data</button>
      <button id="showTableContents" style="margin: 2px; padding: 5px;">Show Table</button>
    `;
    
    document.body.appendChild(debugContainer);
    
    // Add event listeners
    document.getElementById('testAButton').addEventListener('click', async () => {
      console.log('🧪 Testing A functionality...');
      console.log('🧪 Stored text available:', !!this.lastCapturedText);
      console.log('🧪 Stored timestamp available:', !!this.lastCapturedTimestamp);
      if (this.lastCapturedText) {
        console.log('🧪 Stored text preview:', this.lastCapturedText.substring(0, 50) + '...');
      }
      await this.analyzeLastAndSwitchTab();
    });
    
    document.getElementById('testBButton').addEventListener('click', async () => {
      console.log('🧪 Testing B functionality...');
      await this.jumpToLatestTimestamp();
    });
    
    document.getElementById('testAnalyzeBtn').addEventListener('click', () => {
      console.log('🧪 Testing analyze button click...');
      const analyzeBtns = this.container.querySelectorAll('.capture-sentence-btn');
      console.log('🧪 Found analyze buttons:', analyzeBtns.length);
      if (analyzeBtns.length > 0) {
        const lastAnalyzeBtn = analyzeBtns[analyzeBtns.length - 1];
        console.log('🧪 Clicking last analyze button');
        lastAnalyzeBtn.click();
      }
    });
    
    document.getElementById('showStoredData').addEventListener('click', () => {
      console.log('🧪 === STORED DATA DEBUG ===');
      console.log('🧪 lastCapturedText:', this.lastCapturedText);
      console.log('🧪 lastCapturedTimestamp:', this.lastCapturedTimestamp);
      console.log('🧪 Container has tables:', this.container.querySelectorAll('table').length);
      console.log('🧪 Container classes:', this.container.className);
      console.log('🧪 === END STORED DATA ===');
    });
    
    document.getElementById('showTableContents').addEventListener('click', () => {
      console.log('🧪 === TABLE CONTENTS DEBUG ===');
      const tables = this.container.querySelectorAll('table');
      console.log('🧪 Found tables:', tables.length);
      
      tables.forEach((table, i) => {
        console.log(`🧪 Table ${i}:`, table.className);
        const tbody = table.querySelector('tbody');
        if (tbody) {
          const rows = tbody.querySelectorAll('tr');
          console.log(`🧪 Table ${i} has ${rows.length} rows:`);
          rows.forEach((row, j) => {
            const textCell = row.querySelector('td:nth-child(2)');
            const text = textCell ? textCell.textContent.trim() : 'NO TEXT';
            console.log(`🧪   Row ${j}: ${text.substring(0, 60)}...`);
          });
        } else {
          console.log(`🧪 Table ${i} has no tbody`);
        }
      });
      console.log('🧪 === END TABLE CONTENTS ===');
    });
  }
  
  // Show keyboard shortcut help dialog
  showKeyboardShortcutHelp() {
    const helpDialog = document.createElement('div');
    helpDialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
    `;
    
    helpDialog.innerHTML = `
      <h3 style="margin: 0 0 15px 0;">⌨️ Keyboard Shortcuts</h3>
      <div style="font-size: 14px; line-height: 1.8;">
        <div><kbd style="background: #eee; padding: 2px 6px; border-radius: 3px;">H</kbd> - Capture current subtitle</div>
        <div><kbd style="background: #eee; padding: 2px 6px; border-radius: 3px;">E</kbd> - Edit last captured item</div>
        <div><kbd style="background: #eee; padding: 2px 6px; border-radius: 3px;">D</kbd> - Delete last captured item</div>
        <div><kbd style="background: #eee; padding: 2px 6px; border-radius: 3px;">A</kbd> - Analyze last captured item</div>
        <div><kbd style="background: #eee; padding: 2px 6px; border-radius: 3px;">B</kbd> - Back to latest timestamp</div>
        <div><kbd style="background: #eee; padding: 2px 6px; border-radius: 3px;">X</kbd> - Clear all items</div>
        <div><kbd style="background: #eee; padding: 2px 6px; border-radius: 3px;">H</kbd> - Show this help</div>
        <div style="margin-top: 10px; color: #666;">
          <div><kbd style="background: #eee; padding: 2px 6px; border-radius: 3px;">Alt+C</kbd> - Alternative capture</div>
        </div>
      </div>
      <button onclick="this.parentElement.remove()" style="margin-top: 15px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
    `;
    
    document.body.appendChild(helpDialog);
    
    // Auto-remove after 10 seconds
    setTimeout(() => helpDialog.remove(), 10000);
  }

  // Analyze last captured sentence and switch to AI Analysis tab
  async analyzeLastAndSwitchTab() {
    try {
      console.log('🎯 Starting A shortcut - analyze and switch to AI tab');
      
      // Get the last captured sentence directly - try multiple selectors
      let tbody = this.container.querySelector('.captured-sentences tbody');
      console.log('🎯 Looking for .captured-sentences tbody:', !!tbody);
      
      if (!tbody) {
        // Try alternative selectors
        tbody = this.container.querySelector('table tbody');
        console.log('🎯 Looking for table tbody:', !!tbody);
      }
      
      if (!tbody) {
        tbody = this.container.querySelector('.transcript-table tbody');
        console.log('🎯 Looking for .transcript-table tbody:', !!tbody);
      }
      
      console.log('🎯 Container classes:', this.container.className);
      console.log('🎯 Available tables:', this.container.querySelectorAll('table').length);
      
      // Debug: Show actual table structure
      const allTables = this.container.querySelectorAll('table');
      allTables.forEach((table, i) => {
        console.log(`🎯 Table ${i} classes:`, table.className);
        console.log(`🎯 Table ${i} HTML:`, table.outerHTML.substring(0, 200) + '...');
      });
      
      if (!tbody) {
        console.log('⚠️ No tbody found with any selector');
        // Still no table? Use the stored text if available
        if (this.lastCapturedText) {
          console.log('🚠⚠️ FALLBACK: Using stored text for analysis (may be from previous video)');
          console.log('🎯 Stored text:', this.lastCapturedText.substring(0, 50) + '...');
          console.log('🎯 Current video URL:', this.currentVideoUrl);
          
          // Send directly to analysis using stored text
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const tab = tabs[0];
          
          const isYouTube = tab && tab.url.includes('youtube.com');
          const isUdemy = tab && tab.url.includes('udemy.com');
          const isNetflix = tab && tab.url.includes('netflix.com');
          
          if (!tab || (!isYouTube && !isUdemy && !isNetflix)) {
            console.error('❌ No supported platform tab found');
            this.showShortcutFeedback('❌ Open YouTube, Udemy, or Netflix first', 'error');
            return;
          }
          
          // Send to appropriate content script for analysis
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'analyzeTextInSidepanel',
            text: this.lastCapturedText
          });
          
          console.log('🎯 Analysis response:', response);
          
          // Wait for analysis to complete, then force reload and switch to Analysis tab
          setTimeout(async () => {
            console.log('🎯 Switching to Analysis tab and reloading data...');
            
            // Force reload analysis data from storage before switching tabs
            try {
              const result = await chrome.storage.local.get('youtubeAnalysis');
              if (result.youtubeAnalysis) {
                const data = result.youtubeAnalysis;
                console.log('🔄 Found new analysis data, reloading:', data.text);
                
                // Force reload the analysis by calling loadYouGlish directly
                if (typeof loadYouGlish === 'function') {
                  loadYouGlish(data.url, data.text, data.language);
                }
                
                // Clear the data after processing to prevent reuse
                chrome.storage.local.remove('youtubeAnalysis');
              }
            } catch (error) {
              console.error('❌ Error reloading analysis data:', error);
            }
            
            // Now switch to Analysis tab
            const analysisBtn = document.getElementById('showAnalysisBtn');
            if (analysisBtn) {
              analysisBtn.click();
              console.log('✅ Successfully analyzed stored text, reloaded data, and switched to Analysis tab');
              this.showShortcutFeedback('✅ Analyzed stored text');
            } else {
              console.error('❌ Could not find Analysis tab button');
              this.showShortcutFeedback('❌ Could not switch to Analysis tab', 'error');
            }
          }, 2000);
          
          return;
        }
        console.log('🎯 No table and no stored data - cannot analyze');
        this.showShortcutFeedback('❌ No text to analyze - capture some sentences first', 'error');
        return;
      }

      const rows = tbody.querySelectorAll('tr');
      console.log('🎯 Found captured sentence rows:', rows.length);
      if (rows.length === 0) {
        console.log('⚠️ No captured sentences found in table');
        // No rows in table, but maybe we have stored text?
        if (this.lastCapturedText) {
          console.log('🚠⚠️ FALLBACK: No table rows, using stored text (may be from previous video)');
          console.log('🎯 Stored text:', this.lastCapturedText.substring(0, 50) + '...');
          
          // Send directly to analysis using stored text
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const tab = tabs[0];
          
          const isYouTube = tab && tab.url.includes('youtube.com');
          const isUdemy = tab && tab.url.includes('udemy.com');
          const isNetflix = tab && tab.url.includes('netflix.com');
          
          if (!tab || (!isYouTube && !isUdemy && !isNetflix)) {
            console.error('❌ No supported platform tab found');
            this.showShortcutFeedback('❌ Open YouTube, Udemy, or Netflix first', 'error');
            return;
          }
          
          // Send to appropriate content script for analysis
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'analyzeTextInSidepanel',
            text: this.lastCapturedText
          });
          
          console.log('🎯 Analysis response:', response);
          
          // Wait for analysis to complete, then force reload and switch to Analysis tab
          setTimeout(async () => {
            console.log('🎯 Switching to Analysis tab and reloading data...');
            
            // Force reload analysis data from storage before switching tabs
            try {
              const result = await chrome.storage.local.get('youtubeAnalysis');
              if (result.youtubeAnalysis) {
                const data = result.youtubeAnalysis;
                console.log('🔄 Found new analysis data, reloading:', data.text);
                
                // Force reload the analysis by calling loadYouGlish directly
                if (typeof loadYouGlish === 'function') {
                  loadYouGlish(data.url, data.text, data.language);
                }
                
                // Clear the data after processing to prevent reuse
                chrome.storage.local.remove('youtubeAnalysis');
              }
            } catch (error) {
              console.error('❌ Error reloading analysis data:', error);
            }
            
            // Now switch to Analysis tab
            const analysisBtn = document.getElementById('showAnalysisBtn');
            if (analysisBtn) {
              analysisBtn.click();
              console.log('✅ Successfully analyzed stored text, reloaded data, and switched to Analysis tab');
              this.showShortcutFeedback('✅ Analyzed stored text');
            } else {
              console.error('❌ Could not find Analysis tab button');
              this.showShortcutFeedback('❌ Could not switch to Analysis tab', 'error');
            }
          }, 2000);
          
          return;
        }
        
        console.log('⚠️ No captured sentences found - capture some sentences first');
        this.showShortcutFeedback('❌ No sentences to analyze - capture some first', 'error');
        return;
      }

      // Get the text from the last row
      const lastRow = rows[rows.length - 1];
      console.log('🎯 Last row HTML:', lastRow.innerHTML);
      console.log('🎯 Total rows in table:', rows.length);
      console.log('🎯 Using row index:', rows.length - 1);
      
      // Debug: Show all rows to understand the order
      console.log('🎯 === ALL ROWS IN TABLE ===');
      rows.forEach((row, i) => {
        const textCell = row.querySelector('td:nth-child(2)');
        const text = textCell ? textCell.textContent.trim() : 'NO TEXT';
        console.log(`🎯 Row ${i}: ${text.substring(0, 60)}...`);
      });
      console.log('🎯 === END ALL ROWS ===');
      
      const textCell = lastRow.querySelector('td:nth-child(2)'); // Second column contains the text
      console.log('🎯 Text cell found:', !!textCell);
      if (!textCell) {
        console.log('⚠️ Could not find text in last captured sentence');
        // Try finding any text in the row
        const allCells = lastRow.querySelectorAll('td');
        console.log('🎯 All cells in row:', allCells.length);
        allCells.forEach((cell, i) => {
          console.log(`🎯 Cell ${i}:`, cell.textContent.substring(0, 50));
        });
        return;
      }

      const sentenceText = textCell.textContent.trim();
      console.log('🎯 Analyzing sentence from table:', sentenceText);
      console.log('🎯 Stored sentence for comparison:', this.lastCapturedText?.substring(0, 50) + '...');
      console.log('🎯 Are they the same?', sentenceText === this.lastCapturedText);

      // Send directly to analysis (bypass button click)
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      if (!tab || !tab.url.includes('youtube.com')) {
        console.error('❌ No YouTube tab found');
        return;
      }
      
      // Send to YouTube content script for analysis
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'analyzeTextInSidepanel',
        text: sentenceText
      });
      
      console.log('🎯 Analysis response:', response);
      
      // Wait for analysis to complete, then force reload and switch to Analysis tab
      setTimeout(async () => {
        console.log('🎯 Switching to Analysis tab and reloading data...');
        
        // Force reload analysis data from storage before switching tabs
        try {
          const result = await chrome.storage.local.get('youtubeAnalysis');
          if (result.youtubeAnalysis) {
            const data = result.youtubeAnalysis;
            console.log('🔄 Found new analysis data, reloading:', data.text);
            
            // Force reload the analysis by calling loadYouGlish directly
            if (typeof loadYouGlish === 'function') {
              loadYouGlish(data.url, data.text, data.language);
            }
            
            // Clear the data after processing to prevent reuse
            chrome.storage.local.remove('youtubeAnalysis');
          }
        } catch (error) {
          console.error('❌ Error reloading analysis data:', error);
        }
        
        // Now switch to Analysis tab
        const analysisBtn = document.getElementById('showAnalysisBtn');
        if (analysisBtn) {
          analysisBtn.click();
          console.log('✅ Successfully analyzed, reloaded data, and switched to Analysis tab');
          this.showShortcutFeedback('✅ Analyzing and switching to AI tab');
        } else {
          console.error('❌ Could not find Analysis tab button');
          this.showShortcutFeedback('❌ Could not switch to Analysis tab', 'error');
        }
      }, 2000); // Wait 2 seconds for analysis to be fully processed and saved

    } catch (error) {
      console.error('❌ Error in analyzeLastAndSwitchTab:', error);
    }
  }

  // Jump to the latest captured timestamp
  async jumpToLatestTimestamp() {
    try {
      console.log('📍 Starting B shortcut - jump to latest timestamp');
      
      // Get the captured sentences table - try multiple selectors
      let tbody = this.container.querySelector('.captured-sentences tbody');
      console.log('📍 Looking for .captured-sentences tbody:', !!tbody);
      
      if (!tbody) {
        tbody = this.container.querySelector('table tbody');
        console.log('📍 Looking for table tbody:', !!tbody);
      }
      
      if (!tbody) {
        tbody = this.container.querySelector('.transcript-table tbody');
        console.log('📍 Looking for .transcript-table tbody:', !!tbody);
      }
      
      console.log('📍 Available tables:', this.container.querySelectorAll('table').length);
      
      // Debug: Show actual table structure
      const allTables = this.container.querySelectorAll('table');
      allTables.forEach((table, i) => {
        console.log(`📍 Table ${i} classes:`, table.className);
        console.log(`📍 Table ${i} HTML:`, table.outerHTML.substring(0, 200) + '...');
      });
      
      if (!tbody) {
        console.log('📍 No tbody found with any selector');
        // Use stored timestamp as fallback
        if (this.lastCapturedTimestamp) {
          console.log('📍 Using stored timestamp as fallback:', this.lastCapturedTimestamp);
          await this.seekToTimestamp(this.lastCapturedTimestamp);
          this.showShortcutFeedback(`✅ Jumped to ${this.lastCapturedTimestamp}s (stored)`);
          return;
        }
        console.log('📍 No table and no stored timestamp');
        this.showShortcutFeedback('❌ No timestamp found', 'error');
        return;
      }

      // Get all rows and find the last one with a timestamp
      const rows = tbody.querySelectorAll('tr');
      console.log('📍 Found rows:', rows.length);
      if (rows.length === 0) {
        console.log('📍 No captured sentences found');
        return;
      }

      // Get the last row
      const lastRow = rows[rows.length - 1];
      console.log('📍 Last row HTML:', lastRow.innerHTML);
      
      const timestampCell = lastRow.querySelector('td:first-child a');
      console.log('📍 Timestamp cell found:', !!timestampCell);
      
      if (!timestampCell) {
        // Try alternative selectors
        const altTimestamp = lastRow.querySelector('a[href*="t="]');
        console.log('📍 Alternative timestamp found:', !!altTimestamp);
        if (altTimestamp) {
          const href = altTimestamp.getAttribute('href');
          console.log('📍 Alternative href:', href);
          const timestampMatch = href.match(/[&?]t=(\d+)s?/);
          if (timestampMatch) {
            const timestamp = parseInt(timestampMatch[1]);
            console.log('📍 Parsed alternative timestamp:', timestamp);
            await this.seekToTimestamp(timestamp);
            this.showShortcutFeedback(`✅ Jumped to ${timestamp}s`);
            return;
          }
        }
        
        // Fallback to stored timestamp if available
        if (this.lastCapturedTimestamp) {
          console.log('📍 Using stored timestamp as fallback:', this.lastCapturedTimestamp);
          await this.seekToTimestamp(this.lastCapturedTimestamp);
          this.showShortcutFeedback(`✅ Jumped to ${this.lastCapturedTimestamp}s (stored)`);
          return;
        }
        
        console.log('📍 No timestamp found in latest capture and no stored timestamp');
        this.showShortcutFeedback('❌ No timestamp found', 'error');
        return;
      }

      // Extract timestamp from the href
      const href = timestampCell.getAttribute('href');
      console.log('📍 Timestamp href:', href);
      if (!href) {
        console.log('📍 No href found in timestamp link');
        return;
      }

      // Parse timestamp from URL (format: &t=123s)
      const timestampMatch = href.match(/[&?]t=(\d+)s?/);
      if (!timestampMatch) {
        console.log('📍 Could not parse timestamp from URL:', href);
        return;
      }

      const timestamp = parseInt(timestampMatch[1]);
      console.log('📍 Jumping to latest timestamp:', timestamp);
      await this.seekToTimestamp(timestamp);
      this.showShortcutFeedback(`✅ Jumped to ${timestamp}s`);

    } catch (error) {
      console.error('📍 Error jumping to latest timestamp:', error);
    }
  }

  // Helper function to seek to timestamp
  async seekToTimestamp(timestamp) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        console.log('📍 No active tab found');
        return;
      }

      const tab = tabs[0];
      let action = 'seekToTime';
      let timeParam = 'timestamp';
      
      // Detect platform and use appropriate action
      if (tab.url.includes('coursera.org')) {
        action = 'seekCourseraVideo';
        timeParam = 'time';
      } else if (tab.url.includes('udemy.com')) {
        action = 'seekUdemyVideo';
        timeParam = 'time';
      } else if (tab.url.includes('netflix.com')) {
        action = 'seekNetflixVideo';
        timeParam = 'time';
      }
      
      console.log('📍 Sending seek message to tab:', tab.id, 'action:', action, 'timestamp:', timestamp);
      
      const message = { action };
      message[timeParam] = timestamp;
      
      const response = await chrome.tabs.sendMessage(tab.id, message);
      console.log('📍 Seek response:', response);
      console.log('✅ Successfully jumped back to timestamp:', timestamp);
    } catch (error) {
      console.error('📍 Error seeking to timestamp:', error);
    }
  }

  // Setup timing offset controls
  setupTimingOffsetControls() {
    const slider = this.container.querySelector('.timing-offset-slider');
    const valueDisplay = this.container.querySelector('.timing-offset-value');
    const descDisplay = this.container.querySelector('.timing-offset-desc');
    
    if (!slider || !valueDisplay || !descDisplay) return;
    
    // Load saved preference
    chrome.storage.local.get(['youtubeTimingOffset'], (result) => {
      const savedOffset = result.youtubeTimingOffset ?? 1.0; // Default to 1.0s
      slider.value = savedOffset;
      valueDisplay.textContent = `${savedOffset}s`;
      descDisplay.textContent = savedOffset;
      this.timingOffset = savedOffset;
      console.log('⏰ Loaded timing offset:', savedOffset);
    });
    
    // Handle slider changes
    slider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      valueDisplay.textContent = `${value}s`;
      descDisplay.textContent = value;
      this.timingOffset = value;
      
      // Save preference
      chrome.storage.local.set({ youtubeTimingOffset: value }, () => {
        console.log('⏰ Saved timing offset:', value);
      });
    });
    
    // Initialize default
    this.timingOffset = parseFloat(slider.value);
  }

  // ✅ NEW: Netflix-specific collection start
  async startNetflixCollection(collectBtn, statusEl, tab) {
    statusEl.textContent = '🎭 Starting Netflix subtitle collection...';
    statusEl.className = 'transcript-status loading';
    
    console.log('🎭 Starting Netflix subtitle collection...');
    
    // Hide collect button during collection
    collectBtn.style.display = 'none';
    
    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, { 
        action: 'startNetflixSubtitleCollection'
      });
    } catch (connectionError) {
      if (connectionError.message.includes('Could not establish connection')) {
        statusEl.textContent = '❌ Cannot connect to Netflix page. Please refresh and try again.';
        statusEl.className = 'transcript-status error';
        collectBtn.style.display = 'block';
        return;
      }
      throw connectionError;
    }
    
    if (result.success) {
      statusEl.textContent = '🎭 Netflix subtitle collection started. Play video to capture subtitles...';
      statusEl.className = 'transcript-status success';
      
      // Update button to show stop state
      collectBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <rect x="9" y="9" width="6" height="6"/>
        </svg>
        Stop
      `;
      collectBtn.style.display = 'block';
      
    } else {
      statusEl.textContent = '❌ Failed to start Netflix collection. Try refreshing the page.';
      statusEl.className = 'transcript-status error';
      collectBtn.style.display = 'block';
    }
  }

  // ✅ NEW: Udemy-specific collection start
  async startUdemyCollection(collectBtn, statusEl, tab) {
    statusEl.textContent = '📚 Starting Udemy subtitle collection...';
    statusEl.className = 'transcript-status loading';
    
    console.log('📚 Starting Udemy subtitle collection...');
    
    // Hide collect button during collection
    collectBtn.style.display = 'none';
    
    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, { 
        action: 'startUdemySubtitleCollection'
      });
    } catch (connectionError) {
      if (connectionError.message.includes('Could not establish connection')) {
        statusEl.textContent = '❌ Cannot connect to Udemy page. Please refresh and try again.';
        statusEl.className = 'transcript-status error';
        collectBtn.style.display = 'block';
        return;
      }
      throw connectionError;
    }
    
    if (result.success) {
      statusEl.textContent = '📚 Udemy subtitle collection started. Play video to capture subtitles...';
      statusEl.className = 'transcript-status success';
      
      // Update button to show stop state
      collectBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <rect x="9" y="9" width="6" height="6"/>
        </svg>
        Stop
      `;
      collectBtn.style.display = 'block';
      
    } else {
      statusEl.textContent = '❌ Failed to start Udemy collection. Try refreshing the page.';
      statusEl.className = 'transcript-status error';
      collectBtn.style.display = 'block';
    }
  }

  // Netflix manual subtitle capture
  async captureCurrentSubtitle() {
    const statusEl = this.container.querySelector('.transcript-status');
    const captureBtn = this.container.querySelector('.capture-subtitle-btn');
    
    try {
      statusEl.textContent = '🎭 Capturing current subtitle...';
      statusEl.className = 'transcript-status loading';
      
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      // Platform-aware validation instead of hardcoded Netflix
      const isYoutube = tab.url.includes('youtube.com');
      const isNetflix = tab.url.includes('netflix.com'); 
      const isUdemy = tab.url.includes('udemy.com');
      const isCoursera = tab.url.includes('coursera.org');
      
      if (!isYoutube && !isNetflix && !isUdemy && !isCoursera) {
        statusEl.textContent = '❌ Please open YouTube, Netflix, Udemy, or Coursera first';
        statusEl.className = 'transcript-status error';
        return;
      }
      
      let result;
      
      // Try to capture with retry logic for connection issues
      try {
        result = await chrome.tabs.sendMessage(tab.id, { 
          action: 'captureCurrentSubtitle'
        });
      } catch (connectionError) {
        if (connectionError.message.includes('Could not establish connection') || 
            connectionError.message.includes('Receiving end does not exist')) {
          // Content script may not be loaded, try refreshing and retry once
          const platformName = isNetflix ? 'Netflix' : isUdemy ? 'Udemy' : isCoursera ? 'Coursera' : 'YouTube';
          console.log(`🔄 Connection failed, attempting to refresh ${platformName} content script...`);
          statusEl.textContent = `🔄 Reconnecting to ${platformName} page...`;
          
          // Wait a moment then retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            result = await chrome.tabs.sendMessage(tab.id, { 
              action: 'captureCurrentSubtitle'
            });
            console.log('✅ Retry successful after connection error');
          } catch (retryError) {
            throw new Error(`Connection failed. Please refresh the ${platformName} page and try again.`);
          }
        } else {
          throw connectionError;
        }
      }
      
      // Handle Netflix/Udemy/Coursera return shapes
      const subtitleText = result.text || (result.data && result.data.text);
      const timestamp = result.timestamp || (result.data && result.data.timestamp) || 0;
      
      if (result.success && subtitleText) {
        const platformName = isNetflix ? 'Netflix' : isUdemy ? 'Udemy' : isCoursera ? 'Coursera' : 'YouTube';
        console.log(`🎬 Captured ${platformName} subtitle:`, subtitleText);
        
        statusEl.textContent = `✅ Captured: "${subtitleText}"`;
        statusEl.className = 'transcript-status success';
        
        // Send to sidepanel for platform-specific analysis
        let videoInfo = result.videoInfo || (result.data && result.data.videoInfo) || {};
        // Coursera content script returns fields directly on data; construct videoInfo for consistency
        if (isCoursera && (!videoInfo || Object.keys(videoInfo).length === 0) && result.data) {
          videoInfo = {
            url: result.data.url,
            title: result.data.title,
            courseTitle: result.data.courseTitle,
            videoId: result.data.videoId,
            platform: 'coursera'
          };
        }
        const platform = isNetflix ? 'netflix' : isUdemy ? 'udemy' : isCoursera ? 'coursera' : 'youtube';
        
        console.log(`🎬 ${platformName} capture - videoInfo:`, videoInfo);
        
        // Avoid double-processing on Coursera (content script already sends recordCourseraLearning)
        if (!isCoursera) {
          chrome.runtime.sendMessage({
            action: 'analyzeTextInSidepanel',
            text: subtitleText,
            url: videoInfo.url || tab.url,
            originalUrl: videoInfo.url || tab.url,
            title: videoInfo.title || videoInfo.courseTitle || `${platformName} Content`,
            videoId: videoInfo.videoId,
            movieId: videoInfo.movieId,
            courseTitle: videoInfo.courseTitle,
            timestamp: timestamp,
            platform: platform,
            source: `${platform}-learning`
          });
        }
        
        // ✅ Also save individual capture to learning history immediately
        if (isNetflix || isUdemy) {
          try {
            await chrome.runtime.sendMessage({
              action: isNetflix ? 'recordNetflixLearning' : 'recordUdemyLearning',
              data: {
                text: subtitleText.trim(),
                language: 'en', // Default, could be enhanced with detection
                url: videoInfo.url || tab.url,
                title: videoInfo.title || videoInfo.courseTitle || `${platformName} Content`,
                platform: platform,
                timestamp: timestamp,
                videoId: videoInfo.videoId
              }
            });
            console.log(`✅ ${platformName} individual capture saved to learning history`);
          } catch (error) {
            console.error(`❌ Error saving ${platformName} capture to learning history:`, error);
          }
        }
        
        // Initialize segments array based on platform
        const segmentsArrayName = `${platform}Segments`;
        if (!this[segmentsArrayName]) {
          this[segmentsArrayName] = [];
        }
        
        // Create a new segment with proper indexing
        const segment = {
          text: subtitleText,
          cleanText: subtitleText,
          start: timestamp,
          timestamp: this.formatTimestamp(timestamp),
          timestampDisplay: this.formatTimestamp(timestamp),
          timestampInSeconds: timestamp,
          source: 'manual-capture',
          platform: platform,
          originalUrl: videoInfo.url || tab.url,
          youtubeLink: videoInfo.url || tab.url,
          videoId: videoInfo.videoId,
          movieId: videoInfo.movieId,
          courseTitle: videoInfo.courseTitle,
          videoTitle: videoInfo.title || videoInfo.courseTitle || `${platformName} Content`,
          channelName: isNetflix ? 'Netflix' : isUdemy ? 'Udemy' : isCoursera ? 'Coursera' : (videoInfo.channelName || 'Unknown Channel'),
          segmentIndex: this[segmentsArrayName].length,
          groupIndex: this[segmentsArrayName].length
        };
        
        // Add to accumulated segments
        this[segmentsArrayName].push(segment);
        console.log(`🎬 Added ${platformName} segment ${this[segmentsArrayName].length}: "${subtitleText}"`);
        
        // Update status to show accumulated count
        statusEl.textContent = `✅ Captured ${this[segmentsArrayName].length} sentences: "${subtitleText}"`;
        
        // Show ALL captured segments in the transcript viewer
        this.displayTranscriptInReader([...this[segmentsArrayName]]);
        
        // Add some visual feedback
        captureBtn.style.backgroundColor = '#4CAF50';
        captureBtn.style.color = 'white';
        setTimeout(() => {
          captureBtn.style.backgroundColor = '';
          captureBtn.style.color = '';
        }, 2000);
        
      } else {
        statusEl.textContent = '❌ No subtitle found. Make sure subtitles are enabled and visible.';
        statusEl.className = 'transcript-status error';
      }
      
    } catch (error) {
      console.error('❌ Error capturing subtitle:', error);
      statusEl.textContent = '❌ Failed to capture subtitle. Try refreshing the page.';
      statusEl.className = 'transcript-status error';
    }
  }

  // Udemy manual subtitle capture
  async captureUdemySubtitle() {
    const statusEl = this.container.querySelector('.transcript-status');
    const captureBtn = this.container.querySelector('.capture-subtitle-btn');
    
    try {
      statusEl.textContent = '📚 Capturing current subtitle...';
      statusEl.className = 'transcript-status loading';
      
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      if (!tab.url.includes('udemy.com')) {
        statusEl.textContent = '❌ Please open Udemy first';
        statusEl.className = 'transcript-status error';
        return;
      }
      
      let result;
      
      // Try both action names for Udemy compatibility
      try {
        result = await chrome.tabs.sendMessage(tab.id, { 
          action: 'captureCurrentSubtitle'  // Try standard action first
        });
      } catch (error1) {
        try {
          result = await chrome.tabs.sendMessage(tab.id, { 
            action: 'captureUdemySubtitle'  // Fallback to platform-specific action
          });
        } catch (error2) {
          if (error2.message.includes('Could not establish connection')) {
            console.log('🔄 Udemy content script not ready, waiting and retrying...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            result = await chrome.tabs.sendMessage(tab.id, { action: 'captureCurrentSubtitle' });
          } else {
            throw error2;
          }
        }
      }
      
      console.log('🎯 UI RECEIVED RESPONSE FROM UDEMY CONTENT SCRIPT:');
      console.log('  - full result:', JSON.stringify(result, null, 2));
      console.log('  - result.success:', result.success);
      console.log('  - result.data:', result.data);
      console.log('  - result.data.text:', result.data ? result.data.text : 'N/A');
      console.log('  - condition (result.success && result.data && result.data.text):', 
                  !!(result.success && result.data && result.data.text));
      
      if (result.success && result.data && result.data.text) {
        console.log('✅ UI SUCCESS PATH: Captured Udemy subtitle:', result.data.text);
        
        statusEl.textContent = `✅ Captured: "${result.data.text}"`;
        statusEl.className = 'transcript-status success';
        
        // Send to sidepanel for Udemy-specific analysis
        chrome.runtime.sendMessage({
          action: 'analyzeTextInSidepanel',
          text: result.data.text,
          url: result.data.videoInfo?.url || tab.url,
          originalUrl: result.data.videoInfo?.url || tab.url,
          title: result.data.videoInfo?.lectureTitle || 'Udemy Content',
          courseTitle: result.data.videoInfo?.courseTitle,
          videoId: result.data.videoInfo?.videoId,
          timestamp: result.data.timestamp || 0,
          platform: 'udemy',
          source: 'udemy-learning'
        });
        
        // Initialize segments array if it doesn't exist
        if (!this.udemySegments) {
          this.udemySegments = [];
        }
        
        // Create a new segment with proper indexing for Udemy
        const segment = {
          text: result.data.text,
          cleanText: result.data.text,
          start: result.data.timestamp || 0,
          timestamp: this.formatTimestamp(result.data.timestamp || 0),
          timestampDisplay: this.formatTimestamp(result.data.timestamp || 0),
          timestampInSeconds: result.data.timestamp || 0,
          source: 'manual-capture',
          platform: 'udemy',
          udemyUrl: result.data.timestampUrl || result.data.videoInfo?.url || tab.url, // Use timestamp URL
          youtubeLink: result.data.timestampUrl || result.data.videoInfo?.url || tab.url, // Use timestamp URL for navigation
          videoId: result.data.videoInfo?.videoId,
          courseTitle: result.data.videoInfo?.courseTitle,
          lectureTitle: result.data.videoInfo?.lectureTitle,
          segmentIndex: this.udemySegments.length, // Proper indexing
          groupIndex: this.udemySegments.length,
          // Ensure videoInfo contains platform info for timestamp click logic
          videoInfo: {
            platform: 'udemy',
            videoId: result.data.videoInfo?.videoId,
            courseTitle: result.data.videoInfo?.courseTitle,
            lectureTitle: result.data.videoInfo?.lectureTitle,
            url: result.data.videoInfo?.url || tab.url
          }
        };
        
        // Add to accumulated segments
        this.udemySegments.push(segment);
        console.log(`📚 Added Udemy segment ${this.udemySegments.length}: "${result.data.text}"`);
        
        // Update status to show accumulated count
        statusEl.textContent = `✅ Captured ${this.udemySegments.length} sentences: "${result.data.text}"`;
        
        // Show ALL captured segments in the transcript viewer
        this.displayTranscriptInReader([...this.udemySegments]);
        
        // Add some visual feedback
        captureBtn.style.backgroundColor = '#7c4dff'; // Udemy purple
        captureBtn.style.color = 'white';
        setTimeout(() => {
          captureBtn.style.backgroundColor = '';
          captureBtn.style.color = '';
        }, 2000);
        
      } else {
        statusEl.textContent = '❌ No subtitle found. Make sure subtitles are enabled and visible.';
        statusEl.className = 'transcript-status error';
      }
      
    } catch (error) {
      console.error('❌ Error capturing Udemy subtitle:', error);
      statusEl.textContent = '❌ Failed to capture subtitle. Try refreshing the page.';
      statusEl.className = 'transcript-status error';
    }
  }

  // Helper to format timestamp (duplicate removed)

  // ✅ NEW: Save Netflix segments to learning history with proper video titles
  async saveNetflixSegmentsToHistory(segments, videoInfo) {
    console.log('🎭 Saving Netflix segments to learning history:', { 
      segmentCount: segments.length, 
      videoInfo: videoInfo 
    });

    try {
      // Get current video info if not provided
      if (!videoInfo) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          try {
            const titleResult = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getNetflixTitle' });
            if (titleResult && titleResult.success) {
              videoInfo = {
                title: titleResult.title,
                url: tabs[0].url
              };
            }
          } catch (error) {
            console.log('🎭 Could not get Netflix title from content script, using fallback');
            // Fallback to tab title
            let title = tabs[0].title;
            if (title && title !== 'Netflix') {
              title = title.replace(' - Netflix', '').replace('Watch ', '').trim();
              videoInfo = {
                title: title,
                url: tabs[0].url
              };
            }
          }
        }
      }

      // Default fallback if no video info could be obtained
      if (!videoInfo) {
        videoInfo = {
          title: 'Netflix Content',
          url: window.location.href
        };
      }

      console.log('🎭 Using video info for saving:', videoInfo);

      // Save each segment individually to learning history
      for (const segment of segments) {
        if (segment.text && segment.text.trim()) {
          // Send message to sidepanel to record the learning search
          try {
            await chrome.runtime.sendMessage({
              action: 'recordNetflixLearning',
              data: {
                text: segment.text.trim(),
                language: segment.language || 'en',
                url: videoInfo.url,
                title: videoInfo.title,
                platform: 'netflix',
                timestamp: segment.timestamp || segment.originalTimestamp,
                videoId: videoInfo.videoId
              }
            });
            console.log('🎭 Saved Netflix segment:', segment.text.substring(0, 50) + '...');
          } catch (error) {
            console.error('❌ Error saving Netflix segment to learning history:', error);
          }
        }
      }

      console.log('✅ Successfully saved all Netflix segments to learning history');

    } catch (error) {
      console.error('❌ Error in saveNetflixSegmentsToHistory:', error);
    }
  }

  // ✅ NEW: Netflix collection completion handler
  handleNetflixCollectionComplete(result, statusEl, collectBtn) {
    if (result.success && result.segments && result.segments.length > 0) {
      console.log('🎭 Netflix subtitle collection completed');
      
      this.currentTranscript = result.segments;
      statusEl.textContent = `✅ Netflix collection complete! Captured ${result.segments.length} subtitle segments`;
      statusEl.className = 'transcript-status success';
      
      // Hide button after successful collection
      collectBtn.style.display = 'none';
      
      // ✅ NEW: Save each segment to learning history with proper Netflix video title
      this.saveNetflixSegmentsToHistory(result.segments, result.videoInfo);
      
      // Show transcript popup
      this.showTranscriptPopup(result.segments);
      
      // Update transcript viewer
      if (this.transcriptViewer && typeof this.transcriptViewer.updateTranscriptData === 'function') {
        this.transcriptViewer.updateTranscriptData(result.segments);
      } else {
        this.displayTranscriptInReader(result.segments);
      }
      
      // Show AI Polish button
      this.showAIPolishButton(result.segments);
      
      // Restructure for classic view
      this.restructureTranscript();
      this.displayTranscript();
      
    } else {
      console.log('❌ Netflix collection completed with no segments:', result);
      
      // Provide detailed troubleshooting information
      statusEl.textContent = '❌ No Netflix subtitles found. Check: 1) Subtitles enabled in Netflix player 2) Video is playing 3) Subtitles visible on screen';
      statusEl.className = 'transcript-status error';
      collectBtn.style.display = 'block';
      this.resetCollectionButton(collectBtn);
      
      // Add help text
      const helpText = document.createElement('div');
      helpText.style.cssText = 'font-size: 11px; color: #666; margin-top: 8px; line-height: 1.4;';
      helpText.innerHTML = `
        <strong>Troubleshooting:</strong><br>
        • Turn on subtitles in Netflix player (CC button)<br>
        • Make sure video is actively playing<br>
        • Check browser console for detailed logs
      `;
      
      statusEl.appendChild(helpText);
      
      // Remove help text after 10 seconds
      setTimeout(() => {
        if (helpText.parentNode) {
          helpText.remove();
        }
      }, 10000);
    }
  }

  // ✅ NEW: Udemy collection completion handler
  handleUdemyCollectionComplete(result, statusEl, collectBtn) {
    if (result.success && result.segments && result.segments.length > 0) {
      console.log('📚 Udemy subtitle collection completed');
      
      this.currentTranscript = result.segments;
      statusEl.textContent = `✅ Udemy collection complete! Captured ${result.segments.length} subtitle segments`;
      statusEl.className = 'transcript-status success';
      
      // Hide button after successful collection
      collectBtn.style.display = 'none';
      
      // Show transcript popup
      this.showTranscriptPopup(result.segments);
      
      // Update transcript viewer
      if (this.transcriptViewer && typeof this.transcriptViewer.updateTranscriptData === 'function') {
        this.transcriptViewer.updateTranscriptData(result.segments);
      } else {
        this.displayTranscriptInReader(result.segments);
      }
      
      // Show AI Polish button
      this.showAIPolishButton(result.segments);
      
      // Restructure for classic view
      this.restructureTranscript();
      this.displayTranscript();
      
    } else {
      statusEl.textContent = '❌ No Udemy subtitles collected. Make sure subtitles are enabled and visible.';
      statusEl.className = 'transcript-status error';
      collectBtn.style.display = 'block';
      this.resetCollectionButton(collectBtn);
    }
  }

  // ✅ NEW: Show audio quality indicator with visual feedback
  showQualityIndicator(indicatorEl, quality, text) {
    if (!indicatorEl) return;
    
    indicatorEl.style.display = 'block';
    const qualityBar = indicatorEl.querySelector('.quality-bar');
    const qualityText = indicatorEl.querySelector('.quality-text');
    
    // Remove existing quality classes
    qualityBar.className = 'quality-bar';
    
    // Add new quality class and update text
    switch (quality) {
      case 'excellent':
        qualityBar.classList.add('quality-excellent');
        qualityText.textContent = `✅ ${text} - Perfect for transcription!`;
        break;
      case 'moderate':
        qualityBar.classList.add('quality-moderate');
        qualityText.textContent = `⚠️ ${text} - Consider increasing volume`;
        break;
      case 'poor':
        qualityBar.classList.add('quality-poor');
        qualityText.textContent = `🔴 ${text} - Increase volume or use headphones`;
        break;
    }
    
    // Hide after 8 seconds
    setTimeout(() => {
      indicatorEl.style.display = 'none';
    }, 8000);
  }

  // ✅ NEW: Setup event listeners for Whisper timing controls
  setupWhisperTimingControls() {
    const whisperChunkInput = this.container.querySelector('#whisper-chunk-duration');
    const whisperGapInput = this.container.querySelector('#whisper-chunk-gap');
    const sentenceGroupingSelect = this.container.querySelector('#sentence-grouping');
    
    // Add real-time feedback for timing changes
    if (whisperChunkInput) {
      whisperChunkInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        const feedback = this.getTimingFeedback(value);
        this.showTimingFeedback(whisperChunkInput, feedback);
      });
    }
    
    if (whisperGapInput) {
      whisperGapInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        const feedback = value < 0.5 ? 'May cause overlaps' : value > 2 ? 'Long gaps, slower transcription' : 'Good balance';
        this.showTimingFeedback(whisperGapInput, feedback);
      });
    }
    
    if (sentenceGroupingSelect) {
      sentenceGroupingSelect.addEventListener('change', (e) => {
        const feedback = this.getSentenceGroupingFeedback(e.target.value);
        this.showTimingFeedback(sentenceGroupingSelect, feedback);
      });
    }
  }
  
  // ✅ NEW: Get timing feedback based on chunk duration
  getTimingFeedback(chunkDuration) {
    if (chunkDuration <= 10) {
      return { type: 'info', message: 'Frequent timestamps, good for precise timing' };
    } else if (chunkDuration <= 15) {
      return { type: 'success', message: 'Balanced - good accuracy and context' };
    } else if (chunkDuration <= 20) {
      return { type: 'warning', message: 'Longer segments, better for context' };
    } else {
      return { type: 'warning', message: 'Very long segments, may miss timing details' };
    }
  }
  
  // ✅ NEW: Get sentence grouping feedback
  getSentenceGroupingFeedback(grouping) {
    switch (grouping) {
      case 'short':
        return { type: 'info', message: 'Short segments - precise but frequent timestamps' };
      case 'medium':
        return { type: 'success', message: 'Balanced grouping - recommended for most content' };
      case 'long':
        return { type: 'info', message: 'Long segments - fewer timestamps, more context' };
      default:
        return { type: 'info', message: 'Standard grouping' };
    }
  }
  
  // ✅ NEW: Show timing feedback to user
  showTimingFeedback(element, feedback) {
    // Remove existing feedback
    const existingFeedback = element.parentNode.querySelector('.timing-feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }
    
    // Create new feedback element
    const feedbackEl = document.createElement('div');
    feedbackEl.className = `timing-feedback ${feedback.type}`;
    feedbackEl.textContent = feedback.message;
    feedbackEl.style.cssText = `
      font-size: 10px;
      margin-top: 2px;
      padding: 2px 4px;
      border-radius: 2px;
      background: ${feedback.type === 'success' ? '#d1f7c4' : feedback.type === 'warning' ? '#fef3cd' : '#d1ecf1'};
      color: ${feedback.type === 'success' ? '#155724' : feedback.type === 'warning' ? '#856404' : '#0c5460'};
      border: 1px solid ${feedback.type === 'success' ? '#c3e6cb' : feedback.type === 'warning' ? '#faeeba' : '#bee5eb'};
    `;
    
    // Insert after the input
    element.parentNode.insertBefore(feedbackEl, element.nextSibling);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (feedbackEl.parentNode) {
        feedbackEl.remove();
      }
    }, 3000);
  }

  async testAudioPermissions() {
    const testBtn = this.container.querySelector('#test-audio-permissions');
    const originalText = testBtn.textContent;
    
    try {
      testBtn.textContent = '🔄 Testing...';
      testBtn.disabled = true;
      
      // Test microphone permissions
      console.log('🧪 Testing microphone permissions for Whisper...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,  // Disable to pick up speaker audio
          noiseSuppression: false,  // Disable to preserve all audio
          autoGainControl: false,   // Disable for consistent levels
          sampleRate: 44100,       // Higher sample rate
          channelCount: 1,         // Mono audio
          volume: 1.0             // Maximum sensitivity
        },
        video: false
      });
      
      const hasAudio = stream.getAudioTracks().length > 0;
      
      if (hasAudio) {
        testBtn.textContent = '🎵 Testing Audio Levels...';
        testBtn.style.background = '#3b82f6';
        
        // ✅ NEW: Test audio levels for 3 seconds
        try {
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          source.connect(analyser);
          
          analyser.fftSize = 256;
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          
          let maxLevel = 0;
          let levelCount = 0;
          
          const testAudioLevels = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
            maxLevel = Math.max(maxLevel, average);
            levelCount++;
            
            console.log(`🧪 Test audio level: ${Math.round(average)}/255`);
            
            if (levelCount < 15) { // Test for 3 seconds (15 * 200ms)
              setTimeout(testAudioLevels, 200);
            } else {
              // Show detailed results with specific guidance
              const qualityIndicator = this.container.querySelector('#audio-quality-status');
              
              if (maxLevel > 30) {
                testBtn.textContent = '✅ Excellent - Ready for Whisper!';
                testBtn.style.background = '#22c55e';
                console.log(`✅ Excellent audio level: ${Math.round(maxLevel)}/255 - perfect for transcription`);
                this.showQualityIndicator(qualityIndicator, 'excellent', `Excellent: ${Math.round(maxLevel)}/255`);
              } else if (maxLevel > 15) {
                testBtn.textContent = '⚠️ OK - Could be Better';
                testBtn.style.background = '#f59e0b';
                console.log(`⚠️ Moderate audio level: ${Math.round(maxLevel)}/255 - try increasing volume slightly`);
                this.showQualityIndicator(qualityIndicator, 'moderate', `Moderate: ${Math.round(maxLevel)}/255`);
              } else {
                testBtn.textContent = '🔴 Too Low - Fix Setup!';
                testBtn.style.background = '#ef4444';
                console.log(`🔴 Audio level too low: ${Math.round(maxLevel)}/255`);
                console.log('💡 Solutions: 1) Increase speaker volume 2) Move microphone closer 3) Use headphones');
                this.showQualityIndicator(qualityIndicator, 'poor', `Too Low: ${Math.round(maxLevel)}/255`);
              }
              
              // Clean up
              audioContext.close();
              stream.getTracks().forEach(track => track.stop());
              
              // Reset button after 4 seconds
              setTimeout(() => {
                testBtn.textContent = originalText;
                testBtn.style.background = '';
                testBtn.disabled = false;
              }, 4000);
            }
          };
          
          testAudioLevels();
          
        } catch (error) {
          console.log('⚠️ Audio level testing not available:', error.message);
          testBtn.textContent = '✅ Audio Ready!';
          testBtn.style.background = '#22c55e';
          
          // Clean up test stream
          stream.getTracks().forEach(track => track.stop());
          
          setTimeout(() => {
            testBtn.textContent = originalText;
            testBtn.style.background = '';
            testBtn.disabled = false;
          }, 3000);
        }
        
      } else {
        testBtn.textContent = '❌ No Microphone';
        testBtn.style.background = '#ef4444';
        console.log('❌ No microphone available - check microphone permissions');
        
        setTimeout(() => {
          testBtn.textContent = originalText;
          testBtn.style.background = '';
          testBtn.disabled = false;
        }, 3000);
      }
      
    } catch (error) {
      console.error('❌ Microphone permission test failed:', error);
      testBtn.textContent = '❌ Permission Denied';
      testBtn.style.background = '#ef4444';
      
      setTimeout(() => {
        testBtn.textContent = originalText;
        testBtn.style.background = '';
        testBtn.disabled = false;
      }, 3000);
    }
  }

  seekToTime(seconds) {
    // Send message to content script to seek video
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      const tab = tabs[0];
      let action = 'seekToTime';
      let timeParam = 'time';
      
      // Detect platform and use appropriate action
      if (tab.url.includes('coursera.org')) {
        action = 'seekCourseraVideo';
        timeParam = 'time';
      } else if (tab.url.includes('udemy.com')) {
        action = 'seekUdemyVideo';
        timeParam = 'time';
      } else if (tab.url.includes('netflix.com')) {
        action = 'seekNetflixVideo';
        timeParam = 'time';
      } else {
        timeParam = 'timestamp'; // YouTube uses timestamp
      }
      
      const message = { action };
      message[timeParam] = seconds;
      
      chrome.tabs.sendMessage(tab.id, message);
    });
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .transcript-restructurer {
        padding: 20px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border: 1px solid #dee2e6;
        border-radius: 12px;
        margin: 15px 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      
      .transcript-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .transcript-header h3 {
        margin: 0;
        font-size: 20px;
        color: #2c3e50;
        font-weight: 600;
        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      
      .platform-indicator {
        margin-left: auto;
        margin-right: 10px;
        display: flex;
        align-items: center;
      }
      
      .platform-note {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: 2px solid #e3f2fd;
        border-radius: 10px;
        padding: 16px;
        margin: 15px 0;
        font-size: 14px;
        color: #2c3e50;
        border-left: 5px solid #2196f3;
        box-shadow: 0 2px 8px rgba(33, 150, 243, 0.1);
        font-weight: 500;
        line-height: 1.4;
      }
      
      .platform-note.platform-netflix {
        border: 2px solid #ffebee;
        border-left: 5px solid #e50914;
        background: linear-gradient(135deg, #ffffff 0%, #ffebee 100%);
        color: #c62828;
        box-shadow: 0 2px 8px rgba(229, 9, 20, 0.1);
      }
      
      .platform-note.platform-udemy {
        border: 2px solid #f3e5f5;
        border-left: 5px solid #a435f0;
        background: linear-gradient(135deg, #ffffff 0%, #f3e5f5 100%);
        color: #6a1b9a;
        box-shadow: 0 2px 8px rgba(164, 53, 240, 0.1);
      }
      
      .platform-note.platform-coursera {
        border: 2px solid #e3f2fd;
        border-left: 5px solid #0056d2;
        background: linear-gradient(135deg, #ffffff 0%, #e8f1ff 100%);
        color: #003d82;
        box-shadow: 0 2px 8px rgba(0, 86, 210, 0.1);
      }
      
      .platform-note.platform-youtube {
        border: 2px solid #e3f2fd;
        border-left: 5px solid #1976d2;
        background: linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%);
        color: #1565c0;
        box-shadow: 0 2px 8px rgba(25, 118, 210, 0.1);
      }
      
      .platform-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
      }
      
      .platform-badge.platform-youtube {
        background: linear-gradient(135deg, #ff0000, #cc0000);
        color: white;
      }
      
      .platform-badge.platform-netflix {
        background: linear-gradient(135deg, #e50914, #b20610);
        color: white;
      }
      
      .platform-badge.platform-udemy {
        background: linear-gradient(135deg, #a435f0, #8e24cc);
        color: white;
      }
      
      .platform-badge.platform-coursera {
        background: linear-gradient(135deg, #0056d2, #0041a8);
        color: white;
      }
      
      .platform-badge.platform-unknown {
        background: linear-gradient(135deg, #666, #444);
        color: white;
      }
      
      .course-info {
        background: linear-gradient(135deg, #f8f9fa, #e9ecef);
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        font-size: 13px;
        line-height: 1.5;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .course-info .course-title {
        font-weight: 600;
        color: #7c4dff;
        margin-bottom: 4px;
      }
      
      .course-info .lecture-title {
        font-weight: 500;
        color: #5e35b1;
        margin-bottom: 4px;
      }
      
      .course-info .course-url {
        font-size: 11px;
        color: #666;
        word-break: break-all;
      }
      
      .course-info .course-url span {
        font-family: monospace;
        background: rgba(124, 77, 255, 0.1);
        padding: 2px 4px;
        border-radius: 3px;
      }
      
      .refresh-platform-btn {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-left: 8px;
        color: currentColor;
      }
      
      .refresh-platform-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: rotate(180deg);
        border-color: rgba(255, 255, 255, 0.5);
      }
      
      .refresh-platform-btn svg {
        width: 12px;
        height: 12px;
        stroke-width: 2;
      }
      
      .header-buttons {
        display: flex;
        gap: 10px;
      }
      
      .check-captions-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        background: #34a853;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .check-captions-btn:hover {
        background: #2d8e47;
      }
      
      .list-tabs-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        background: #ff9800;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .list-tabs-btn:hover {
        background: #f57c00;
      }
      
      .test-connection-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        background: #9c27b0;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .test-connection-btn:hover {
        background: #7b1fa2;
      }
      
      .fetch-transcript-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 8px 15px;
        background: #4285f4;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .fetch-transcript-btn:hover {
        background: #3367d6;
      }
      
      .start-collection-btn,
      .capture-subtitle-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 8px 16px;
        background: ${
          this.currentPlatform === 'netflix' ? '#e50914' : 
          this.currentPlatform === 'udemy' ? '#a435f0' : 
          this.currentPlatform === 'coursera' ? '#5624d0' :
          '#ff5722' // YouTube orange
        };
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .start-collection-btn:hover,
      .capture-subtitle-btn:hover {
        background: ${
          this.currentPlatform === 'netflix' ? '#d40812' : 
          this.currentPlatform === 'udemy' ? '#9422e0' : 
          this.currentPlatform === 'coursera' ? '#4615b0' :
          '#e64a19' // YouTube orange darker
        };
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      .start-collection-btn:active,
      .capture-subtitle-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .clear-all-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      }
      
      .clear-all-btn:hover {
        background: #c82333;
      }
      
      .transcript-options {
        display: flex;
        gap: 20px;
        margin-bottom: 15px;
        font-size: 14px;
      }
      
      .transcript-options label {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .transcript-options input[type="number"] {
        width: 60px;
        padding: 2px 5px;
      }
      
      /* ✨ NEW: Modern subtitle mode selection styles */
      .subtitle-mode-selection {
        background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
        border: 1px solid #e1e8ff;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }
      
      .subtitle-mode-selection h4 {
        margin: 0 0 16px 0;
        color: #2d3748;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
      }
      
      .subtitle-mode-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      
      .subtitle-mode-card {
        display: block !important;
        background: white;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }
      
      .subtitle-mode-card:hover {
        border-color: #4299e1;
        box-shadow: 0 4px 12px rgba(66, 153, 225, 0.15);
        transform: translateY(-1px);
      }
      
      .subtitle-mode-card.active,
      .subtitle-mode-card:has(input:checked) {
        border-color: #3182ce;
        background: linear-gradient(135deg, #ebf8ff 0%, #bee3f8 100%);
        box-shadow: 0 4px 16px rgba(49, 130, 206, 0.2);
      }
      
      .subtitle-mode-card input[type="radio"] {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
      
      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .mode-icon {
        font-size: 24px;
        line-height: 1;
      }
      
      .mode-title {
        font-size: 14px;
        font-weight: 600;
        color: #2d3748;
      }
      
      .card-description {
        font-size: 12px;
        color: #4a5568;
        line-height: 1.4;
        margin-bottom: 12px;
      }
      
      .card-tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      
      .tag {
        font-size: 10px;
        padding: 3px 8px;
        border-radius: 12px;
        font-weight: 500;
        line-height: 1;
      }
      
      .tag-fast {
        background: #fef5e7;
        color: #d69e2e;
        border: 1px solid #fbb040;
      }
      
      .tag-accurate {
        background: #f0fff4;
        color: #38a169;
        border: 1px solid #68d391;
      }
      
      .tag-ai {
        background: #faf5ff;
        color: #805ad5;
        border: 1px solid #b794f6;
      }
      
      .tag-audio {
        background: #e6fffa;
        color: #319795;
        border: 1px solid #4fd1c7;
      }
      
      .transcript-status {
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 15px;
        font-size: 14px;
      }
      
      .transcript-status.loading {
        background: #e3f2fd;
        color: #1976d2;
      }
      
      .transcript-status.success {
        background: #e8f5e9;
        color: #388e3c;
      }
      
      .transcript-status.error {
        background: #ffebee;
        color: #c62828;
      }
      
      .transcript-content {
        margin-bottom: 15px;
      }
      
      /* ✅ SIMPLIFIED: Only reader mode styles needed */
      .transcript-reader-container {
        margin-top: 10px;
      }
      
      /* ✅ NEW: AI Polish button styling */
      .ai-polish-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        margin: 10px 0;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      }
      
      .ai-polish-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      
      .ai-polish-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
      }
      
      .ai-polish-btn svg {
        flex-shrink: 0;
        animation: sparkle 2s ease-in-out infinite;
      }
      
      @keyframes sparkle {
        0%, 100% { transform: scale(1) rotate(0deg); }
        50% { transform: scale(1.1) rotate(5deg); }
      }
      
      /* ✅ NEW: Whisper info styling */
      .whisper-info {
        background: #f0f8ff;
        border: 1px solid #b6d7ff;
        border-radius: 4px;
        padding: 8px 12px;
        font-size: 12px;
        color: #0066cc;
        margin-top: 8px;
      }
      
      .whisper-info strong {
        color: #004499;
      }
      
      .test-audio-btn {
        background: #4f46e5;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-top: 8px;
      }
      
      .test-audio-btn:hover:not(:disabled) {
        background: #4338ca;
        transform: translateY(-1px);
      }
      
      .test-audio-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
      }
      
      /* ✅ NEW: Audio quality indicator styles */
      .audio-quality-indicator {
        margin-top: 10px;
        padding: 8px;
        border-radius: 4px;
        background: #f8f9fa;
        border: 1px solid #e9ecef;
      }
      
      .quality-bar {
        height: 4px;
        border-radius: 2px;
        margin-bottom: 4px;
        transition: all 0.3s ease;
      }
      
      .quality-bar.quality-excellent {
        background: linear-gradient(to right, #22c55e, #16a34a);
        width: 100%;
      }
      
      .quality-bar.quality-moderate {
        background: linear-gradient(to right, #f59e0b, #d97706);
        width: 60%;
      }
      
      .quality-bar.quality-poor {
        background: linear-gradient(to right, #ef4444, #dc2626);
        width: 30%;
      }
      
      .quality-text {
        font-size: 11px;
        font-weight: 500;
        color: #374151;
      }
      
      /* ✅ NEW: Live audio monitor styles */
      .live-audio-monitor {
        background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
        color: white;
        padding: 12px;
        border-radius: 6px;
        margin: 10px 0;
        border: 1px solid #2563eb;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      }
      
      .monitor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 600;
        font-size: 13px;
        margin-bottom: 8px;
      }
      
      .monitor-level-bar {
        width: 100px;
        height: 6px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        overflow: hidden;
        position: relative;
      }
      
      .monitor-level-bar::after {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        background: linear-gradient(to right, #ef4444, #f59e0b, #22c55e);
        border-radius: 3px;
        width: 0%;
        transition: width 0.3s ease;
      }
      
      .monitor-text {
        font-size: 11px;
        opacity: 0.9;
        font-weight: 400;
      }
      
      /* ✅ NEW: Whisper timing controls styles */
      .whisper-timing-controls h5 {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .whisper-timing-controls select {
        width: 100%;
        padding: 4px 8px;
        border: 1px solid #cbd5e0;
        border-radius: 4px;
        background: white;
        font-size: 12px;
        color: #374151;
        cursor: pointer;
      }
      
      .whisper-timing-controls select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }
      
      .whisper-timing-controls input[type="number"] {
        width: 100%;
        padding: 4px 8px;
        border: 1px solid #cbd5e0;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .whisper-timing-controls input[type="number"]:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }
      
      /* ✅ NEW: Timing feedback styles */
      .timing-feedback {
        animation: fadeIn 0.3s ease-in;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-2px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      /* ✅ NEW: Two-column layout for options */
      .options-layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-top: 15px;
      }
      
      @media (max-width: 768px) {
        .options-layout {
          grid-template-columns: 1fr;
          gap: 15px;
        }
      }
      
      /* ✅ LEFT SIDE: AI Settings styling */
      .ai-settings-section {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
      }
      
      .ai-settings-section h4 {
        margin: 0 0 15px 0;
        color: #374151;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .settings-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .setting-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        transition: all 0.2s ease;
        cursor: pointer;
      }
      
      .setting-item:hover {
        border-color: #3b82f6;
        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
      }
      
      .setting-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        color: #374151;
      }
      
      .setting-icon {
        font-size: 16px;
      }
      
      .setting-title {
        font-size: 13px;
      }
      
      .setting-description {
        font-size: 11px;
        color: #6b7280;
        margin-top: 2px;
      }
      
      .setting-item input[type="checkbox"] {
        align-self: flex-start;
        margin: 4px 0;
      }
      
      .setting-item input[type="number"] {
        padding: 4px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        width: 80px;
      }
      
      /* ✅ RIGHT SIDE: Transcription method styling */
      .transcription-method-section {
        background: #fefefe;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
      }
      
      .transcription-method-section h4 {
        margin: 0 0 15px 0;
        color: #374151;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      /* ✅ NEW: Enhanced Captured Sentences Styling */
      .captured-sentences-container {
        margin: 20px 0;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        border: 1px solid #e9ecef;
        overflow: hidden;
      }
      
      .captured-viewer-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .captured-title-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .captured-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
      }
      
      .captured-stats {
        font-size: 12px;
        opacity: 0.9;
      }
      
      .captured-actions .export-captured-btn {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }
      
      .captured-actions .export-captured-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
      }
      
      .captured-table-container {
        padding: 0;
      }
      
      .captured-sentences {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      
      .captured-sentences thead tr {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      }
      
      .captured-sentences th {
        padding: 14px 16px;
        font-weight: 600;
        color: #495057;
        text-align: left;
        border-bottom: 2px solid #dee2e6;
        font-size: 13px;
        vertical-align: middle;
      }
      
      .captured-sentences th svg {
        margin-right: 6px;
        vertical-align: text-bottom;
      }
      
      .time-header {
        width: 120px;
      }
      
      .text-header {
        width: auto;
      }
      
      .actions-header {
        width: 160px;
      }
      
      .captured-sentences tbody tr {
        border-bottom: 1px solid #e9ecef;
        transition: all 0.2s ease;
      }
      
      .captured-sentences tbody tr:hover {
        background-color: #f8f9fa;
      }
      
      .captured-sentences td {
        padding: 12px 16px;
        vertical-align: top;
      }
      
      .timestamp-btn {
        background: #e3f2fd;
        border: 1px solid #2196f3;
        color: #1976d2;
        padding: 6px 10px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-block;
      }
      
      .timestamp-btn:hover {
        background: #bbdefb;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(33, 150, 243, 0.2);
      }
      
      .clean-text {
        font-size: 14px;
        line-height: 1.5;
        color: #333;
        margin: 0;
      }
      
      .actions-cell {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      
      .capture-sentence-btn,
      .edit-text-btn,
      .delete-row-btn {
        border: none;
        padding: 8px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .capture-sentence-btn {
        background: #ff9800;
        color: white;
        title: "Analyze with AI";
      }
      
      .capture-sentence-btn:hover {
        background: #f57c00;
        transform: translateY(-1px);
      }
      
      .edit-text-btn {
        background: #4caf50;
        color: white;
      }
      
      .edit-text-btn:hover {
        background: #388e3c;
        transform: translateY(-1px);
      }
      
      .delete-row-btn {
        background: #f44336;
        color: white;
      }
      
      .delete-row-btn:hover {
        background: #d32f2f;
        transform: translateY(-1px);
      }
      
      .captured-empty-state {
        padding: 60px 20px;
        text-align: center;
        color: #6c757d;
      }
      
      .captured-empty-state .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      
      .captured-empty-state .empty-message {
        font-size: 18px;
        font-weight: 500;
        margin: 0 0 8px 0;
        color: #495057;
      }
      
      .captured-empty-state .empty-hint {
        font-size: 14px;
        margin: 0;
        opacity: 0.8;
      }
    `;
    document.head.appendChild(style);
  }

  fixIncompleteSegments(text) {
    // Fix common incomplete segment patterns
    return text
      // Fix "where it's like come you" -> "where it's like, come on, you"
      .replace(/\b(where|what|how)\s+(it's|that's|this)\s+like\s+(\w+)\s+(you|we|they)\b/gi, 
        (match, question, pronoun, word, subject) => {
          // Try to make sense of fragmented thoughts
          if (word === 'come') {
            return `${question} ${pronoun} like, come on, ${subject}`;
          }
          return `${question} ${pronoun} like ${word}, ${subject}`;
        })
      // Fix "meaningful revenue meaningful" -> "meaningful revenue"
      .replace(/\b(\w+)\s+(\w+)\s+\1\b/gi, '$1 $2')
      // Fix other common auto-generated errors
      .replace(/\b(the|a|an)\s+(the|a|an)\b/gi, '$1')
      .replace(/\b(is|are|was|were)\s+(is|are|was|were)\b/gi, '$1')
      .replace(/\b(and|or|but)\s+(and|or|but)\b/gi, '$1');
  }

  mergeShortSentences(sentences) {
    const merged = [];
    
    for (let i = 0; i < sentences.length; i++) {
      const current = sentences[i];
      const next = sentences[i + 1];
      
      // If current sentence is very short and next exists, merge them
      if (current.split(' ').length <= 4 && next && next.split(' ').length <= 15) {
        merged.push(current + ' ' + next);
        i++; // Skip next since we merged it
      } else {
        merged.push(current);
      }
    }
    
    return merged;
  }

  createYouTubeLink(timeInSeconds) {
    // Helper to create YouTube timestamp links
    const videoId = this.getVideoIdFromPage();
    if (videoId) {
      return `https://youtube.com/watch?v=${videoId}&t=${Math.floor(timeInSeconds)}s`;
    }
    return '#';
  }

  getVideoIdFromPage() {
    // Extract video ID from current page or extension context
    const url = window.location.href;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  hasAutoGeneratedMarkers(segments) {
    // Check if segments have auto-generated markers
    return segments.some(segment => 
      segment.autoGenerated || 
      segment.streamReconstructed ||
      (segment.text && segment.text.length > 100 && !segment.text.includes('.'))
    );
  }

  masterCleanupSegments(segments) {
    // Master cleanup function for final processing (mirror of hybrid script function)
    console.log('🧹 Running master cleanup on', segments.length, 'segments');
    
    if (!segments || segments.length === 0) return [];
    
    // Step 1: Enhanced text cleaning for each segment
    let cleaned = segments.map(segment => {
      let cleanedText = segment.text || '';
      
      // Normalize spaces and fix word merging
      cleanedText = cleanedText
        .replace(/\s+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Fix common merged patterns
        .replace(/\b(\w+)(month|year|day|week|time|where|when|what|how|this|that|like|once)\b/gi, '$1 $2')
        .replace(/\b(once|the|a|an|is|are|was|were|and|or|but|so|then|now)(\w+)\b/gi, '$1 $2')
        // Remove immediate word repetitions
        .replace(/\b(\w+)\s+\1\b/g, '$1')
        .replace(/\b(\w{2,})\s+\1\s+\1\b/g, '$1')
        .trim();
      
      // Remove phrase repetitions within the segment
      cleanedText = this.removePhraseRepetitions(cleanedText);
      
      return {
        ...segment,
        text: cleanedText
      };
    }).filter(segment => segment.text && segment.text.length > 5);
    
    // Step 2: Remove duplicates based on text similarity
    const unique = [];
    for (const segment of cleaned) {
      const isDuplicate = unique.some(existing => 
        this.calculateTextSimilarity(segment.text.toLowerCase(), existing.text.toLowerCase()) > 0.85
      );
      if (!isDuplicate) {
        unique.push(segment);
      }
    }
    
    // Step 3: Merge very short segments with adjacent ones
    const merged = [];
    for (let i = 0; i < unique.length; i++) {
      const current = unique[i];
      const next = unique[i + 1];
      
      if (current.text.split(' ').length <= 3 && next && 
          Math.abs(next.start - current.end) < 5) {
        // Merge short segment with next
        merged.push({
          ...current,
          text: current.text + ' ' + next.text,
          end: next.end,
          duration: next.end - current.start
        });
        i++; // Skip next since we merged it
      } else {
        merged.push(current);
      }
    }
    
    console.log(`📊 Master cleanup: ${segments.length} → ${cleaned.length} → ${unique.length} → ${merged.length}`);
    return merged;
  }

  calculateTextSimilarity(text1, text2) {
    // Calculate text similarity using word overlap
    const words1 = text1.split(/\s+/).filter(w => w.length > 2);
    const words2 = text2.split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(w => set2.has(w)));
    
    return intersection.size / Math.max(set1.size, set2.size);
  }

  removePhraseRepetitions(text) {
    // Remove phrase-level repetitions within a single segment
    const words = text.split(/\s+/);
    if (words.length < 6) return text;
    
    // Check for repeated phrases of various lengths
    for (let phraseLen = 3; phraseLen <= Math.floor(words.length / 2); phraseLen++) {
      for (let i = 0; i <= words.length - phraseLen * 2; i++) {
        const phrase1 = words.slice(i, i + phraseLen).join(' ');
        const phrase2 = words.slice(i + phraseLen, i + phraseLen * 2).join(' ');
        
        if (phrase1.toLowerCase() === phrase2.toLowerCase()) {
          // Found repetition - remove the second occurrence
          const before = words.slice(0, i + phraseLen);
          const after = words.slice(i + phraseLen * 2);
          console.log('🗑️ Removed phrase repetition:', phrase1);
          return [...before, ...after].join(' ');
        }
      }
    }
    
    return text;
  }

  updateTranscriptData(newTranscriptData) {
    // ✅ NEW: Method to update transcript data and re-render
    console.log('🔄 Updating transcript data with', newTranscriptData.length, 'segments');
    this.transcriptData = newTranscriptData;
    this.renderTranscript();
    this.updateStats();
  }

  // ✅ NEW: Method to refresh platform detection and reinitialize UI
  async refreshPlatform() {
    console.log('🔄 Refreshing platform detection...');
    const oldPlatform = this.currentPlatform;
    this.currentPlatform = await this.detectPlatform();
    
    if (oldPlatform !== this.currentPlatform) {
      console.log(`🔄 Platform changed from ${oldPlatform} to ${this.currentPlatform}, reinitializing UI...`);
      this.init();
    } else {
      console.log(`✅ Platform unchanged (${this.currentPlatform})`);
    }
    
    return this.currentPlatform;
  }

  // ✅ DEBUG: Method to debug platform detection and test Netflix timestamp functionality
  async debugPlatformDetection() {
    console.log('🔍 === DEBUG PLATFORM DETECTION ===');
    
    try {
      // Check current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('🔍 Active tabs found:', tabs.length);
      
      if (tabs[0]) {
        const tab = tabs[0];
        console.log('🔍 Current tab URL:', tab.url);
        console.log('🔍 Current tab title:', tab.title);
        console.log('🔍 URL includes netflix.com:', tab.url.includes('netflix.com'));
        console.log('🔍 URL includes youtube.com:', tab.url.includes('youtube.com'));
        
        // ✅ NEW: Test Netflix timestamp functionality
        if (tab.url.includes('netflix.com')) {
          console.log('🎭 === TESTING NETFLIX TIMESTAMP FUNCTIONALITY ===');
          
          // Test if current URL has timestamp
          const hasTimestamp = tab.url.includes('#t=') || tab.url.includes('&t=');
          console.log('🔍 Current URL has timestamp:', hasTimestamp);
          
          // Extract base URL and test timestamp format
          const baseUrl = tab.url.split('#')[0].split('&t=')[0];
          const testTimestamp = '30s';
          const testUrl = `${baseUrl}#t=${testTimestamp}`;
          console.log('🔍 Base URL:', baseUrl);
          console.log('🔍 Test timestamp URL:', testUrl);
          
          // Test if we can get current video time from Netflix
          try {
            const result = await chrome.tabs.sendMessage(tab.id, { action: 'getCurrentVideoTime' });
            console.log('🔍 Current Netflix video time:', result);
          } catch (error) {
            console.log('🔍 Cannot get Netflix video time:', error.message);
          }
          
          console.log('🎭 === Netflix URL Analysis ===');
          console.log('🔍 Netflix timestamp URLs are likely NOT functional for seeking');
          console.log('🔍 Netflix differs from YouTube - cannot replay specific moments reliably');
          console.log('🔍 Netflix learning should focus on: content capture, vocabulary, AI analysis');
          console.log('🔍 NOT on: timestamp navigation, replay functionality');
        }
      } else {
        console.log('❌ No active tab found');
      }
      
      // Check current platform value
      console.log('🔍 Current platform value:', this.currentPlatform);
      
      // Test platform detection
      const detectedPlatform = await this.detectPlatform();
      console.log('🔍 Fresh detection result:', detectedPlatform);
      
      // Check if Capture button exists
      const captureBtn = this.container.querySelector('.capture-subtitle-btn');
      console.log('🔍 Capture button in DOM:', !!captureBtn);
      
      // Check all buttons
      const allButtons = this.container.querySelectorAll('button');
      console.log('🔍 All buttons found:', allButtons.length);
      allButtons.forEach((btn, i) => {
        console.log(`🔍 Button ${i}:`, btn.className, btn.textContent.trim());
      });
      
    } catch (error) {
      console.error('❌ Debug platform detection error:', error);
    }
    
    console.log('🔍 === END DEBUG ===');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranscriptRestructurer;
} else {
  // Make available globally in browser
  window.TranscriptRestructurer = TranscriptRestructurer;
}