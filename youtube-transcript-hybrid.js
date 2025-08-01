// Hybrid YouTube Transcript Content Script
// Combines real-time caption monitoring with API attempts

(function() {
  'use strict';

  console.log('🎬 HYBRID YouTube transcript content script loaded');

  // Caption collection state with Whisper transcription
  let captionCollection = {
    segments: [],
    isCollecting: false,
    startTime: 0,
    lastCaptionTime: 0,
    currentVideoTime: 0,
    lastCollectedTimestamp: 0,
    timeSegmentThreshold: 10, // Create new segment if time gap > 10s (user jumped)
    chunkDurationThreshold: 45, // Seconds - create new chunk every 45 seconds
    currentChunkStartTime: 0,
    currentChunkStartTimestamp: null,
    chunkCounter: 0,
    // ✅ NEW: Whisper-based transcription system
    whisper: {
      audioChunks: [],
      mediaRecorder: null,
      audioStream: null,
      isRecording: false,
      chunkStartTime: 0,
      chunkDuration: 8, // ✅ SAFE: 8-second chunks for quality without freezing
      chunkGap: 3, // ✅ SAFE: 3-second gap for memory cleanup and stability
      pendingTranscriptions: new Map(), // Track ongoing transcriptions
      lastTranscriptionTime: 0,
      initializationAttempted: false, // Track if we've tried to initialize
      processedTimeRanges: [], // ✅ NEW: Track processed time ranges to avoid duplicates
      languageOverride: 'auto', // ✅ NEW: User language override
      memoryCleanupTimer: null // ✅ CRITICAL: Periodic memory cleanup timer
    }
  };

  // Listen for requests from extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🎬 HYBRID transcript content script received message:', request);
    
    // Handle ping test
    if (request.action === 'ping') {
      console.log('🏓 Ping received, sending pong...');
      sendResponse({ 
        pong: true, 
        timestamp: Date.now(), 
        url: window.location.href,
        videoId: extractVideoId(),
        hasPlayer: !!document.querySelector('#movie_player'),
        isCollecting: captionCollection ? captionCollection.isCollecting : false,
        collectedSegments: captionCollection ? captionCollection.segments.length : 0
      });
      return false;
    }
    
    // Handle transcript requests
    if (request.action === 'getYouTubeTranscript') {
      console.log('🚀 HYBRID Processing transcript request...');
      getHybridTranscript().then(response => {
        console.log('📤 HYBRID Sending transcript response:', response);
        sendResponse(response);
      }).catch(error => {
        console.error('❌ HYBRID Error in getTranscript:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }

    // Handle start collection request
    if (request.action === 'startCaptionCollection') {
      const chunkDuration = request.chunkDuration || 45; // Default to 45 seconds
      const subtitleMode = request.subtitleMode || 'with-subtitles'; // Default to creator subtitles
      
      // ✅ NEW: Handle Whisper timing settings
      const whisperSettings = request.whisperSettings || {
        chunkDuration: 8,
        chunkGap: 3,
        sentenceGrouping: 'medium'
      };
      
      console.log('🎯 Starting caption collection with settings:', {
        subtitleMode,
        chunkDuration,
        whisperSettings
      });
      
      // ✅ NEW: Start collection with enhanced settings
      startCaptionCollection(chunkDuration, subtitleMode, whisperSettings);
      
      sendResponse({ 
        success: true, 
        message: `Caption collection started in ${subtitleMode} mode`,
        captionType: subtitleMode
      });
      return false;
    }

    // Handle stop collection request
    if (request.action === 'stopCaptionCollection') {
      const result = stopCaptionCollection();
      sendResponse({ success: true, segments: result.segments, duration: result.duration });
      return false;
    }

    // Handle seek to timestamp request
    if (request.action === 'seekToTime') {
      console.log('⏩ HYBRID Seeking to time:', request.time);
      
      // ✅ FIX: More robust YouTube player seeking with latest methods
      console.log('🔍 HYBRID Looking for YouTube player...');
      
      let seekSuccess = false;
      
      // Method 1: Direct video element manipulation (most reliable)
      const videos = document.querySelectorAll('video');
      console.log('📺 Found', videos.length, 'video elements');
      
      for (const video of videos) {
        if (video.duration && video.duration > 0) {
          try {
            console.log('🎯 Attempting to set currentTime to', request.time, 'on video element');
            video.currentTime = request.time;
            seekSuccess = true;
            console.log('✅ HYBRID Video element seek successful');
            break;
          } catch (e) {
            console.log('❌ Video element seek failed:', e.message);
          }
        }
      }
      
      // Method 2: Try YouTube player object methods
      if (!seekSuccess) {
        const player = document.querySelector('#movie_player');
        if (player) {
          console.log('🎮 Found movie_player, trying seekTo...');
          if (typeof player.seekTo === 'function') {
            try {
              player.seekTo(request.time, true);
              seekSuccess = true;
              console.log('✅ HYBRID movie_player.seekTo successful');
            } catch (e) {
              console.log('❌ movie_player.seekTo failed:', e.message);
            }
          }
        }
      }
      
      // Method 3: Try window.ytplayer
      if (!seekSuccess && window.ytplayer) {
        console.log('🌐 Trying window.ytplayer...');
        try {
          if (typeof window.ytplayer.seekTo === 'function') {
            window.ytplayer.seekTo(request.time);
            seekSuccess = true;
            console.log('✅ HYBRID window.ytplayer.seekTo successful');
          }
        } catch (e) {
          console.log('❌ window.ytplayer.seekTo failed:', e.message);
        }
      }
      
      // Method 4: Try dispatching keyboard events (space + arrow keys simulation)
      if (!seekSuccess) {
        console.log('⌨️ Trying keyboard simulation fallback...');
        try {
          // Focus the video player first
          const playerContainer = document.querySelector('#movie_player, .html5-video-player');
          if (playerContainer) {
            playerContainer.focus();
            
            // Create a custom seeking approach by simulating time updates
            const video = playerContainer.querySelector('video');
            if (video) {
              // Pause, seek, then resume
              const wasPlaying = !video.paused;
              video.pause();
              video.currentTime = request.time;
              
              if (wasPlaying) {
                setTimeout(() => video.play(), 100);
              }
              
              seekSuccess = true;
              console.log('✅ HYBRID Keyboard simulation successful');
            }
          }
        } catch (e) {
          console.log('❌ Keyboard simulation failed:', e.message);
        }
      }
      
      if (seekSuccess) {
        sendResponse({ success: true, time: request.time });
      } else {
        console.error('❌ HYBRID All seek methods failed');
        sendResponse({ success: false, error: 'All seek methods failed - YouTube player may be protected' });
      }
      return false;
    }

    // Handle video metadata request
    if (request.action === 'getVideoMetadata') {
      console.log('📺 Getting video metadata...');
      const metadata = collectVideoMetadata();
      sendResponse(metadata);
      return false;
    }
  });

  function extractVideoId() {
    const url = window.location.href;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  function collectVideoMetadata() {
    // ✅ SIMPLIFIED: Immediate metadata collection to prevent crashes
    const videoId = extractVideoId();
    
    // Extract title - simplified selectors to prevent crashes
    let title = null;
    const titleSelectors = [
      'h1.ytd-video-primary-info-renderer',
      'meta[property="og:title"]',
      'title'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (element.tagName === 'META') {
          title = element.getAttribute('content');
        } else {
          title = element.textContent?.trim();
        }
        if (title && title !== 'YouTube' && !title.includes('undefined')) {
          break;
        }
      }
    }
    
    // Extract channel name - simplified to prevent crashes
    let channel = null;
    const channelSelectors = [
      'ytd-channel-name#channel-name a',
      '.ytd-channel-name a'
    ];
    
    for (const selector of channelSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (element.tagName === 'META') {
          channel = element.getAttribute('content');
        } else if (element.textContent?.trim()) {
          channel = element.textContent.trim();
        }
        if (channel && channel !== 'Unknown Channel' && !channel.includes('undefined')) {
          break;
        }
      }
    }
    
    // Fallback: try to extract from page title
    if (!title || !channel) {
      const pageTitle = document.title;
      if (pageTitle && pageTitle.includes(' - YouTube')) {
        const parts = pageTitle.replace(' - YouTube', '').split(' - ');
        if (!title && parts.length > 0) {
          title = parts[0].trim();
        }
        if (!channel && parts.length > 1) {
          channel = parts[parts.length - 1].trim();
        }
      }
    }
    
    console.log('📺 Collected video metadata:', { 
      videoId, 
      title: title?.substring(0, 50), 
      channel
    });
    
    return {
      videoId: videoId,
      title: title || 'YouTube Video',
      channel: channel || 'Unknown Channel',
      url: window.location.href,
      timestamp: Date.now()
    };
  }

  async function getTranscriptFromPageData() {
    console.log('🔍 Searching for transcript data in page...');
    
    try {
      // Method 1: Check ytInitialData for transcript info
      if (window.ytInitialData) {
        const panels = window.ytInitialData?.engagementPanels || [];
        for (const panel of panels) {
          if (panel?.engagementPanelSectionListRenderer?.targetId === 'engagement-panel-searchable-transcript') {
            console.log('📝 Found transcript panel data in ytInitialData');
            // This indicates transcript exists but we need to fetch it
            break;
          }
        }
      }

      // Method 2: Try to intercept transcript network requests
      const videoId = extractVideoId();
      if (!videoId) return null;

      // Look for transcript in various page data locations
      const pageDataSources = [
        // YouTube's player response
        () => {
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const content = script.textContent || '';
            if (content.includes('captionTracks') && content.includes(videoId)) {
              const match = content.match(/var ytInitialPlayerResponse = ({.+?});/);
              if (match) {
                try {
                  const data = JSON.parse(match[1]);
                  return data?.captions?.playerCaptionsTracklistRenderer;
                } catch (e) {}
              }
            }
          }
          return null;
        },
        // Try window.ytplayer
        () => window.ytplayer?.config?.args?.raw_player_response?.captions?.playerCaptionsTracklistRenderer,
        // Try ytInitialPlayerResponse
        () => window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer
      ];

      for (const getSource of pageDataSources) {
        try {
          const captionData = getSource();
          if (captionData?.captionTracks) {
            console.log('🎯 Found caption data in page');
            
            // Get the best track
            const tracks = captionData.captionTracks;
            const track = tracks.find(t => t.vssId?.includes('.asr')) || tracks[0];
            
            if (track?.baseUrl) {
              // Fetch the actual transcript
              const transcript = await fetchTranscriptFromUrl(track.baseUrl);
              if (transcript && transcript.length > 0) {
                return transcript;
              }
            }
          }
        } catch (e) {
          continue;
        }
      }

      // Method 3: Try to get from API endpoint directly
      const apiTranscript = await tryDirectAPIFetch(videoId);
      if (apiTranscript && apiTranscript.length > 0) {
        return apiTranscript;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get transcript from page data:', error);
      return null;
    }
  }

  async function fetchTranscriptFromUrl(url) {
    console.log('📥 Fetching transcript from URL...');
    
    try {
      // Clean the URL and try different formats
      const baseUrl = url.split('&fmt=')[0];
      const formats = ['srv3', 'json3', 'vtt'];
      
      for (const fmt of formats) {
        const fetchUrl = `${baseUrl}&fmt=${fmt}`;
        console.log('🌐 Trying format:', fmt);
        
        const response = await fetch(fetchUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'text/xml, application/xml, application/json, text/vtt'
          }
        });
        
        if (response.ok) {
          const content = await response.text();
          if (content && content.length > 100) {
            console.log('✅ Got transcript content:', content.length, 'chars');
            
            // Parse based on format
            if (fmt === 'srv3' || !fmt) {
              return parseXMLTranscript(content);
            } else if (fmt === 'json3') {
              try {
                const json = JSON.parse(content);
                return parseJSONTranscript(json);
              } catch (e) {
                return parseXMLTranscript(content);
              }
            } else if (fmt === 'vtt') {
              return parseVTTTranscript(content);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Fetch transcript failed:', error);
    }
    
    return null;
  }

  async function tryDirectAPIFetch(videoId) {
    console.log('🌐 Trying direct API fetch for video:', videoId);
    
    // Get current page info for auth
    const scripts = document.querySelectorAll('script');
    let apiKey = null;
    
    for (const script of scripts) {
      const content = script.textContent || '';
      const keyMatch = content.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      if (keyMatch) {
        apiKey = keyMatch[1];
        break;
      }
    }
    
    if (!apiKey) {
      console.log('❌ No API key found');
      return null;
    }
    
    try {
      const response = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.0'
            }
          },
          params: videoId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Parse transcript from response
        if (data?.actions) {
          // Extract transcript segments
          console.log('✅ Got transcript from API');
          return parseYouTubeAPIResponse(data);
        }
      }
    } catch (error) {
      console.error('❌ Direct API fetch failed:', error);
    }
    
    return null;
  }

  function parseYouTubeAPIResponse(data) {
    // Extract transcript segments from YouTube API response
    const segments = [];
    
    try {
      const transcriptData = data?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer;
      if (transcriptData?.body?.transcriptSegmentListRenderer?.initialSegments) {
        const initialSegments = transcriptData.body.transcriptSegmentListRenderer.initialSegments;
        
        for (const segment of initialSegments) {
          if (segment.transcriptSegmentRenderer) {
            const renderer = segment.transcriptSegmentRenderer;
            const startMs = parseInt(renderer.startMs);
            const endMs = parseInt(renderer.endMs);
            const text = renderer.snippet?.runs?.map(r => r.text).join('') || '';
            
            if (text) {
              segments.push({
                start: startMs / 1000,
                end: endMs / 1000,
                duration: (endMs - startMs) / 1000,
                text: text.trim()
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('❌ Failed to parse API response:', e);
    }
    
    return segments;
  }

  async function getHybridTranscript() {
    console.log('🔍 HYBRID Starting transcript extraction...');
    
    try {
      const videoId = extractVideoId();
      if (!videoId) {
        throw new Error('Could not extract video ID');
      }
      
      console.log('📹 HYBRID Video ID:', videoId);

      // Method 1: Direct transcript download (NEW - preferred method)
      let transcript = await downloadCompleteTranscript(videoId);
      if (transcript && transcript.length > 0) {
        console.log('✅ HYBRID Complete transcript downloaded:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'directDownload' };
      }

      // Method 2: Enhanced transcript panel approach
      transcript = await tryTranscriptPanel();
      if (transcript && transcript.length > 0) {
        console.log('✅ HYBRID Transcript via panel:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'transcriptPanel' };
      }

      // Method 3: Use collected captions only if user explicitly collected them
      if (captionCollection && captionCollection.segments.length > 0 && captionCollection.isCollecting === false) {
        console.log('✅ HYBRID Using pre-collected captions:', captionCollection.segments.length, 'segments');
        return { 
          success: true, 
          transcript: [...captionCollection.segments], 
          videoId, 
          method: 'userCollection',
          collectionDuration: (Date.now() - captionCollection.startTime) / 1000
        };
      }

      // Method 4: Try alternative transcript access methods
      transcript = await tryAlternativeTranscriptMethods(videoId);
      if (transcript && transcript.length > 0) {
        console.log('✅ HYBRID Alternative method:', transcript.length, 'segments');
        return { success: true, transcript, videoId, method: 'alternativeMethod' };
      }

      // Method 5: As last resort, try the metadata but with a better message
      const metadataTranscript = await tryVideoMetadata();
      if (metadataTranscript && metadataTranscript.length > 0) {
        console.log('⚠️ Only metadata available - no real captions found');
        return { 
          success: true, 
          transcript: metadataTranscript, 
          videoId, 
          method: 'metadataOnly',
          warning: 'No captions available. Try: 1) Enable CC button on video, 2) Use "Collect" feature while playing, 3) Open YouTube transcript panel manually.'
        };
      }

      throw new Error('No transcript available. Try: 1) Enable CC on video, 2) Use "Collect" button while playing video, 3) Check if video has captions at all.');
      
    } catch (error) {
      console.error('❌ HYBRID transcript extraction failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function tryTranscriptPanel() {
    console.log('🔍 HYBRID Method 1: Direct transcript download attempt...');
    
    try {
      // First try to get transcript data from page without UI interaction
      const transcriptData = await getTranscriptFromPageData();
      if (transcriptData && transcriptData.length > 0) {
        console.log('✅ Got transcript from page data:', transcriptData.length, 'segments');
        return transcriptData;
      }
      
      // If that fails, try the panel approach
      console.log('📋 Trying transcript panel UI...');
      let transcriptPanel = document.querySelector('ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
      
      if (!transcriptPanel) {
        // Try to open transcript panel with better selectors
        const expandButton = document.querySelector('#primary #expand, #description #expand, ytd-text-inline-expander #expand');
        if (expandButton) {
          console.log('🔘 HYBRID Clicking expand button...');
          expandButton.click();
          await sleep(1000);
        }
        
        // Look for show transcript button
        const transcriptButtons = Array.from(document.querySelectorAll('button, yt-button-shape')).filter(el => {
          const text = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
          return text.includes('transcript') || text.includes('文字記錄') || text.includes('字幕');
        });
        
        if (transcriptButtons.length > 0) {
          console.log('📝 HYBRID Found', transcriptButtons.length, 'potential transcript buttons');
          for (const btn of transcriptButtons) {
            try {
              btn.click();
              await sleep(2000);
              
              // Check if transcript panel opened
              transcriptPanel = document.querySelector('ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
              if (transcriptPanel) break;
            } catch (e) {
              continue;
            }
          }
        }
      }
      
      if (transcriptPanel) {
        // Wait a bit for segments to load
        await sleep(1500);
        
        // Extract segments from transcript panel - try multiple selectors
        const segmentSelectors = [
          'ytd-transcript-segment-renderer',
          'ytd-transcript-body-renderer [role="button"]',
          '.ytd-transcript-segment-list-renderer',
          '#segments-container ytd-transcript-segment-renderer',
          'tp-yt-paper-button.ytd-transcript-segment-renderer',
          '[class*="cue-group"]', // For newer YouTube UI
          '.ytd-transcript-body-renderer .segment'
        ];
        
        let segments = [];
        for (const selector of segmentSelectors) {
          segments = transcriptPanel.querySelectorAll(selector);
          if (segments.length > 0) {
            console.log('📝 HYBRID Found', segments.length, 'segments with selector:', selector);
            break;
          }
        }
        
        if (segments.length > 0) {
          const transcript = extractFromPanelSegments(segments);
          if (transcript && transcript.length > 10) { // Ensure we have substantial content
            return transcript;
          } else {
            console.log('⚠️ HYBRID Panel segments too few:', transcript?.length || 0);
          }
        } else {
          console.log('❌ HYBRID No segments found in transcript panel');
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ HYBRID Transcript panel method failed:', error);
      return null;
    }
  }

  function extractFromPanelSegments(segments) {
    const transcript = [];
    
    segments.forEach((segment, index) => {
      try {
        const timeElement = segment.querySelector('.segment-timestamp, [class*="timestamp"]');
        const textElement = segment.querySelector('.segment-text, [class*="text"]');
        
        let timeText = timeElement?.textContent?.trim() || '';
        let captionText = textElement?.textContent?.trim() || '';
        
        // Fallback: extract from full text
        if (!timeText || !captionText) {
          const fullText = segment.textContent?.trim() || '';
          const timeMatch = fullText.match(/(\d{1,2}):(\d{2})/);
          
          if (timeMatch) {
            timeText = timeMatch[0];
            captionText = fullText.replace(timeMatch[0], '').trim();
          }
        }
        
        if (timeText && captionText) {
          const startTime = parseTimestamp(timeText);
          if (!isNaN(startTime)) {
            transcript.push({
              start: startTime,
              end: startTime + 3,
              duration: 3,
              text: captionText
            });
          }
        }
      } catch (e) {
        console.log(`❌ HYBRID Error processing segment ${index}:`, e);
      }
    });
    
    return transcript;
  }

  async function smartCaptionCollection() {
    console.log('🔍 HYBRID Method 2: Smart caption collection...');
    
    try {
      // Enable captions if not already enabled
      const ccButton = document.querySelector('.ytp-subtitles-button');
      if (ccButton && ccButton.getAttribute('aria-pressed') !== 'true') {
        console.log('🔘 HYBRID Enabling captions...');
        ccButton.click();
        await sleep(2000);
      }
      
      // Start monitoring captions for a short period
      console.log('📡 HYBRID Starting caption monitoring...');
      const monitoringTime = 10000; // 10 seconds
      const collectedCaptions = await monitorCaptionsForPeriod(monitoringTime);
      
      if (collectedCaptions.length > 0) {
        console.log('📝 HYBRID Collected', collectedCaptions.length, 'caption segments');
        return collectedCaptions;
      }
      
      return null;
    } catch (error) {
      console.error('❌ HYBRID Smart collection failed:', error);
      return null;
    }
  }

  async function monitorCaptionsForPeriod(duration) {
    return new Promise((resolve) => {
      const captions = [];
      const startTime = Date.now();
      let lastCaptionText = '';
      
      const monitor = setInterval(() => {
        const captionElements = document.querySelectorAll('.ytp-caption-segment, .captions-text, .caption-visual-line');
        
        if (captionElements.length > 0) {
          const currentText = Array.from(captionElements)
            .map(el => el.textContent?.trim())
            .filter(text => text && text !== lastCaptionText)
            .join(' ');
          
          if (currentText && currentText !== lastCaptionText) {
            const player = document.querySelector('#movie_player');
            const currentTime = player && player.getCurrentTime ? player.getCurrentTime() : 0;
            
            captions.push({
              start: currentTime,
              end: currentTime + 3,
              duration: 3,
              text: currentText,
              timestamp: Date.now()
            });
            
            lastCaptionText = currentText;
            console.log('📝 HYBRID Captured caption:', currentText.substring(0, 50) + '...');
          }
        }
        
        // Stop monitoring after duration
        if (Date.now() - startTime > duration) {
          clearInterval(monitor);
          resolve(captions);
        }
      }, 500); // Check every 500ms
    });
  }

  async function getCurrentCaptions() {
    console.log('🔍 HYBRID Method 3: Getting available captions with quick scan...');
    
    try {
      // Enable captions if needed
      const ccButton = document.querySelector('.ytp-subtitles-button');
      if (ccButton && ccButton.getAttribute('aria-pressed') !== 'true') {
        ccButton.click();
        await sleep(2000);
      }
      
      // Try to collect captions by quickly scanning through video
      const player = document.querySelector('#movie_player');
      if (!player || !player.getDuration) {
        return null;
      }
      
      const duration = player.getDuration();
      const segments = [];
      const scanInterval = 10; // Scan every 10 seconds
      
      console.log('🔄 HYBRID Quick scanning video for captions...');
      
      // Save current time
      const originalTime = player.getCurrentTime();
      
      // Scan through video at intervals
      for (let time = 0; time < Math.min(duration, 60); time += scanInterval) {
        player.seekTo(time);
        await sleep(1000); // Wait for captions to load
        
        const captionElements = document.querySelectorAll('.ytp-caption-segment, .captions-text, .caption-visual-line');
        const captionText = Array.from(captionElements)
          .map(el => el.textContent?.trim())
          .filter(text => text)
          .join(' ');
        
        if (captionText) {
          segments.push({
            start: time,
            end: time + scanInterval,
            duration: scanInterval,
            text: captionText
          });
          console.log(`📝 HYBRID Found caption at ${time}s:`, captionText.substring(0, 50) + '...');
        }
      }
      
      // Restore original time
      player.seekTo(originalTime);
      
      if (segments.length > 5) {
        console.log('✅ HYBRID Quick scan found', segments.length, 'caption segments');
        return segments;
      }
      
      return null;
    } catch (error) {
      console.error('❌ HYBRID Current captions failed:', error);
      return null;
    }
  }

  function detectCaptionType() {
    // ✅ NEW: Detect if captions are auto-generated or manual
    try {
      // Method 1: Check caption settings button for auto-generated indicators
      const settingsButton = document.querySelector('.ytp-subtitles-button, .ytp-settings-button');
      if (settingsButton) {
        // Look for auto-generated indicators in DOM
        const autoIndicators = document.querySelectorAll('[aria-label*="auto-generated"], [title*="auto-generated"], .caption-window .auto-generated');
        if (autoIndicators.length > 0) {
          return 'auto-generated';
        }
      }
      
      // Method 2: Sample current captions and analyze pattern
      const captionElements = document.querySelectorAll('.caption-window .ytp-caption-segment, .ytp-caption-segment, .captions-text');
      if (captionElements.length > 0) {
        const sampleTexts = Array.from(captionElements).slice(-3).map(el => el.textContent || '').filter(text => text.length > 10);
        
        if (sampleTexts.length >= 2) {
          // Check for auto-generated characteristics
          const characteristics = [
            // Long run-on sentences without proper punctuation
            sampleTexts.some(text => text.length > 100 && !text.includes('.')),
            // Missing capitalization at sentence starts
            sampleTexts.some(text => text.length > 20 && /^[a-z]/.test(text.trim())),
            // Overlap patterns between consecutive segments
            sampleTexts.length >= 2 && this.hasOverlapPattern(sampleTexts)
          ];
          
          if (characteristics.filter(Boolean).length >= 2) {
            return 'auto-generated';
          }
        }
      }
      
      // Method 3: Check video metadata for auto-caption indicator
      const videoMeta = document.querySelector('meta[property="og:description"], #description');
      if (videoMeta && videoMeta.content && videoMeta.content.toLowerCase().includes('auto-generated')) {
        return 'auto-generated';
      }
      
      return 'manual';
    } catch (error) {
      console.log('⚠️ Caption detection error:', error);
      return 'unknown'; // Default to manual collection method
    }
  }

  function hasOverlapPattern(texts) {
    // Check if consecutive caption segments have overlapping content
    for (let i = 1; i < texts.length; i++) {
      const current = texts[i].toLowerCase().trim();
      const previous = texts[i-1].toLowerCase().trim();
      
      // Look for significant word overlap
      const currentWords = current.split(' ');
      const previousWords = previous.split(' ');
      
      if (currentWords.length > 5 && previousWords.length > 5) {
        const lastThreeWords = previousWords.slice(-3).join(' ');
        if (current.includes(lastThreeWords)) {
          return true;
        }
      }
    }
    return false;
  }

  function startAutoGeneratedCaptionCollection(chunkDuration = 25) {
    console.log('🤖 Starting AUTO-GENERATED caption collection with', chunkDuration, 'second chunks');
    
    // Use larger chunks and different processing for auto-captions
    captionCollection.isCollecting = true;
    captionCollection.startTime = Date.now();
    captionCollection.chunkDurationThreshold = chunkDuration;
    captionCollection.autoGenerated = true; // Mark as auto-generated
    // Note: streamBuffer removed, using time-window system instead
    captionCollection.lastProcessedText = ''; // Track processed content
    
    console.log('✅ Auto-generated caption collection started');
  }

  async function processWhisperTimestamp(timestampInSeconds, extractedTimestamp, videoId, youtubeLink, isNewChunk) {
    const whisper = captionCollection.whisper;
    
    // ✅ FIX: Skip initialization check if user explicitly selected Whisper mode
    // (initialization should have been done when collection started)
    if (captionCollection.userSubtitleMode === 'without-subtitles') {
      console.log('🎙️ Processing timestamp in user-selected Whisper mode');
      
      // Ensure we have audio stream (should be initialized already)
      if (!whisper.audioStream) {
        console.log('⚠️ No audio stream available - Whisper may have failed to initialize');
        return;
      }
    } else {
      // Legacy logic for auto-detected captions
      if (!whisper.audioStream && !whisper.initializationAttempted) {
        console.log('🎙️ First auto-generated caption detected - initializing Whisper...');
        whisper.initializationAttempted = true;
        
        const whisperInitialized = await initializeAudioCapture();
        
        if (whisperInitialized) {
          console.log('✅ Whisper initialized successfully for auto-generated captions');
          startNewAudioChunk(timestampInSeconds, extractedTimestamp);
        } else {
          console.log('❌ Whisper initialization failed - using fallback processing for auto-generated captions');
          captionCollection.whisperFallback = true;
        }
      }
      
      // Check if we should use fallback processing instead of Whisper
      if (captionCollection.whisperFallback) {
        console.log('🔄 Using fallback auto-caption processing');
        return processAutoFallback(timestampInSeconds, extractedTimestamp, videoId, youtubeLink, isNewChunk);
      }
    }
    
    // Process timestamp for Whisper transcription
    console.log('🎙️ Whisper timestamp processing:', extractedTimestamp);
    
    // Check for significant time gap (user jumped)
    const timeGap = timestampInSeconds - captionCollection.lastCollectedTimestamp;
    const isSignificantGap = timeGap > captionCollection.timeSegmentThreshold;
    
    if (isSignificantGap && captionCollection.segments.length > 0 && whisper.isRecording) {
      console.log(`⏭️ Time gap detected (${Math.floor(timeGap)}s) - finalizing current chunk`);
      
      // Finalize current audio chunk
      finalizeCurrentAudioChunk(timestampInSeconds - timeGap);
      
      // Start new audio recording chunk after a brief delay
      setTimeout(() => {
        startNewAudioChunk(timestampInSeconds, extractedTimestamp);
      }, 100);
    } else if (!whisper.isRecording && whisper.audioStream) {
      // Start recording if not already recording
      startNewAudioChunk(timestampInSeconds, extractedTimestamp);
    }
    
    // Update last collected timestamp
    captionCollection.lastCollectedTimestamp = timestampInSeconds;
  }

  function processAutoFallback(timestampInSeconds, extractedTimestamp, videoId, youtubeLink, isNewChunk) {
    // ✅ FALLBACK: Process auto-generated captions with improved cleaning when Whisper fails
    console.log('🛠️ Fallback auto-caption processing:', extractedTimestamp);
    
    // Skip processing - let the caption text be handled by the main loop but don't create duplicates
    // Just update the timestamp tracking
    captionCollection.lastCollectedTimestamp = timestampInSeconds;
    
    // Since Whisper failed, we'll let the very next manual caption processing handle these
    // but mark them for special auto-caption cleaning
    console.log('⚠️ Auto-generated captions detected but Whisper unavailable - timestamps tracked only');
  }

  function detectStreamingBehavior(currentText) {
    // Auto-captions show cumulative text patterns (multi-language support)
    const tw = captionCollection.timeWindow;
    
    if (!tw.lastFullStream) {
      tw.lastFullStream = currentText;
      // Check for typical auto-caption indicators (language-agnostic)
      const hasRepetition = detectRepetitionMultiLang(currentText);
      const hasNoProperPunctuation = !hasEndPunctuation(currentText);
      return hasRepetition && hasNoProperPunctuation;
    }
    
    // Language-agnostic cumulative detection
    const currentNorm = normalizeForComparison(currentText);
    const lastNorm = normalizeForComparison(tw.lastFullStream);
    
    // Check if current contains previous (cumulative pattern)
    const isCumulative = currentNorm.includes(lastNorm) && currentNorm.length > lastNorm.length * 1.2;
    
    // Check character-level overlap for CJK languages
    const overlapRatio = calculateCharacterOverlap(currentText, tw.lastFullStream);
    const hasHighOverlap = overlapRatio > 0.7;
    
    tw.lastFullStream = currentText;
    
    console.log(`🔍 Stream detect: cumulative=${isCumulative}, overlap=${overlapRatio.toFixed(2)}`);
    
    return isCumulative || hasHighOverlap;
  }

  function normalizeForComparison(text) {
    // Normalize text for comparison across languages
    return text
      .toLowerCase()
      .replace(/[\s\u3000]+/g, ' ') // Normalize all whitespace including CJK space
      .replace(/[。、，！？；：「」『』（）｛｝［］【】〈〉《》〔〕‥…]/g, ' ') // CJK punctuation
      .replace(/[.!?,;:'"()\[\]{}<>]/g, ' ') // Western punctuation
      .trim();
  }

  function hasEndPunctuation(text) {
    // Check for sentence-ending punctuation across languages
    const westernEnd = /[.!?]\s*$/;
    const cjkEnd = /[。！？]\s*$/;
    const dutchEnd = /[.!?]\s*$/; // Dutch uses same as English
    
    return westernEnd.test(text) || cjkEnd.test(text);
  }

  function detectRepetitionMultiLang(text) {
    // Detect repetition patterns for multiple languages
    
    // For languages with spaces (English, Dutch, etc.)
    if (text.includes(' ')) {
      // Check for repeated words
      const words = text.toLowerCase().split(/\s+/);
      const wordCounts = {};
      for (const word of words) {
        if (word.length > 2) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      }
      const hasRepeatedWords = Object.values(wordCounts).some(count => count >= 3);
      if (hasRepeatedWords) return true;
    }
    
    // For CJK languages (no spaces)
    // Check for repeated character sequences
    const chars = [...text]; // Split into characters properly
    for (let len = 2; len <= 5; len++) {
      for (let i = 0; i <= chars.length - len * 2; i++) {
        const seq1 = chars.slice(i, i + len).join('');
        const seq2 = chars.slice(i + len, i + len * 2).join('');
        if (seq1 === seq2 && seq1.trim().length > 0) {
          return true; // Found repeated sequence
        }
      }
    }
    
    return false;
  }

  function calculateCharacterOverlap(text1, text2) {
    // Calculate overlap at character level (works for all languages)
    if (!text1 || !text2) return 0;
    
    const chars1 = [...normalizeForComparison(text1)];
    const chars2 = [...normalizeForComparison(text2)];
    
    if (chars2.length === 0) return 0;
    
    // Count how many characters from text2 appear in text1 in order
    let matchCount = 0;
    let lastIndex = -1;
    
    for (const char of chars2) {
      const index = chars1.indexOf(char, lastIndex + 1);
      if (index > lastIndex) {
        matchCount++;
        lastIndex = index;
      }
    }
    
    return matchCount / chars2.length;
  }

  function processAutoStreamCaption(currentText, timestampInSeconds, extractedTimestamp, videoId, youtubeLink) {
    // ✅ OPTIMIZED: Better handling of cumulative auto-generated captions
    console.log('🤖 Auto-stream processing:', currentText.substring(0, 30) + '...');
    
    const tw = captionCollection.timeWindow;
    
    // Initialize if needed
    if (!tw.startTime) {
      tw.startTime = timestampInSeconds;
      tw.streamHistory.clear();
      tw.stableText = '';
      tw.lastFullStream = '';
      console.log(`🏁 Started auto-stream window: ${extractedTimestamp}`);
    }
    
    // Check for significant time gap (user jumped)
    const timeGap = timestampInSeconds - tw.lastProcessedTime;
    if (timeGap > 5 && tw.stableText.length > 0) {
      console.log(`⏭️ Time gap detected (${Math.floor(timeGap)}s) - finalizing current stream`);
      finalizeAutoStream(videoId, youtubeLink);
      resetAutoStream(timestampInSeconds);
      return processAutoStreamCaption(currentText, timestampInSeconds, extractedTimestamp, videoId, youtubeLink);
    }
    
    // OPTIMIZED: Extract only the NEW portion of cumulative text
    const deltaText = extractDeltaText(currentText, tw.lastFullStream);
    
    if (deltaText && deltaText.trim().length > 0) {
      console.log(`📝 Delta text found: "${deltaText}"`);
      
      // Accumulate the delta text
      if (!tw.stableText) {
        tw.stableText = currentText; // First caption, use full text
      } else {
        tw.stableText += ' ' + deltaText; // Add only the new portion
      }
      
      console.log(`📚 Accumulated text: "${tw.stableText.substring(0, 50)}..."`);
    }
    
    // Check if we should finalize based on various conditions
    const shouldFinalize = checkShouldFinalize(currentText, tw, timestampInSeconds);
    
    if (shouldFinalize) {
      console.log('✅ Finalizing segment based on completion criteria');
      finalizeAutoStream(videoId, youtubeLink);
      resetAutoStream(timestampInSeconds);
    }
    
    // Update tracking
    tw.lastFullStream = currentText;
    tw.lastProcessedTime = timestampInSeconds;
  }

  function extractDeltaText(currentText, lastText) {
    // Extract only the NEW portion of text (multi-language support)
    if (!lastText || lastText.length === 0) {
      return currentText;
    }
    
    // For debugging
    console.log(`🔤 Delta extraction: "${lastText}" → "${currentText}"`);
    
    // Simple case: current contains last at the beginning
    if (currentText.startsWith(lastText)) {
      const delta = currentText.substring(lastText.length).trim();
      return cleanBoundaryArtifacts(delta, lastText);
    }
    
    // Complex case: Find the best overlap point
    const overlap = findBestOverlap(lastText, currentText);
    
    if (overlap.found && overlap.deltaText.length > 0) {
      console.log(`✂️ Found overlap at position ${overlap.position}, delta: "${overlap.deltaText}"`);
      return cleanBoundaryArtifacts(overlap.deltaText, lastText);
    }
    
    // No good overlap found - might be a new sentence
    return currentText;
  }

  function findBestOverlap(lastText, currentText) {
    // Find where lastText ends and new content begins in currentText
    let bestOverlap = { found: false, position: -1, deltaText: '' };
    
    // Try to find the end portion of lastText in currentText
    const lastChars = [...lastText];
    const currentChars = [...currentText];
    
    // Start from the end of lastText and look for matches
    for (let i = Math.max(0, lastChars.length - 20); i < lastChars.length; i++) {
      const endPortion = lastChars.slice(i).join('');
      const matchIndex = currentText.indexOf(endPortion);
      
      if (matchIndex === 0) {
        // Found overlap at the beginning
        const deltaStart = matchIndex + endPortion.length;
        const delta = currentText.substring(deltaStart);
        
        if (delta.length > 0) {
          bestOverlap = {
            found: true,
            position: i,
            deltaText: delta
          };
          break;
        }
      }
    }
    
    return bestOverlap;
  }

  function cleanBoundaryArtifacts(delta, previousText) {
    // Remove artifacts at text boundaries (multi-language support)
    if (!delta || delta.length < 2) return delta;
    
    // For space-separated languages (English, Dutch, etc.)
    if (previousText.includes(' ') && delta.includes(' ')) {
      return cleanBoundaryWords(delta, previousText);
    }
    
    // For CJK languages, clean character-level artifacts
    return cleanBoundaryCharacters(delta, previousText);
  }

  function cleanBoundaryWords(delta, previousText) {
    // Clean word-level artifacts for space-separated languages
    const prevWords = previousText.split(/\s+/).slice(-3);
    const deltaWords = delta.split(/\s+/);
    const cleaned = [];
    
    for (let i = 0; i < deltaWords.length; i++) {
      const word = deltaWords[i];
      let isArtifact = false;
      
      // Check if this word is a fragment of a previous word
      for (const prevWord of prevWords) {
        if (word.length < prevWord.length / 2 && prevWord.toLowerCase().includes(word.toLowerCase())) {
          isArtifact = true;
          break;
        }
      }
      
      if (!isArtifact) {
        cleaned.push(word);
      }
    }
    
    return cleaned.join(' ');
  }

  function cleanBoundaryCharacters(delta, previousText) {
    // Clean character-level artifacts for CJK languages
    const lastChars = [...previousText].slice(-5);
    const deltaChars = [...delta];
    
    // Remove leading characters that might be artifacts
    let startIndex = 0;
    for (let i = 0; i < Math.min(3, deltaChars.length); i++) {
      if (lastChars.includes(deltaChars[i])) {
        startIndex = i + 1;
      } else {
        break;
      }
    }
    
    return deltaChars.slice(startIndex).join('');
  }

  function checkShouldFinalize(currentText, tw, currentTime) {
    // Determine if we should finalize (multi-language support)
    
    // 1. Check if text appears complete
    const endsWithPunctuation = hasEndPunctuation(currentText);
    
    // 2. Check if text is stable (hasn't changed)
    const isStable = currentText === tw.lastFullStream;
    
    // 3. Check duration threshold
    const duration = currentTime - tw.startTime;
    const exceedsDuration = duration > 3.5; // 3.5 seconds max per segment
    
    // 4. Check text length threshold (character count for CJK)
    const textLength = getTextLength(tw.stableText || '');
    const tooLong = textLength > getMaxLength(tw.stableText || '');
    
    // 5. Check if no new content for a while
    const noNewContent = isStable && duration > 1.5;
    
    console.log(`🔍 Finalize check: punct=${endsWithPunctuation}, stable=${isStable}, duration=${duration.toFixed(1)}s, length=${textLength}`);
    
    return (endsWithPunctuation && duration > 0.8) || 
           (noNewContent) || 
           (exceedsDuration && textLength > 10) ||
           (tooLong);
  }

  function getTextLength(text) {
    // Get effective text length considering language type
    if (!text) return 0;
    
    // For CJK text (no spaces), count characters
    if (!text.includes(' ') || /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return [...text].length; // Character count
    }
    
    // For space-separated languages, count words
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  function getMaxLength(text) {
    // Get max length based on language type
    
    // CJK languages: fewer characters needed
    if (!text.includes(' ') || /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return 80; // 80 characters for CJK
    }
    
    // Space-separated languages: word count
    return 40; // 40 words for English/Dutch/etc
  }

  function updateStableText(currentText, timestampInSeconds, extractedTimestamp, videoId, youtubeLink) {
    const tw = captionCollection.timeWindow;
    
    // Clear existing stability timer
    if (tw.stabilityTimer) {
      clearTimeout(tw.stabilityTimer);
    }
    
    // Set new stability timer
    tw.stabilityTimer = setTimeout(() => {
      // Text has been stable - finalize it
      if (currentText.length > 10) {
        console.log('✅ Text stabilized, finalizing stream:', currentText.substring(0, 40) + '...');
        tw.stableText = currentText;
        finalizeAutoStream(videoId, youtubeLink);
        resetAutoStream(timestampInSeconds + tw.windowDuration);
      }
    }, tw.stabilityDuration);
    
    console.log(`⏱️ Stability timer set for: ${currentText.substring(0, 20)}...`);
  }

  function finalizeAutoStream(videoId, youtubeLink) {
    const tw = captionCollection.timeWindow;
    
    if (!tw.stableText || tw.stableText.length < 8) {
      console.log('❌ No stable text to finalize');
      return;
    }
    
    // Clean and normalize the accumulated text
    const cleanedText = cleanAutoGeneratedText(tw.stableText);
    
    if (cleanedText.length > 8) {
      // Enhanced duplicate checking
      const isDuplicate = captionCollection.segments.some(segment => {
        // Check time overlap
        const timeOverlap = Math.abs(segment.start - tw.startTime) < 3;
        
        // Check text similarity (more strict for auto-captions)
        const textSimilarity = calculateSimilarity(segment.text.toLowerCase(), cleanedText.toLowerCase()) > 0.85;
        
        // Also check if new text is just an extension of existing
        const isExtension = segment.text.toLowerCase().includes(cleanedText.toLowerCase()) ||
                          cleanedText.toLowerCase().includes(segment.text.toLowerCase());
        
        return (timeOverlap && textSimilarity) || (timeOverlap && isExtension);
      });
      
      if (!isDuplicate) {
        const videoMetadata = collectVideoMetadata();
        const endTime = tw.lastProcessedTime || (tw.startTime + 3);
        
        captionCollection.segments.push({
          start: tw.startTime,
          end: endTime,
          duration: endTime - tw.startTime,
          text: cleanedText,
          timestamp: Date.now(),
          videoId: videoId,
          youtubeLink: youtubeLink ? youtubeLink.replace(/&t=\d+s/, `&t=${Math.floor(tw.startTime)}s`) : '#',
          originalTimestamp: formatTime(tw.startTime),
          autoStreamSegment: true,
          streamMethod: 'delta-extraction',
          videoTitle: videoMetadata.title,
          channelName: videoMetadata.channel,
          pageUrl: videoMetadata.url
        });
        
        console.log(`✅ Created auto-stream segment [${formatTime(tw.startTime)}]:`, cleanedText.substring(0, 60) + '...');
        console.log(`   📊 Duration: ${(endTime - tw.startTime).toFixed(1)}s`);
      } else {
        console.log('🚫 Skipped duplicate auto-stream segment');
      }
    }
  }

  function resetAutoStream(newStartTime) {
    const tw = captionCollection.timeWindow;
    tw.startTime = newStartTime;
    tw.streamHistory.clear();
    tw.stableText = '';
    tw.lastFullStream = '';
    if (tw.stabilityTimer) {
      clearTimeout(tw.stabilityTimer);
      tw.stabilityTimer = null;
    }
  }

  function detectCaptionQuality(currentText) {
    // Detect if captions are manual/creator-made vs auto-generated
    
    if (!currentText || currentText.length < 5) {
      return 'auto'; // Very short text suggests auto-generated fragments
    }
    
    // ✅ STRICT: Check for obvious auto-generated patterns first
    const hasRepeatedWords = /(\b\w+\b).*\b\1\b.*\b\1\b/i.test(currentText);
    const hasBrokenWords = /\b[a-z]\s+[a-z]+\b/i.test(currentText); // Like "a bout" or "I m"
    const hasObviousFragments = /whatis|a ll|myanswer|realizeunderstand|a re|OA a ll|A OA|sked/i.test(currentText);
    const hasMergedWords = /\b\w+[a-z][A-Z]\w+\b/.test(currentText); // Like "myanswer", "realizeunderstand"
    const hasExcessiveSpacing = /\b[a-z]\s+[a-z]\s+[a-z]/i.test(currentText); // Like "a n s w e r"
    const hasPartialWords = /\b[a-z]{1,2}\s+[a-z]+/i.test(currentText); // Like "a nswer", "I m"
    
    // ✅ IMMEDIATE AUTO-GENERATED FLAGS (any one triggers auto mode)
    if (hasRepeatedWords) {
      console.log(`🤖 AUTO: Repeated words detected in "${currentText.substring(0, 30)}..."`);
      return 'auto';
    }
    
    if (hasBrokenWords || hasPartialWords) {
      console.log(`🤖 AUTO: Broken words detected in "${currentText.substring(0, 30)}..."`);
      return 'auto';
    }
    
    if (hasObviousFragments) {
      console.log(`🤖 AUTO: Fragment patterns detected in "${currentText.substring(0, 30)}..."`);
      return 'auto';
    }
    
    if (hasMergedWords) {
      console.log(`🤖 AUTO: Merged words detected in "${currentText.substring(0, 30)}..."`);
      return 'auto';
    }
    
    if (hasExcessiveSpacing) {
      console.log(`🤖 AUTO: Excessive spacing detected in "${currentText.substring(0, 30)}..."`);
      return 'auto';
    }
    
    // ✅ POSITIVE MANUAL CAPTION INDICATORS
    const hasProperPunctuation = /[.!?]$/.test(currentText.trim());
    const hasProperCapitalization = /^[A-Z]/.test(currentText.trim());
    const reasonableLength = currentText.length > 15 && currentText.length < 200;
    const hasCompleteWords = !/\b[a-z]{1,2}(\s|$)/i.test(currentText); // No single/double letter words
    const hasNormalSpacing = !/\s{2,}/.test(currentText); // No excessive spaces
    const looksLikeNormalSentence = /^[A-Z][^.!?]*[.!?]?$/.test(currentText.trim());
    
    // Score for manual captions (must be very high to qualify)
    let manualScore = 0;
    if (hasProperPunctuation) manualScore += 3;
    if (hasProperCapitalization) manualScore += 2;
    if (reasonableLength) manualScore += 2;
    if (hasCompleteWords) manualScore += 3;
    if (hasNormalSpacing) manualScore += 2;
    if (looksLikeNormalSentence) manualScore += 3;
    
    const isManual = manualScore >= 12; // Much higher threshold
    
    console.log(`🔍 Caption quality detection: "${currentText.substring(0, 30)}..." → ${isManual ? 'MANUAL' : 'AUTO'} (score: ${manualScore}/15)`);
    
    return isManual ? 'manual' : 'auto';
  }

  function processManualCaption(currentText, timestampInSeconds, extractedTimestamp, videoId, youtubeLink, isNewChunk) {
    // ✅ RESTORED: Original processing for high-quality manual captions
    console.log('📝 Processing manual caption:', currentText.substring(0, 40) + '...');
    
    // Check for significant time gap (user jumped)
    const timeGap = timestampInSeconds - captionCollection.lastCollectedTimestamp;
    const isSignificantGap = timeGap > captionCollection.timeSegmentThreshold;
    const isUserJump = timeGap > 5;
    
    // ✅ AGGRESSIVE duplicate detection for manual captions
    const isDuplicate = captionCollection.segments.some(segment => {
      const timeDiff = Math.abs(segment.start - timestampInSeconds);
      const currTextLower = currentText.toLowerCase().trim();
      const segTextLower = segment.text.toLowerCase().trim();
      
      // Calculate text similarity
      const textSimilarity = calculateSimilarity(currTextLower, segTextLower);
      
      // Check for substring relationships
      const isSubstring = currTextLower.includes(segTextLower) || segTextLower.includes(currTextLower);
      
      // Check for exact text match
      const isExactMatch = currTextLower === segTextLower;
      
      // AGGRESSIVE duplicate conditions:
      const conditions = [
        // 1. Exact same timestamp (within 1 second)
        timeDiff < 1,
        
        // 2. Very close time + any text similarity
        timeDiff < 3 && textSimilarity > 0.5,
        
        // 3. Same text content (regardless of time)
        isExactMatch,
        
        // 4. Substring relationship within reasonable time window
        timeDiff < 5 && isSubstring,
        
        // 5. High text similarity within expanded time window  
        timeDiff < 8 && textSimilarity > 0.8
      ];
      
      const isDupe = conditions.some(condition => condition);
      
      if (isDupe) {
        console.log(`🚫 Duplicate detected: time=${timeDiff.toFixed(1)}s, similarity=${textSimilarity.toFixed(2)}, substring=${isSubstring}, exact=${isExactMatch}`);
      }
      
      return isDupe;
    });
    
    if (!isDuplicate) {
      const videoMetadata = collectVideoMetadata();
      
      // Create segment directly for manual captions (they're already good quality)
      const finalText = currentText.trim();
      console.log('📝 Final manual caption text (no cleaning):', finalText);
      
      captionCollection.segments.push({
        start: timestampInSeconds,
        end: timestampInSeconds + 3, // Estimate duration
        duration: 3,
        text: finalText,
        timestamp: Date.now(),
        videoId: videoId,
        youtubeLink: youtubeLink,
        originalTimestamp: extractedTimestamp,
        manualCaption: true, // Mark as manual/creator caption
        isNewTimeSegment: isSignificantGap || isUserJump,
        timeGapFromPrevious: timeGap,
        // Video metadata
        videoTitle: videoMetadata.title,
        channelName: videoMetadata.channel,
        pageUrl: videoMetadata.url,
        // Chunk information
        chunkNumber: captionCollection.chunkCounter,
        isNewChunk: isNewChunk
      });
      
      console.log(`✅ Created manual caption segment [${extractedTimestamp}]:`, currentText.substring(0, 50) + '...');
      
      if (isSignificantGap || isUserJump) {
        console.log(`  🎯 NEW SEGMENT: Time gap ${Math.floor(timeGap)}s → ${extractedTimestamp}`);
      }
    } else {
      console.log('🚫 Skipped duplicate manual caption:', currentText.substring(0, 30) + '...');
    }
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function createSegmentFromTimeWindow(videoId, youtubeLink) {
    // ✅ NEW: Create a single coherent segment from the time window
    if (captionCollection.timeWindow.textBuffer.length === 0) return;
    
    console.log('🔧 Creating segment from time window with', captionCollection.timeWindow.textBuffer.length, 'items');
    
    // Sort by timestamp and combine text
    const sortedItems = captionCollection.timeWindow.textBuffer.sort((a, b) => a.timestamp - b.timestamp);
    const combinedText = sortedItems.map(item => item.text).join(' ');
    
    // Clean the combined text (minimal processing)
    const cleanedText = cleanAutoGeneratedText(combinedText);
    
    if (cleanedText.length > 8) {
      // Check for duplicates against existing segments
      const isDuplicate = captionCollection.segments.some(segment => {
        const timeOverlap = Math.abs(segment.start - sortedItems[0].timestamp) < 5;
        const textSimilarity = calculateSimilarity(segment.text.toLowerCase(), cleanedText.toLowerCase()) > 0.75;
        return timeOverlap && textSimilarity;
      });
      
      if (!isDuplicate) {
        // Collect video metadata
        const videoMetadata = collectVideoMetadata();
        
        // Create single segment from window
        const windowStartTime = sortedItems[0].timestamp;
        const windowEndTime = sortedItems[sortedItems.length - 1].timestamp + 2;
        
        captionCollection.segments.push({
          start: windowStartTime,
          end: windowEndTime,
          duration: windowEndTime - windowStartTime,
          text: cleanedText,
          timestamp: Date.now(),
          videoId: videoId,
          youtubeLink: youtubeLink ? youtubeLink.replace(/&t=\d+s/, `&t=${Math.floor(windowStartTime)}s`) : '#',
          originalTimestamp: sortedItems[0].extractedTimestamp,
          timeWindowSegment: true,
          itemCount: sortedItems.length,
          // Add video metadata
          videoTitle: videoMetadata.title,
          channelName: videoMetadata.channel,
          pageUrl: videoMetadata.url,
          // Chunk information
          chunkNumber: captionCollection.chunkCounter,
          isNewChunk: false
        });
        
        console.log(`✅ Created time-window segment [${sortedItems[0].extractedTimestamp}]:`, cleanedText.substring(0, 60) + '...');
        console.log(`   📊 Window: ${sortedItems.length} items, ${Math.floor(windowEndTime - windowStartTime)}s duration`);
      } else {
        console.log('🚫 Skipped duplicate time-window segment:', cleanedText.substring(0, 40) + '...');
      }
    }
    
    // Clear the buffer
    captionCollection.timeWindow.textBuffer = [];
  }

  // ✅ NEW: Whisper Integration Functions
  
  async function initializeAudioCapture() {
    // ✅ OPTIMIZED: Enhanced microphone setup for speaker audio capture
    try {
      console.log('🎙️ Initializing microphone for Whisper transcription...');
      console.log('📋 SETUP GUIDE: For best results:');
      console.log('   1. Turn up your speaker volume to 70-80%');
      console.log('   2. Position microphone close to speakers (not too close to avoid distortion)');
      console.log('   3. Minimize background noise');
      console.log('📋 NOTE: You will be asked to grant microphone permissions');
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone API not available in this browser');
      }
      
      console.log('🔒 Requesting microphone permissions...');
      
      // ✅ FIX: Use microphone with optimized settings for speaker pickup
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,  // Disable echo cancellation to pick up speaker audio
          noiseSuppression: false,  // Disable noise suppression to preserve all audio
          autoGainControl: false,   // Disable AGC for consistent levels
          sampleRate: 44100,       // Higher sample rate for better quality
          channelCount: 1,         // Mono audio
          volume: 1.0             // Maximum sensitivity
        },
        video: false
      });
      
      console.log('✅ Microphone permission granted');
      console.log('🔍 Stream details:', {
        hasAudio: stream.getAudioTracks().length > 0,
        audioTracks: stream.getAudioTracks().length,
        sampleRate: stream.getAudioTracks()[0]?.getSettings()?.sampleRate
      });
      
      // ✅ NEW: Add audio level monitoring to help debug
      try {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        
        // ✅ FIX: Store audio context resources for proper cleanup
        captionCollection.whisper.audioContext = audioContext;
        captionCollection.whisper.audioSource = source;
        captionCollection.whisper.analyserNode = analyser;
        
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // ✅ OPTIMIZED: Light audio monitoring with proper cleanup
        let audioMonitoringActive = true;
        captionCollection.whisper.stopAudioMonitoring = () => {
          audioMonitoringActive = false;
        };
        
        const monitorAudio = () => {
          // Exit immediately if monitoring disabled or recording stopped
          if (!audioMonitoringActive || !captionCollection.whisper.audioStream || !captionCollection.isCollecting) {
            console.log('🛑 Audio monitoring stopped');
            return;
          }
          
          try {
            // Use requestAnimationFrame for better performance
            requestAnimationFrame(() => {
              if (!audioMonitoringActive) return;
              
              analyser.getByteFrequencyData(dataArray);
              // Simplified calculation to reduce CPU load
              const sum = dataArray[0] + dataArray[32] + dataArray[64] + dataArray[96]; // Sample only 4 points
              const average = sum / 4;
              
              if (average > 15) { // Only log significant audio
                console.log(`🎵 Audio detected: ${Math.round(average)}/255`);
              }
              
              // Increased interval and conditional continuation
              if (audioMonitoringActive && captionCollection.isCollecting) {
                setTimeout(monitorAudio, 5000); // 5 seconds instead of 3
              }
            });
          } catch (error) {
            console.log('⚠️ Audio monitoring stopped due to error:', error.message);
            audioMonitoringActive = false;
          }
        };
        
        // Start monitoring after a delay
        whisper.monitoringInitTimer = setTimeout(() => {
          if (audioMonitoringActive) {
            monitorAudio();
          }
        }, 2000);
        
      } catch (error) {
        console.log('⚠️ Audio monitoring not available:', error.message);
      }
      
      if (!stream || !stream.getAudioTracks().length) {
        throw new Error('No microphone available - please check your microphone permissions');
      }
      
      captionCollection.whisper.audioStream = stream;
      captionCollection.whisper.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      captionCollection.whisper.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // ✅ CRITICAL FIX: More aggressive memory protection
          if (captionCollection.whisper.audioChunks.length > 5) {
            console.log('🧹 CRITICAL: Clearing old audio chunks to prevent memory overflow');
            // Keep only the last 2 chunks to prevent memory buildup
            captionCollection.whisper.audioChunks = captionCollection.whisper.audioChunks.slice(-2);
          }
          
          captionCollection.whisper.audioChunks.push(event.data);
          console.log(`🎵 Audio chunk collected: ${event.data.size} bytes`);
          console.log(`📊 Total chunks collected: ${captionCollection.whisper.audioChunks.length}`);
          
          // ✅ NEW: Check if chunk size is reasonable (should be > 10KB for 10 seconds of audio)
          if (event.data.size < 10000) {
            console.log('⚠️ Small audio chunk - may indicate low volume or no audio capture');
            console.log('💡 TIP: Ensure speaker volume is up and microphone is positioned correctly');
          } else {
            console.log('✅ Good audio chunk size - likely capturing audio properly');
          }
        } else {
          console.log('⚠️ Empty audio chunk received - no audio being captured');
          console.log('💡 CHECK: Speaker volume, microphone position, and browser permissions');
        }
      };
      
      captionCollection.whisper.mediaRecorder.onstop = async () => {
        console.log(`🎵 MediaRecorder stopped, processing ${captionCollection.whisper.audioChunks.length} chunks`);
        
        if (captionCollection.whisper.audioChunks.length === 0) {
          console.log('⚠️ No audio chunks to process');
          return;
        }
        
        const audioBlob = new Blob(captionCollection.whisper.audioChunks, {
          type: 'audio/webm;codecs=opus'
        });
        
        console.log(`🎵 Audio blob created: ${audioBlob.size} bytes from ${captionCollection.whisper.audioChunks.length} chunks`);
        
        if (audioBlob.size === 0) {
          console.log('⚠️ Audio blob is empty, skipping transcription');
          return;
        }
        
        // Send to Whisper for transcription
        await transcribeWithWhisper(audioBlob, captionCollection.whisper.chunkStartTime);
        
        // Clear chunks for next recording
        captionCollection.whisper.audioChunks = [];
      };
      
      console.log('✅ Audio capture initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize microphone:', error.message);
      
      if (error.name === 'NotAllowedError') {
        console.log('🚫 Microphone access denied by user');
      } else if (error.name === 'NotFoundError') {
        console.log('🔍 No microphone found on this device');
      } else {
        console.log('🔄 Falling back to caption processing...');
      }
      
      return false;
    }
  }

  // ✅ CRITICAL FIX: Periodic memory cleanup to prevent browser freeze
  function startPeriodicMemoryCleanup() {
    const whisper = captionCollection.whisper;
    
    // Clear any existing cleanup timer
    if (whisper.memoryCleanupTimer) {
      clearInterval(whisper.memoryCleanupTimer);
    }
    
    whisper.memoryCleanupTimer = setInterval(() => {
      if (!captionCollection.isCollecting) {
        clearInterval(whisper.memoryCleanupTimer);
        whisper.memoryCleanupTimer = null;
        return;
      }
      
      console.log('🧹 CRITICAL: Running periodic memory cleanup...');
      
      // 1. Limit audio chunks aggressively
      if (whisper.audioChunks.length > 3) {
        whisper.audioChunks = whisper.audioChunks.slice(-2);
        console.log('🧹 Trimmed audio chunks to prevent memory buildup');
      }
      
      // 2. Clear old pending transcriptions (> 2 minutes old)
      const cutoffTime = Date.now() - (2 * 60 * 1000);
      for (const [key, value] of whisper.pendingTranscriptions.entries()) {
        if (value.timestamp < cutoffTime) {
          whisper.pendingTranscriptions.delete(key);
          console.log('🧹 Removed stale transcription:', key);
        }
      }
      
      // 3. Limit processed time ranges (keep only last 20)
      if (whisper.processedTimeRanges.length > 20) {
        whisper.processedTimeRanges = whisper.processedTimeRanges.slice(-10);
        console.log('🧹 Trimmed processed time ranges');
      }
      
      // 4. Limit caption segments (keep only last 100)
      if (captionCollection.segments.length > 100) {
        captionCollection.segments = captionCollection.segments.slice(-50);
        console.log('🧹 Trimmed caption segments to prevent memory overflow');
      }
      
      console.log(`📊 Memory status: ${whisper.audioChunks.length} chunks, ${whisper.pendingTranscriptions.size} pending, ${whisper.processedTimeRanges.length} ranges, ${captionCollection.segments.length} segments`);
      
    }, 30000); // Run every 30 seconds
    
    console.log('✅ Started periodic memory cleanup (every 30s)');
  }

  function startContinuousAudioRecording() {
    // ✅ NEW: Start continuous audio recording for Whisper mode
    const whisper = captionCollection.whisper;
    
    if (!whisper.audioStream || !whisper.mediaRecorder) {
      console.error('❌ Audio stream or recorder not available');
      return;
    }
    
    console.log('🎵 Starting continuous audio recording for Whisper transcription...');
    
    // ✅ CRITICAL FIX: Start periodic memory cleanup to prevent browser freeze
    startPeriodicMemoryCleanup();
    
    // ✅ EMERGENCY CIRCUIT BREAKER: Auto-stop after 2 minutes to prevent freezing
    const emergencyStopTimer = setTimeout(() => {
      if (captionCollection.isCollecting) {
        console.log('🚨 EMERGENCY STOP: Auto-stopping transcript recording after 2 minutes to prevent tab freezing');
        console.log('💡 This helps maintain browser stability during long recordings');
        stopCaptionCollection();
        
        // Send emergency message to sidepanel
        chrome.runtime.sendMessage({
          action: 'transcriptEmergencyStop',
          reason: 'Automatic safety stop after 2 minutes',
          duration: 120000,
          segments: captionCollection.segments.length
        }).catch(err => console.log('Failed to send emergency stop message:', err));
      }
    }, 120000); // 2 minutes maximum
    
    // Store timer for cleanup
    whisper.emergencyStopTimer = emergencyStopTimer;
    
    const startRecordingChunk = () => {
      if (!captionCollection.isCollecting) {
        console.log('🛑 Collection stopped, ending audio recording');
        return;
      }
      
      // ✅ FIX: Get current time more reliably
      let currentTime = 0;
      const player = document.querySelector('#movie_player');
      const video = document.querySelector('video');
      
      if (player && typeof player.getCurrentTime === 'function') {
        currentTime = player.getCurrentTime();
      } else if (video && typeof video.currentTime === 'number') {
        currentTime = video.currentTime;
      } else {
        // Fallback: use elapsed time since start
        currentTime = (Date.now() - captionCollection.startTime) / 1000;
      }
      
      console.log('🕐 Current time detected:', currentTime, 'seconds');
      whisper.chunkStartTime = currentTime;
      
      console.log(`🎵 Recording audio chunk starting at ${formatTime(currentTime)}`);
      
      // Clear previous chunks
      whisper.audioChunks = [];
      
      // Start recording
      if (whisper.mediaRecorder.state !== 'recording') {
        console.log(`🔴 Starting MediaRecorder for ${whisper.chunkDuration}s chunk`);
        console.log(`📊 MediaRecorder state before start: ${whisper.mediaRecorder.state}`);
        
        try {
          whisper.mediaRecorder.start();
          whisper.isRecording = true;
          console.log(`✅ MediaRecorder started successfully`);
          
          // ✅ FIX: Track timers for proper cleanup to prevent conflicts on re-recording
          whisper.chunkTimer = setTimeout(() => {
            if (whisper.isRecording && captionCollection.isCollecting) {
              console.log(`⏹️ Stopping MediaRecorder after ${whisper.chunkDuration}s`);
              console.log(`📊 Expected audio data: ~${whisper.chunkDuration * 1000 * 16}KB (16KB/sec for good quality)`);
              whisper.mediaRecorder.stop();
              whisper.isRecording = false;
              
              // ✅ FIX: Add gap between chunks to prevent overlap and duplicates
              whisper.gapTimer = setTimeout(() => {
                if (captionCollection.isCollecting) {
                  console.log('🔄 Starting next audio chunk with gap...');
                  startRecordingChunk();
                }
              }, whisper.chunkGap * 1000); // Use configurable gap (1 second default)
            }
          }, whisper.chunkDuration * 1000);
        } catch (error) {
          console.error('❌ Failed to start MediaRecorder:', error);
          whisper.isRecording = false;
        }
      } else {
        console.log(`⚠️ MediaRecorder already in state: ${whisper.mediaRecorder.state}`);
      }
    };
    
    // Start the first chunk
    startRecordingChunk();
  }

  function startNewAudioChunk(startTime, extractedTimestamp) {
    // Start recording a new audio chunk for Whisper (legacy function for fallback)
    const whisper = captionCollection.whisper;
    
    console.log(`🎵 Starting new audio chunk at ${extractedTimestamp}`);
    
    whisper.chunkStartTime = startTime;
    
    if (whisper.mediaRecorder && whisper.mediaRecorder.state !== 'recording') {
      whisper.mediaRecorder.start();
      whisper.isRecording = true;
      
      // ✅ FIX: Track auto-stop timer for proper cleanup
      whisper.autoStopTimer = setTimeout(() => {
        if (whisper.isRecording) {
          finalizeCurrentAudioChunk(startTime + whisper.chunkDuration);
        }
      }, whisper.chunkDuration * 1000);
    }
  }

  function finalizeCurrentAudioChunk(endTime) {
    // Stop current audio recording and send for transcription
    const whisper = captionCollection.whisper;
    
    if (whisper.mediaRecorder && whisper.isRecording) {
      console.log(`🎵 Finalizing audio chunk (${whisper.chunkDuration}s)`);
      whisper.mediaRecorder.stop();
      whisper.isRecording = false;
    }
  }

  async function transcribeWithWhisper(audioBlob, startTime) {
    // Send audio to OpenAI Whisper for transcription
    try {
      console.log('🤖 Sending audio to Whisper for transcription...');
      console.log(`🎵 Audio blob size: ${audioBlob.size} bytes, duration: ~${captionCollection.whisper.chunkDuration}s`);
      console.log(`⏰ Timestamp: ${formatTime(startTime)}`);
      
      // Get API key from storage
      const result = await chrome.storage.sync.get('apiKey');
      if (!result.apiKey) {
        console.error('❌ No OpenAI API key found in storage');
        console.log('💡 Please set your OpenAI API key in the extension settings');
        return;
      }
      
      // Convert audio blob to the format Whisper expects
      const detectedLanguage = detectVideoLanguage();
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', detectedLanguage);
      formData.append('response_format', 'json');
      
      console.log('🌐 Making API request to OpenAI Whisper...');
      console.log(`🌍 Using language: "${detectedLanguage}" for transcription`);
      
      // ✅ PREVENT HANGING: Add timeout to Whisper API request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ Whisper API request timeout after 30s');
        controller.abort();
      }, 30000); // 30 second timeout
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${result.apiKey}`
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const transcription = await response.json();
        console.log('✅ Whisper transcription received:', transcription.text);
        console.log(`📝 Text length: ${transcription.text.length} characters`);
        
        // ✅ NEW: Quality check and adaptive chunk sizing
        const isGoodTranscription = validateTranscriptionQuality(transcription.text, detectedLanguage);
        if (isGoodTranscription) {
          // Create segment with high-quality Whisper transcription
          createWhisperSegment(transcription.text, startTime, startTime + captionCollection.whisper.chunkDuration);
          
          // ✅ NEW: Adaptive chunk sizing based on transcription success
          adaptChunkSizeBasedOnQuality(true, transcription.text.length);
        } else {
          console.log('⚠️ Transcription quality check failed - may be generic text or poor audio');
          console.log('💡 TIP: Check if microphone is properly capturing speaker audio');
          
          // Adapt chunk size for poor quality
          adaptChunkSizeBasedOnQuality(false, transcription.text.length);
        }
        
      } else {
        const errorText = await response.text();
        console.error('❌ Whisper API error:', response.status, response.statusText);
        console.error('❌ Error details:', errorText);
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⏰ Whisper API request was cancelled due to timeout');
      } else {
        console.error('❌ Error transcribing with Whisper:', error);
      }
    }
  }

  function createWhisperSegment(transcriptionText, startTime, endTime) {
    // Create a high-quality segment from Whisper transcription
    if (!transcriptionText || transcriptionText.trim().length < 3) {
      console.log('⚠️ Whisper returned empty/short transcription');
      return;
    }
    
    const videoMetadata = collectVideoMetadata();
    const videoId = extractVideoId();
    const youtubeLink = videoId ? `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startTime)}s` : '#';
    
    const segment = {
      start: startTime,
      end: endTime,
      duration: endTime - startTime,
      text: transcriptionText.trim(),
      timestamp: Date.now(),
      videoId: videoId,
      youtubeLink: youtubeLink,
      originalTimestamp: formatTime(startTime),
      whisperTranscribed: true, // Mark as Whisper-generated
      // Video metadata
      videoTitle: videoMetadata.title,
      channelName: videoMetadata.channel,
      pageUrl: videoMetadata.url,
      // Chunk information
      chunkNumber: captionCollection.chunkCounter
    };
    
    // ✅ FIX: Enhanced duplicate detection for Whisper segments
    const isDuplicate = captionCollection.segments.some(existingSegment => {
      // More precise time overlap check
      const timeOverlap = Math.abs(existingSegment.start - startTime) < 3;
      const textSimilarity = calculateSimilarity(existingSegment.text.toLowerCase(), transcriptionText.toLowerCase()) > 0.8;
      
      // Additional check: if times are very close (within 1 second), it's likely a duplicate
      const veryCloseTime = Math.abs(existingSegment.start - startTime) < 1;
      
      return (timeOverlap && textSimilarity) || veryCloseTime;
    });
    
    // ✅ SIMPLIFIED: Basic time range check to prevent crashes
    const wasAlreadyProcessed = captionCollection.whisper.processedTimeRanges.length > 50; // Prevent memory buildup
    if (wasAlreadyProcessed) {
      captionCollection.whisper.processedTimeRanges = []; // Clear to prevent crash
      console.log('🧹 Cleared processed ranges to prevent memory issues');
    }
    
    if (!isDuplicate) {
      captionCollection.segments.push(segment);
      
      // ✅ NEW: Record this time range as processed
      captionCollection.whisper.processedTimeRanges.push({
        start: startTime,
        end: endTime,
        timestamp: Date.now()
      });
      
      // Keep only recent processed ranges (last 10 minutes) to prevent memory buildup
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
      captionCollection.whisper.processedTimeRanges = captionCollection.whisper.processedTimeRanges.filter(
        range => range.timestamp > tenMinutesAgo
      );
      
      console.log(`✅ Created Whisper segment [${formatTime(startTime)}]:`, transcriptionText.substring(0, 60) + '...');
      console.log(`📊 Processed ranges: ${captionCollection.whisper.processedTimeRanges.length}`);
    } else {
      console.log('🚫 Skipped duplicate Whisper segment');
    }
  }

  function validateTranscriptionQuality(transcriptionText, expectedLanguage) {
    // ✅ NEW: Validate if transcription is relevant and not generic text
    if (!transcriptionText || transcriptionText.trim().length < 3) {
      console.log('⚠️ Transcription too short or empty');
      return false;
    }
    
    const text = transcriptionText.toLowerCase().trim();
    console.log(`🔍 Validating transcription quality: "${text.substring(0, 50)}..."`);
    
    // Check for generic/repetitive patterns that indicate poor audio capture
    const genericPatterns = [
      /^(\w+\s*){1,3}\1+$/, // Repeated words like "hello hello hello"
      /^民间|新闻|时代|世界|人民$/, // Generic Chinese news terms
      /^the the the|and and and|is is is/, // Repeated English words
      /^一个一个|这个这个/, // Repeated Chinese measure words
      /^\s*$/, // Only whitespace
      /^(\w{1,2}\s*){5,}$/ // Too many very short words
    ];
    
    for (const pattern of genericPatterns) {
      if (pattern.test(text)) {
        console.log(`⚠️ Generic pattern detected: ${pattern}`);
        return false;
      }
    }
    
    // Check word diversity (avoid repetitive content)
    const words = text.split(/\s+/).filter(w => w.length > 2);
    const uniqueWords = new Set(words);
    const diversityRatio = uniqueWords.size / Math.max(words.length, 1);
    
    if (diversityRatio < 0.3 && words.length > 3) {
      console.log(`⚠️ Low word diversity: ${(diversityRatio * 100).toFixed(1)}% (${uniqueWords.size}/${words.length})`);
      return false;
    }
    
    console.log(`✅ Transcription quality check passed - diversity: ${(diversityRatio * 100).toFixed(1)}%`);
    return true;
  }

  function adaptChunkSizeBasedOnQuality(isGoodQuality, textLength) {
    // ✅ DISABLED: Adaptive sizing disabled to prevent crashes
    console.log(`📊 Transcription quality: ${isGoodQuality ? 'good' : 'poor'}, length: ${textLength}`);
    // Keep fixed chunk size for stability
  }

  function detectVideoLanguage() {
    // ✅ ENHANCED: Multi-language detection for Whisper transcription
    try {
      console.log('🌍 Starting comprehensive language detection for Whisper...');
      
      // ✅ PRIORITY 0: Check if user has manually overridden language
      if (captionCollection.whisper.languageOverride && captionCollection.whisper.languageOverride !== 'auto') {
        console.log(`🎯 User forced language: ${captionCollection.whisper.languageOverride.toUpperCase()}`);
        return captionCollection.whisper.languageOverride;
      }
      
      // ✅ PRIORITY 1: Get video content for analysis
      const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() || '';
      const channelName = document.querySelector('ytd-channel-name#channel-name a')?.textContent?.trim() || '';
      const videoDescription = document.querySelector('#description')?.textContent?.trim().substring(0, 200) || '';
      
      console.log('🔍 Video context:', { 
        videoTitle: videoTitle.substring(0, 50), 
        channelName, 
        description: videoDescription.substring(0, 50) 
      });
      
      const contentToCheck = (videoTitle + ' ' + channelName + ' ' + videoDescription).toLowerCase();
      
      // ✅ NEW: Multi-language detection patterns
      const languagePatterns = {
        'en': {
          words: /\b(the|and|is|are|was|were|have|has|had|will|would|could|should|for|with|from|about|into|through|during|before|after|above|below|between|among)\b/i,
          chars: /^[a-zA-Z0-9\s\-_.,!?'"()&:]+$/
        },
        'nl': {
          words: /\b(de|het|en|is|zijn|was|waren|hebben|heeft|had|zal|zou|kunnen|moeten|voor|met|van|over|in|door|tijdens|voordat|na|boven|onder|tussen)\b/i,
          chars: /[a-zA-ZÀ-ſ\s\-_.,!?'"()&:]/,
          specific: /\b(dit|dat|deze|die|hier|daar|waar|hoe|wat|wie|wanneer|waarom|omdat|maar|dus|ook|nog|wel|niet|geen|alle|veel|weinig|goed|slecht|groot|klein)\b/i
        },
        'de': {
          words: /\b(der|die|das|und|ist|sind|war|waren|haben|hat|hatte|wird|würde|könnte|sollte|für|mit|von|über|in|durch|während|vor|nach|über|unter|zwischen)\b/i,
          chars: /[a-zA-ZÀ-ſß\s\-_.,!?'"()&:]/
        },
        'fr': {
          words: /\b(le|la|les|et|est|sont|était|étaient|avoir|a|avait|sera|serait|pourrait|devrait|pour|avec|de|sur|dans|à|travers|pendant|avant|après|au-dessus|sous|entre)\b/i,
          chars: /[a-zA-ZÀ-ſ\s\-_.,!?'"()&:]/
        },
        'es': {
          words: /\b(el|la|los|las|y|es|son|era|eran|tener|tiene|tenía|será|sería|podría|debería|para|con|de|sobre|en|a|través|durante|antes|después|arriba|abajo|entre)\b/i,
          chars: /[a-zA-ZÀ-ſñ\s\-_.,!?¡¿'"()&:]/
        },
        'zh': {
          words: /[一-鿿]/,
          chars: /[一-鿿]/
        },
        'ja': {
          words: /[぀-ゟ゠-ヿ一-鿿]/,
          chars: /[぀-ゟ゠-ヿ一-鿿]/
        }
      };
      
      // ✅ NEW: Score each language based on content
      const languageScores = {};
      
      for (const [lang, patterns] of Object.entries(languagePatterns)) {
        let score = 0;
        
        // Check for characteristic words
        const wordMatches = (contentToCheck.match(patterns.words) || []).length;
        score += wordMatches * 10;
        
        // Check for specific language features (for Dutch)
        if (patterns.specific) {
          const specificMatches = (contentToCheck.match(patterns.specific) || []).length;
          score += specificMatches * 15; // Higher weight for specific patterns
        }
        
        // Check character patterns
        if (patterns.chars.test(contentToCheck)) {
          score += 5;
        }
        
        languageScores[lang] = score;
        
        if (score > 0) {
          console.log(`🔍 ${lang.toUpperCase()} score: ${score} (words: ${wordMatches})`);
        }
      }
      
      // Find language with highest score
      const detectedLang = Object.entries(languageScores)
        .filter(([lang, score]) => score > 0)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (detectedLang && detectedLang[1] > 10) {
        console.log(`✅ Detected language: ${detectedLang[0].toUpperCase()} (confidence: ${detectedLang[1]})`);
        return detectedLang[0];
      }
      
      // ✅ FALLBACK 1: Check existing captions for language clues
      const captionElements = document.querySelectorAll('.ytp-caption-segment, .captions-text');
      if (captionElements.length > 0) {
        const captionText = Array.from(captionElements).map(el => el.textContent?.trim()).join(' ').substring(0, 100);
        console.log('🔍 Found existing captions, analyzing language...');
        
        // Analyze captions with same multi-language detection
        for (const [lang, patterns] of Object.entries(languagePatterns)) {
          if (patterns.words.test(captionText)) {
            console.log(`✅ Captions detected as ${lang.toUpperCase()}`);
            return lang;
          }
        }
      }
      
      // ✅ FALLBACK 2: Check URL and browser language
      const urlParams = new URLSearchParams(window.location.search);
      let urlLang = urlParams.get('hl') || urlParams.get('lang') || navigator.language || document.documentElement.lang;
      
      console.log(`🔍 Browser/URL language: ${urlLang}`);
      
      // ✅ ENHANCED: Convert to ISO-639-1 format (Whisper supports 99+ languages)
      const languageMap = {
        // Chinese variants
        'zh-hant-tw': 'zh', 'zh-hans-cn': 'zh', 'zh-cn': 'zh', 'zh-tw': 'zh', 'zh-hk': 'zh',
        // English variants  
        'en-us': 'en', 'en-gb': 'en', 'en-au': 'en', 'en-ca': 'en',
        // European languages
        'nl-nl': 'nl', 'nl-be': 'nl',  // ✅ DUTCH SUPPORT
        'de-de': 'de', 'de-at': 'de', 'de-ch': 'de',
        'fr-fr': 'fr', 'fr-ca': 'fr', 'fr-be': 'fr',
        'es-es': 'es', 'es-mx': 'es', 'es-ar': 'es',
        'it-it': 'it', 'it-ch': 'it',
        'pt-br': 'pt', 'pt-pt': 'pt',
        'ru-ru': 'ru',
        // Asian languages
        'ja-jp': 'ja', 'ko-kr': 'ko', 'th-th': 'th', 'vi-vn': 'vi', 'hi-in': 'hi',
        // Other languages  
        'ar-sa': 'ar', 'sv-se': 'sv', 'no-no': 'no', 'da-dk': 'da', 'fi-fi': 'fi'
      };
      
      // Convert to lowercase and map
      const normalizedLang = urlLang.toLowerCase();
      const mappedLang = languageMap[normalizedLang] || normalizedLang.split('-')[0];
      
      // Validate it's a 2-letter code
      const validLang = mappedLang.length === 2 ? mappedLang : 'en';
      
      console.log(`🌍 Language detection: ${urlLang} → ${mappedLang} → ${validLang}`);
      console.log(`🎯 Final decision: Using "${validLang}" for Whisper transcription`);
      
      return validLang;
      
    } catch (error) {
      console.log('Could not detect video language, defaulting to English');
      return 'en';
    }
  }

  function fixBrokenWords(text) {
    if (!text || text.length < 2) return '';
    
    console.log('🔧 Fixing broken words in creator subtitles:', text.substring(0, 60) + '...');
    
    // Fix common broken words that YouTube captions create
    let fixed = text
      // Fix broken words with space in middle
      .replace(/\ba\s+ncient\b/gi, 'ancient')
      .replace(/\ba\s+re\b/gi, 'are') 
      .replace(/\ba\s+ll\b/gi, 'all')
      .replace(/\ba\s+mazing\b/gi, 'amazing')
      .replace(/\ba\s+bout\b/gi, 'about')
      .replace(/\ba\s+ctual\b/gi, 'actual')
      .replace(/\ba\s+nd\b/gi, 'and')
      .replace(/\ba\s+nother\b/gi, 'another')
      .replace(/\ba\s+lways\b/gi, 'always')
      .replace(/\ba\s+lready\b/gi, 'already')
      .replace(/\ba\s+lso\b/gi, 'also')
      .replace(/\ba\s+ny\b/gi, 'any')
      .replace(/\ba\s+nything\b/gi, 'anything')
      .replace(/\ba\s+nyone\b/gi, 'anyone')
      .replace(/\ba\s+nywhere\b/gi, 'anywhere')
      
      // Fix common broken contractions
      .replace(/\bwe\s+re\b/gi, "we're")
      .replace(/\bthey\s+re\b/gi, "they're")
      .replace(/\byou\s+re\b/gi, "you're")
      .replace(/\bI\s+m\b/gi, "I'm")
      .replace(/\blet\s+s\b/gi, "let's")
      .replace(/\bdon\s+t\b/gi, "don't")
      .replace(/\bcan\s+t\b/gi, "can't")
      .replace(/\bwon\s+t\b/gi, "won't")
      .replace(/\bisn\s+t\b/gi, "isn't")
      .replace(/\bwasn\s+t\b/gi, "wasn't")
      .replace(/\baren\s+t\b/gi, "aren't")
      .replace(/\bweren\s+t\b/gi, "weren't")
      .replace(/\bhadn\s+t\b/gi, "hadn't")
      .replace(/\bhaven\s+t\b/gi, "haven't")
      .replace(/\bhasn\s+t\b/gi, "hasn't")
      .replace(/\bwouldn\s+t\b/gi, "wouldn't")
      .replace(/\bshouldn\s+t\b/gi, "shouldn't")
      .replace(/\bcouldn\s+t\b/gi, "couldn't")
      .replace(/\bdoesn\s+t\b/gi, "doesn't")
      .replace(/\bdidn\s+t\b/gi, "didn't")
      
      // Fix broken "the" words
      .replace(/\bth\s+e\b/gi, 'the')
      .replace(/\bth\s+is\b/gi, 'this')
      .replace(/\bth\s+at\b/gi, 'that')
      .replace(/\bth\s+ere\b/gi, 'there')
      .replace(/\bth\s+ey\b/gi, 'they')
      .replace(/\bth\s+em\b/gi, 'them')
      .replace(/\bth\s+en\b/gi, 'then')
      .replace(/\bth\s+rough\b/gi, 'through')
      
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    if (fixed !== text) {
      console.log('✨ Fixed broken words:', fixed.substring(0, 60) + '...');
    }
    
    return fixed;
  }

  function cleanAutoGeneratedText(text) {
    if (!text || text.length < 2) return '';
    
    console.log('🧽 Minimal cleaning auto-generated text:', text.substring(0, 60) + '...');
    
    // SIMPLIFIED: Only fix essential contractions and normalize spaces
    let cleaned = text
      // Fix only the most common broken contractions
      .replace(/\bdo\s+n't\b/gi, "don't")
      .replace(/\byou\s+re\b/gi, "you're")
      .replace(/\bI\s+m\b/gi, "I'm")
      .replace(/\bI\s+ve\b/gi, "I've")
      .replace(/\bI\s+ll\b/gi, "I'll")
      .replace(/\bdoesn\s+t\b/gi, "doesn't")
      .replace(/\bit\s+s\b/gi, "it's")
      .replace(/\bthe\s+re\b/gi, "there")
      .replace(/\byou\s+ll\b/gi, "you'll")
      .replace(/\bwe\s+ve\b/gi, "we've")
      .replace(/\byou\s+ve\b/gi, "you've")
      .replace(/\bcan\s+t\b/gi, "can't")
      .replace(/\bwon\s+t\b/gi, "won't")
      .replace(/\bisn\s+t\b/gi, "isn't")
      .replace(/\bwasn\s+t\b/gi, "wasn't")
      .replace(/\baren\s+t\b/gi, "aren't")
      .replace(/\bweren\s+t\b/gi, "weren't")
      .replace(/\bhadn\s+t\b/gi, "hadn't")
      .replace(/\bhaven\s+t\b/gi, "haven't")
      .replace(/\bhasn\s+t\b/gi, "hasn't")
      .replace(/\bwouldn\s+t\b/gi, "wouldn't")
      .replace(/\bshouldn\s+t\b/gi, "shouldn't")
      .replace(/\bcouldn\s+t\b/gi, "couldn't")
      
      // Normalize whitespace only
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleaned !== text && cleaned.length > 5) {
      console.log('✨ Minimal cleaned result:', cleaned.substring(0, 60) + '...');
    }
    
    return cleaned;
  }

  function calculateSimilarity(text1, text2) {
    // Calculate text similarity using word overlap
    const words1 = text1.split(/\s+/).filter(w => w.length > 2);
    const words2 = text2.split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(w => set2.has(w)));
    
    return intersection.size / Math.max(set1.size, set2.size);
  }

  function removePhraseRepetitions(text) {
    // Enhanced phrase-level repetition removal
    const words = text.split(/\s+/);
    if (words.length < 4) return text;
    
    // Check for phrase repetitions of various lengths
    for (let phraseLen = 2; phraseLen <= Math.floor(words.length / 2); phraseLen++) {
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
    
    // Check for non-adjacent repetitions (like "every week...every week")
    for (let phraseLen = 3; phraseLen <= 8; phraseLen++) {
      for (let i = 0; i <= words.length - phraseLen; i++) {
        const phrase1 = words.slice(i, i + phraseLen).join(' ');
        
        // Look for this phrase later in the text
        for (let j = i + phraseLen + 1; j <= words.length - phraseLen; j++) {
          const phrase2 = words.slice(j, j + phraseLen).join(' ');
          
          if (phrase1.toLowerCase() === phrase2.toLowerCase()) {
            // Found non-adjacent repetition - remove the second occurrence
            const before = words.slice(0, j);
            const after = words.slice(j + phraseLen);
            console.log('🗑️ Removed non-adjacent repetition:', phrase1);
            return [...before, ...after].join(' ');
          }
        }
      }
    }
    
    return text;
  }

  function removeSentenceRepetitions(text) {
    // Remove sentence-level repetitions
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    if (sentences.length < 2) return text;
    
    const unique = [];
    for (const sentence of sentences) {
      const isDuplicate = unique.some(existing => 
        sentence.toLowerCase() === existing.toLowerCase() ||
        (sentence.length > 10 && existing.includes(sentence.toLowerCase())) ||
        (existing.length > 10 && sentence.toLowerCase().includes(existing.toLowerCase()))
      );
      
      if (!isDuplicate) {
        unique.push(sentence);
      } else {
        console.log('🗑️ Removed sentence repetition:', sentence.substring(0, 30) + '...');
      }
    }
    
    return unique.join('. ') + (unique.length > 0 && !text.match(/[.!?]$/) ? '.' : '');
  }

  function masterCleanupSegments(segments) {
    // Master cleanup function for final processing
    console.log('🧹 Running master cleanup on', segments.length, 'segments');
    
    if (!segments || segments.length === 0) return [];
    
    // Step 1: Clean individual segments
    let cleaned = segments.map(segment => ({
      ...segment,
      text: cleanAutoGeneratedText(segment.text)
    })).filter(segment => segment.text && segment.text.length > 5);
    
    // Step 2: Remove duplicates based on text similarity
    const unique = [];
    for (const segment of cleaned) {
      const isDuplicate = unique.some(existing => 
        calculateSimilarity(segment.text.toLowerCase(), existing.text.toLowerCase()) > 0.85
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

  function masterCleanAutoGeneratedSegment(text) {
    // SIMPLIFIED: Basic cleaning only to prevent over-processing
    console.log('🧽 Basic cleaning segment:', text.substring(0, 50) + '...');
    
    if (!text || text.length < 3) return '';
    
    // Just use the basic clean function - no multiple passes
    const cleaned = cleanAutoGeneratedText(text);
    
    if (cleaned !== text) {
      console.log('✨ Basic clean result:', cleaned.substring(0, 50) + '...');
    }
    
    return cleaned;
  }

  function removeAdvancedRepetitions(text) {
    // More advanced repetition removal
    let words = text.split(/\s+/);
    
    // First pass: Remove exact phrase repetitions like "every week every week"
    for (let len = 1; len <= 6; len++) {
      let i = 0;
      while (i <= words.length - len * 2) {
        const pattern1 = words.slice(i, i + len).join(' ');
        const pattern2 = words.slice(i + len, i + len * 2).join(' ');
        
        if (pattern1.toLowerCase() === pattern2.toLowerCase() && pattern1.trim().length > 0) {
          words.splice(i + len, len); // Remove the duplicate
          console.log('🗑️ Removed exact repetition:', pattern1);
          // Don't increment i, check the same position again
        } else {
          i++;
        }
      }
    }
    
    // Second pass: Remove cascading repetitions within the text
    let cleanText = words.join(' ');
    
    // Handle specific patterns from user examples
    cleanText = cleanText
      .replace(/\b(every\s+week)\s+\1\b/gi, '$1')
      .replace(/\b(meaningful\s+revenue)\s+\1\b/gi, '$1')
      .replace(/\b(have\s+smaller)\s+\1\b/gi, '$1')
      .replace(/\b(value\s+density)\s+\1\b/gi, '$1')
      .replace(/\b(\w+)\s+\1\s+\1\b/gi, '$1') // Triple repetitions
      .replace(/\b(\w+\s+\w+)\s+\1\b/gi, '$1') // Phrase repetitions
      .replace(/\b(\w+)\s+\1\b/gi, '$1') // Single word repetitions
      // Clean up fragments like "on. on."
      .replace(/\b(\w+)\.?\s+\1\.?\b/gi, '$1')
      // Clean incomplete fragments like "who who", "where it's like come you"
      .replace(/\b(who|what|where|when|how)\s+\1\b/gi, '$1')
      .replace(/\bcome\s+you\b/gi, 'come on')
      .replace(/\blike\s+come\s+you\b/gi, 'like, you know')
      // Remove trailing incomplete words
      .replace(/\s+(on\.?\s*)+$/gi, '')
      .replace(/\s+(you\.?\s*)+$/gi, '')
      .trim();
    
    return cleanText;
  }

  function cleanFragments(text) {
    // Clean up common fragment patterns with enhanced detection
    return text
      .replace(/\b(\w+)\s+\1\s*$/g, '$1') // Remove end repetitions
      .replace(/^(\w+)\s+\1\b/g, '$1') // Remove start repetitions
      .replace(/\b(\w+)\.\s*\1\.?/g, '$1.') // Fix "word. word." -> "word."
      .replace(/\b(by|who|what|how|when|where)\s+\1\b/gi, '$1') // Remove question word repetitions
      // Enhanced fragment cleanup for user-reported issues
      .replace(/\bwhere\s+it's\s+like\s+come\s+you\b/gi, 'where it comes from')
      .replace(/\bon\.\s*on\.\s*/gi, 'on. ')
      .replace(/\bwho\s+who\b/gi, 'who')
      .replace(/\bthe\s+the\b/gi, 'the')
      .replace(/\band\s+and\b/gi, 'and')
      .replace(/\bof\s+of\b/gi, 'of')
      .replace(/\bin\s+in\b/gi, 'in')
      .replace(/\bto\s+to\b/gi, 'to')
      .replace(/\bis\s+is\b/gi, 'is')
      .replace(/\bwith\s+with\b/gi, 'with')
      // Clean up split contractions and incomplete words
      .replace(/\bi\s+m\b/gi, "I'm")
      .replace(/\byou\s+re\b/gi, "you're")
      .replace(/\bwe\s+re\b/gi, "we're")
      .replace(/\bthey\s+re\b/gi, "they're")
      .replace(/\bdon\s+t\b/gi, "don't")
      .replace(/\bcan\s+t\b/gi, "can't")
      .replace(/\bwon\s+t\b/gi, "won't")
      .replace(/\bisn\s+t\b/gi, "isn't")
      .replace(/\baren\s+t\b/gi, "aren't")
      .replace(/\bwasn\s+t\b/gi, "wasn't")
      .replace(/\bweren\s+t\b/gi, "weren't")
      .replace(/\bhasn\s+t\b/gi, "hasn't")
      .replace(/\bhaven\s+t\b/gi, "haven't")
      .replace(/\bhadn\s+t\b/gi, "hadn't")
      // Clean trailing/leading fragments
      .replace(/\s+(\w+)\s*$/, ' $1') // Clean trailing spaces
      .replace(/^(\w+)\s+/, '$1 ') // Clean leading spaces
      .replace(/^\w\s+/, '') // Remove single letters at start
      .replace(/\s+\w$/, '') // Remove single letters at end
      .trim();
  }

  function finalPolish(text) {
    // Final polishing pass
    return text
      .replace(/\s+/g, ' ') // Final space normalization
      .replace(/\s*([.!?])\s*/g, '$1 ') // Fix punctuation spacing
      .replace(/([.!?])\s*$/, '$1') // Clean end punctuation
      .replace(/^\s*(.+?)\s*$/, '$1') // Trim
      // Ensure proper capitalization
      .replace(/^./, str => str.toUpperCase())
      // Add period if needed
      .replace(/^(.{15,}[^.!?])$/, '$1.');
  }

  async function startCaptionCollection(chunkDuration = 45, subtitleMode = 'with-subtitles', whisperSettings = {}) {
    if (captionCollection.isCollecting) {
      console.log('📡 HYBRID Caption collection already in progress');
      return;
    }
    
    // ✅ NEW: Apply user's Whisper timing settings
    const defaultWhisperSettings = {
      chunkDuration: 8,
      chunkGap: 3,
      sentenceGrouping: 'medium',
      languageOverride: 'auto'
    };
    const finalWhisperSettings = { ...defaultWhisperSettings, ...whisperSettings };
    
    console.log(`🚀 HYBRID Starting caption collection with ${chunkDuration}s chunks in ${subtitleMode} mode...`);
    console.log('⚙️ Whisper settings applied:', finalWhisperSettings);
    
    // Store user's subtitle mode choice
    captionCollection.userSubtitleMode = subtitleMode;
    
    // ✅ NEW: Apply Whisper settings to collection state
    if (subtitleMode === 'without-subtitles') {
      captionCollection.whisper.chunkDuration = finalWhisperSettings.chunkDuration;
      captionCollection.whisper.chunkGap = finalWhisperSettings.chunkGap;
      captionCollection.whisper.sentenceGrouping = finalWhisperSettings.sentenceGrouping;
      captionCollection.whisper.languageOverride = finalWhisperSettings.languageOverride;
      
      console.log(`🎙️ Whisper configured: ${finalWhisperSettings.chunkDuration}s chunks, ${finalWhisperSettings.chunkGap}s gap, language: ${finalWhisperSettings.languageOverride}`);
    }
    
    captionCollection.isCollecting = true;
    captionCollection.startTime = Date.now();
    
    // ✅ FIX: Initialize Whisper immediately when user selects Whisper mode
    if (subtitleMode === 'without-subtitles') {
      console.log('🎙️ User selected Whisper mode - initializing audio capture immediately...');
      
      // Reset Whisper state for fresh start
      captionCollection.whisper.initializationAttempted = true;
      captionCollection.whisperFallback = false;
      
      try {
        const whisperInitialized = await initializeAudioCapture();
        
        if (whisperInitialized) {
          console.log('✅ Whisper initialized successfully for user-selected mode');
          console.log('🎵 Audio stream ready, will start recording when collection begins');
        } else {
          console.log('❌ Whisper initialization failed - user will need to grant microphone permissions');
          captionCollection.whisperFallback = true;
        }
      } catch (error) {
        console.error('❌ Error initializing Whisper:', error);
        console.log('💡 Make sure to allow microphone access when prompted');
        captionCollection.whisperFallback = true;
      }
    } else {
      console.log('✅ Smart hybrid mode: Manual captions → Direct processing, Auto captions → Whisper transcription');
    }
    
    // ✅ FIX: Don't reset segments - keep accumulating from previous collections
    // captionCollection.segments = []; // ❌ This was resetting all previous collections!
    console.log(`📊 CONTINUING COLLECTION: ${captionCollection.segments.length} existing segments`);
    
    captionCollection.lastCaptionTime = 0;
    captionCollection.lastCaptionText = ''; // Track last text to avoid duplicates
    
    // ✅ NEW: Set chunk duration from UI
    captionCollection.chunkDurationThreshold = chunkDuration;
    
    // ✅ NEW: Initialize chunk tracking for automatic chunking
    const player = document.querySelector('#movie_player');
    if (player && player.getCurrentTime) {
      captionCollection.currentChunkStartTime = player.getCurrentTime();
      const mins = Math.floor(captionCollection.currentChunkStartTime / 60);
      const secs = Math.floor(captionCollection.currentChunkStartTime % 60);
      captionCollection.currentChunkStartTimestamp = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    captionCollection.chunkCounter = 0;
    captionCollection.lastCollectedTimestamp = captionCollection.currentChunkStartTime;
    
    // ✅ DEBUG: Log initialization values
    console.log('🚀 COLLECTION INITIALIZED:', {
      startTime: captionCollection.currentChunkStartTime,
      lastCollectedTimestamp: captionCollection.lastCollectedTimestamp,
      timeSegmentThreshold: captionCollection.timeSegmentThreshold,
      chunkDurationThreshold: captionCollection.chunkDurationThreshold
    });
    
    // Check for caption availability and enable if needed
    const ccButton = document.querySelector('.ytp-subtitles-button, .ytp-menuitem[aria-label*="Captions"], button[aria-label*="Captions"]');
    const ccButtonPressed = ccButton?.getAttribute('aria-pressed') === 'true';
    // Check for subtitle tracks - fix invalid selector
    const hasSubtitleTracks = document.querySelector('track[kind="subtitles"], track[kind="captions"]') || 
                             document.querySelector('[data-language-code]');
    
    // Check for English language option by finding menuitem labels containing "English"
    let hasEnglishOption = false;
    const menuItemLabels = document.querySelectorAll('.ytp-menuitem-label');
    for (const label of menuItemLabels) {
      if (label.textContent && label.textContent.toLowerCase().includes('english')) {
        hasEnglishOption = true;
        break;
      }
    }
    
    console.log('🔍 Caption availability check:', {
      ccButtonExists: !!ccButton,
      ccButtonPressed: ccButtonPressed,
      hasSubtitleTracks: !!hasSubtitleTracks,
      hasEnglishOption: hasEnglishOption,
      ccButtonTitle: ccButton?.getAttribute('title') || ccButton?.getAttribute('aria-label')
    });
    
    if (ccButton && !ccButtonPressed) {
      console.log('🔘 HYBRID Enabling captions...');
      ccButton.click();
      
      // Wait longer for captions to load and check multiple times
      setTimeout(() => {
        const captionCheck = document.querySelectorAll('.ytp-caption-segment, .captions-text, .caption-visual-line, .ytp-caption-window-container span, .caption-window span');
        console.log('📺 HYBRID Caption elements after enabling (2s):', captionCheck.length);
        
        // If still no captions, try a different approach
        if (captionCheck.length === 0) {
          console.log('🔄 No captions found, trying alternative approach...');
          
          // Try clicking settings and looking for subtitle options
          const settingsButton = document.querySelector('.ytp-settings-button');
          if (settingsButton) {
            settingsButton.click();
            setTimeout(() => {
              const subtitleOptions = document.querySelectorAll('.ytp-menuitem-label');
              console.log('⚙️ Available subtitle options:', Array.from(subtitleOptions).map(el => el.textContent));
              
              // Close settings menu
              if (settingsButton) settingsButton.click();
            }, 500);
          }
        }
      }, 2000);
    } else if (!ccButton) {
      console.log('⚠️ No CC button found - this video may not have captions available');
    }
    
    // ✅ FIX: Skip caption monitoring entirely in Whisper mode
    if (subtitleMode === 'without-subtitles') {
      console.log('🎙️ Whisper mode: Skipping caption monitoring, starting audio-only collection');
      
      // Start audio recording immediately for Whisper mode
      const whisper = captionCollection.whisper;
      if (whisper.audioStream && !whisper.isRecording) {
        console.log('🎵 Starting continuous audio recording for Whisper...');
        startContinuousAudioRecording();
      }
      
      return; // Exit early - no caption monitoring needed
    }
    
    // Start monitoring with enhanced selectors (only for caption-based modes)
    captionCollection.interval = setInterval(async () => {
      // ✅ PERFORMANCE: Skip expensive DOM operations during active Whisper recording
      if (captionCollection.whisper && captionCollection.whisper.isRecording) {
        return; // Don't compete with audio processing
      }
      
      // ✅ OPTIMIZED: Simplified and faster caption detection for better performance during Whisper recording
      let captionElements = [];
      
      // Try most common selectors first (fastest path)
      const commonSelectors = [
        '.ytp-caption-segment',
        '.captions-text', 
        '.caption-visual-line'
      ];
      
      for (const selector of commonSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          captionElements = Array.from(elements);
          break; // Use first successful match, avoid complex queries
        }
      }
      
      // Only if no common captions found, try fallback (less frequent)
      if (captionElements.length === 0 && Math.random() < 0.3) { // Only 30% of the time
        const fallbackElements = document.querySelectorAll('.ytp-caption-window-container span, .html5-captions-text');
        captionElements = Array.from(fallbackElements);
      }
      
      // Quick filtering - avoid expensive .closest() calls
      captionElements = captionElements.filter(el => {
        const text = el.textContent?.trim() || '';
        // Skip UI text patterns
        if (text.includes('音軌') || 
            text.includes('字幕') ||
            text.includes('自動') ||
            text.includes('1080p') ||
            text.includes('HD') ||
            text.includes('資訊') ||
            text.includes('購物') ||
            text.includes('向上拉即可跳轉') ||
            text.match(/^\d+:\d+\s*\/\s*\d+:\d+$/) ||
            text.match(/^\(\d+\)$/)) {
          return false;
        }
        
        return text.length > 2; // Allow shorter text for manual subtitles
      });
      
      // Debug logging every 5 seconds
      if (Date.now() % 5000 < 1000) {
        const ccButton = document.querySelector('.ytp-subtitles-button');
        const allFound = document.querySelectorAll('.ytp-caption-segment, .captions-text, .caption-visual-line, .ytp-caption-window-container span, .caption-window span, .html5-captions-text, [class*="caption"], [class*="subtitle"]');
        
        console.log('🔍 HYBRID Caption status:', {
          elementsFound: captionElements.length,
          allElementsFound: allFound.length,
          ccButtonPressed: ccButton?.getAttribute('aria-pressed'),
          ccButtonExists: !!ccButton,
          ccButtonTitle: ccButton?.getAttribute('title') || ccButton?.getAttribute('aria-label'),
          collecting: captionCollection.isCollecting,
          segmentsCollected: captionCollection.segments.length,
          videoPlaying: !document.querySelector('#movie_player')?.paused,
          hasManualSubtitles: document.querySelector('[data-language-code]') ? true : false
        });
        
        if (allFound.length > 0) {
          console.log('🔍 All caption elements found:');
          allFound.forEach((el, i) => {
            if (i < 5) { // Show first 5 elements
              console.log(`  ${i+1}. ${el.className} - "${el.textContent?.trim().substring(0, 50)}"`);
            }
          });
        }
        
        if (captionElements.length > 0) {
          const rawText = Array.from(captionElements).map(el => el.textContent?.trim()).join(' ').substring(0, 100);
          const cleanedPreview = rawText
            .replace(/資訊\s*購物\s*/g, '')
            .replace(/向上拉即可跳轉至精確的時間點/g, '')
            .replace(/Turning the Outline Into a Presentation \(Quick & Dirty\).*?•/g, '')
            .replace(/\d{1,2}:\d{2}\s*•/g, '')
            .trim().substring(0, 80);
          console.log('📺 Raw caption text:', rawText);
          console.log('🧹 Cleaned preview:', cleanedPreview);
        }
      }
      
      if (captionElements.length > 0) {
        // Reduced logging frequency to improve performance during Whisper recording
        if (Math.random() < 0.2) { // Only log 20% of the time
          console.log(`🔍 Found ${captionElements.length} caption elements in ${captionCollection.userSubtitleMode} mode`);
        }
        const player = document.querySelector('#movie_player');
        const currentTime = player && player.getCurrentTime ? player.getCurrentTime() : 0;
        
        // ✅ OPTIMIZED: Faster text processing with less memory allocation
        let currentText = '';
        let maxLength = 0;
        
        // Find the longest text directly without creating intermediate arrays
        for (const el of captionElements) {
          const text = el.textContent?.trim();
          if (text && text.length > 3 && text.length > maxLength) {
            // Simple duplicate check - just avoid exact matches
            if (text !== currentText) {
              currentText = text;
              maxLength = text.length;
            }
          }
        }
        
        console.log('🔍 Selected caption text:', currentText.substring(0, 50) + '...');
          
        console.log('🔍 Final text for processing:', currentText);
        
        // ✅ FIX: Only clean if NOT in creator subtitles mode
        if (captionCollection.userSubtitleMode !== 'with-subtitles') {
          // Enhanced cleaning for better learning experience (only for auto-detect/no-subtitles)
          currentText = currentText
            .replace(/資訊\s*購物\s*/g, '') // Remove "Info Shopping" 
            .replace(/向上拉即可跳轉至精確的時間點/g, '') // Remove swipe instruction
            .replace(/dictate\.\s*Whoops\./g, '') // Remove "dictate. Whoops."
            .replace(/^\s*•\s*/, '') // Remove bullet points at start
            .replace(/音軌\s*\(\d+\)/g, '') // Remove track info
            .replace(/字幕\s*\(\d+\)/g, '') // Remove subtitle info  
            .replace(/自動\s*\(.*?\)/g, '') // Remove auto info
            .replace(/\d+p\s*HD/g, '') // Remove quality info
            .replace(/\d+:\d+\s*\/\s*\d+:\d+/g, '') // Remove time progress
            .replace(/觀看完整影.*?/g, '') // Remove view full video text
            .replace(/\(\d+\)/g, '') // Remove number indicators
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        } else {
          // ✅ Creator subtitles: fix broken words but preserve quality
          currentText = fixBrokenWords(currentText);
          console.log('📝 Creator subtitles mode: broken word fixing applied');
        }
        
        // Extract and preserve any embedded timestamps for learning purposes
        const timestampMatches = currentText.match(/\d{1,2}:\d{2}/g);
        let extractedTimestamp = null;
        let timestampInSeconds = currentTime;
        
        if (timestampMatches && timestampMatches.length > 0) {
          // Use the first timestamp found as reference
          extractedTimestamp = timestampMatches[0];
          const [minutes, seconds] = extractedTimestamp.split(':').map(Number);
          timestampInSeconds = (minutes * 60) + seconds;
          console.log('📌 Found embedded timestamp for learning:', extractedTimestamp, '→', timestampInSeconds, 'seconds');
        } else {
          // ✅ FIX: Enhanced current time detection with multiple methods
          const player = document.querySelector('#movie_player');
          let currentVideoTime = currentTime; // Use the currentTime from outer scope
          
          // Try multiple methods to get current video time
          if (player) {
            if (typeof player.getCurrentTime === 'function') {
              try {
                currentVideoTime = player.getCurrentTime();
              } catch (e) {
                console.log('❌ player.getCurrentTime failed:', e.message);
              }
            }
            
            // Fallback: try video element directly
            if (!currentVideoTime || currentVideoTime === 0) {
              const video = player.querySelector('video');
              if (video && typeof video.currentTime === 'number') {
                currentVideoTime = video.currentTime;
              }
            }
          }
          
          // ✅ FIX: Always ensure we have a valid timestamp
          timestampInSeconds = currentVideoTime || 0;
          const mins = Math.floor(timestampInSeconds / 60);
          const secs = Math.floor(timestampInSeconds % 60);
          extractedTimestamp = `${mins}:${secs.toString().padStart(2, '0')}`;
          
          console.log('🕐 Using video time:', extractedTimestamp, '(', timestampInSeconds, 'seconds)');
        }
        
        // ✅ FIX: Enhanced text filtering to prevent repetitive content
        if (currentText && 
            currentText.length > 5 && // Lower threshold for manual subtitles
            currentText !== captionCollection.lastCaptionText) {
          
          // ✅ FIX: More aggressive deduplication - check last 5 segments with lower threshold
          const isUnique = captionCollection.segments.length === 0 || 
            !captionCollection.segments.slice(-5).some(segment => {
              const similarity = calculateTextSimilarity(currentText.toLowerCase(), segment.text.toLowerCase());
              return similarity > 0.7; // ✅ Lower threshold - reject more similar content
            });
          
          // ✅ FIX: Additional check - reject if text is mostly contained in recent segments
          const isNotSubstring = captionCollection.segments.length === 0 ||
            !captionCollection.segments.slice(-3).some(segment => {
              const segText = segment.text.toLowerCase();
              const currText = currentText.toLowerCase();
              return segText.includes(currText) || currText.includes(segText);
            });
          
          if (isUnique && isNotSubstring) {
            // ✅ FIX: Enhanced time gap detection for proper segment creation
            const timeGap = Math.abs(timestampInSeconds - captionCollection.lastCollectedTimestamp);
            const isSignificantTimeGap = timeGap > captionCollection.timeSegmentThreshold;
            
            // ✅ FIX: Additional check - if user jumped backwards or forwards significantly
            const isUserJump = timeGap > 5 && captionCollection.segments.length > 0; // Any gap > 5s is likely a user jump
            
            // ✅ DEBUG: Enhanced logging for time gap detection
            if (captionCollection.segments.length > 0) {
              console.log(`⏱️ TIME GAP CHECK: Current=${timestampInSeconds.toFixed(1)}s, Last=${captionCollection.lastCollectedTimestamp.toFixed(1)}s, Gap=${timeGap.toFixed(1)}s, Threshold=${captionCollection.timeSegmentThreshold}s`);
              console.log(`🔍 Gap Analysis: isSignificant=${isSignificantTimeGap}, isUserJump=${isUserJump}, willCreateSegment=${isSignificantTimeGap || isUserJump}`);
            }
            
            // ✅ FIX: Better chunk duration calculation - prevent division issues and improve logic
            let chunkDuration = 0;
            let isNewChunk = false;
            
            if (captionCollection.currentChunkStartTime !== undefined && 
                !isNaN(captionCollection.currentChunkStartTime) && 
                !isNaN(timestampInSeconds)) {
              chunkDuration = Math.abs(timestampInSeconds - captionCollection.currentChunkStartTime);
              
              // ✅ Enhanced chunking logic for auto-generated captions
              const effectiveChunkThreshold = captionCollection.autoGenerated ? 
                Math.max(captionCollection.chunkDurationThreshold, 25) : // Min 25s for auto-generated
                captionCollection.chunkDurationThreshold;
              
              isNewChunk = chunkDuration > effectiveChunkThreshold && 
                          captionCollection.segments.length > 0 && 
                          !isSignificantTimeGap; // Don't create chunk if already creating new segment
              
              // Note: Old stream buffer logic removed - now handled by time-window system
            }
            
            // ✅ FIX: Create new segment when user jumps to different section
            if ((isSignificantTimeGap || isUserJump) && captionCollection.segments.length > 0) {
              const lastTime = Math.floor(captionCollection.lastCollectedTimestamp);
              const lastMins = Math.floor(lastTime / 60);
              const lastSecs = lastTime % 60;
              const lastTimeStr = `${lastMins}:${lastSecs.toString().padStart(2, '0')}`;
              console.log(`🕐 USER JUMP detected: ${Math.floor(timeGap)}s gap (${lastTimeStr} → ${extractedTimestamp}) - Creating new segment group`);
              
              // Mark this as start of new time segment group
              captionCollection.chunkCounter = 0;
              captionCollection.currentChunkStartTime = timestampInSeconds;
              captionCollection.currentChunkStartTimestamp = extractedTimestamp;
              
            } else if (isNewChunk && chunkDuration > 0) {
              const thresholdUsed = captionCollection.autoGenerated ? 
                Math.max(captionCollection.chunkDurationThreshold, 25) :
                captionCollection.chunkDurationThreshold;
              console.log(`📦 AUTO-CHUNK: Duration ${Math.floor(chunkDuration)}s exceeded threshold ${thresholdUsed}s - Creating new chunk at ${extractedTimestamp}`);
              if (captionCollection.autoGenerated) {
                console.log('🤖 Auto-generated caption chunk created with enhanced processing');
              }
              captionCollection.chunkCounter++;
              captionCollection.currentChunkStartTime = timestampInSeconds;
              captionCollection.currentChunkStartTimestamp = extractedTimestamp;
            }
            
            // Get current video info for creating YouTube links
            const videoId = extractVideoId();
            console.log('🆔 Video ID extracted:', videoId, 'from URL:', window.location.href);
            const youtubeLink = videoId ? `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestampInSeconds)}s` : '#';
            console.log('🔗 Generated YouTube link:', youtubeLink);
            
            // ✅ SIMPLIFIED: Route based on user's clear choice (only 2 modes)
            const userMode = captionCollection.userSubtitleMode;
            
            if (userMode === 'with-subtitles') {
              // User selected: Creator subtitles mode - use original fast method
              console.log('📝 User selected: Creator subtitles mode - using original processing');
              console.log('📝 Processing manual caption:', {
                text: currentText.substring(0, 50) + '...',
                timestampInSeconds: timestampInSeconds,
                extractedTimestamp: extractedTimestamp,
                textLength: currentText.length
              });
              processManualCaption(currentText, timestampInSeconds, extractedTimestamp, videoId, youtubeLink, isNewChunk);
              
            } else if (userMode === 'without-subtitles') {
              // User selected: Whisper transcription mode
              console.log('🎙️ User selected: Whisper transcription mode - processing audio');
              if (!captionCollection.whisperFallback) {
                // ✅ FIX: Start audio recording immediately for Whisper mode
                const whisper = captionCollection.whisper;
                
                // Start recording if not already recording
                if (whisper.audioStream && !whisper.isRecording) {
                  console.log('🎵 Starting audio recording for Whisper transcription...');
                  startNewAudioChunk(timestampInSeconds, extractedTimestamp);
                }
                
                // Process the timestamp for audio chunking
                await processWhisperTimestamp(timestampInSeconds, extractedTimestamp, videoId, youtubeLink, isNewChunk);
              } else {
                console.log('❌ Whisper unavailable - microphone permissions may be needed');
                console.log('💡 Try refreshing the page and grant microphone permissions when prompted');
                captionCollection.lastCollectedTimestamp = timestampInSeconds;
              }
              
            } else {
              // Fallback to creator subtitles if mode is unrecognized
              console.log('⚠️ Unknown subtitle mode, defaulting to creator subtitles processing');
              processManualCaption(currentText, timestampInSeconds, extractedTimestamp, videoId, youtubeLink, isNewChunk);
            }
            
            captionCollection.lastCaptionTime = timestampInSeconds;
            captionCollection.lastCaptionText = currentText;
            captionCollection.lastCollectedTimestamp = timestampInSeconds;
            
            console.log(`✅ HYBRID Collected [${extractedTimestamp}]:`, currentText.substring(0, 50) + '...');
            if (isSignificantTimeGap || isUserJump) {
              console.log(`  🎯 NEW SEGMENT: Time gap ${Math.floor(timeGap)}s → ${extractedTimestamp}`);
            }
            if (isNewChunk) {
              console.log(`  📦 NEW CHUNK #${captionCollection.chunkCounter}: ${extractedTimestamp}`);
            }
            console.log(`  📊 Total segments: ${captionCollection.segments.length}`);
          } else {
            // ✅ FIX: Better logging for rejected content
            if (!isUnique) {
              console.log('🚫 HYBRID Rejected (too similar):', currentText.substring(0, 30) + '...');
            } else if (!isNotSubstring) {
              console.log('🚫 HYBRID Rejected (substring):', currentText.substring(0, 30) + '...');
            }
          }
        } else {
          // Debug why text was rejected
          if (!currentText) {
            console.log('❌ HYBRID No text after cleaning');
          } else if (currentText.length <= 3) {
            console.log('❌ HYBRID Text too short after cleaning:', currentText.length, 'chars:', currentText);
          } else if (currentText === captionCollection.lastCaptionText) {
            console.log('❌ HYBRID Same text as before:', currentText.substring(0, 30));
          }
        }
      }
    }, 2500); // ✅ PERFORMANCE: Reduced frequency during Whisper recording (was 1000ms)
  }

  function stopCaptionCollection() {
    if (!captionCollection || !captionCollection.isCollecting) {
      return { segments: [], duration: 0 };
    }
    
    console.log('🛑 HYBRID Stopping Whisper-based collection...');
    captionCollection.isCollecting = false;
    
    // ✅ NEW: Clean up Whisper resources
    const whisper = captionCollection.whisper;
    
    // Finalize any ongoing audio recording
    if (whisper.isRecording && whisper.mediaRecorder) {
      console.log('📦 Finalizing remaining audio chunk before stopping...');
      finalizeCurrentAudioChunk(Date.now() / 1000);
    }
    
    // Stop and clean up audio stream
    if (whisper.audioStream) {
      whisper.audioStream.getTracks().forEach(track => {
        track.stop();
        console.log('🔇 Stopped audio track');
      });
      whisper.audioStream = null;
    }
    
    // ✅ NEW: Stop audio monitoring to prevent tab freezing
    if (whisper.stopAudioMonitoring) {
      whisper.stopAudioMonitoring();
      whisper.stopAudioMonitoring = null;
      console.log('🛑 Audio monitoring stopped');
    }
    
    // ✅ CRITICAL: Clean up Web Audio API resources to prevent conflicts on re-recording
    if (whisper.audioContext) {
      try {
        // Disconnect audio nodes
        if (whisper.audioSource) {
          whisper.audioSource.disconnect();
          whisper.audioSource = null;
          console.log('🔌 Disconnected audio source');
        }
        if (whisper.analyserNode) {
          whisper.analyserNode.disconnect();
          whisper.analyserNode = null;
          console.log('📊 Disconnected analyser node');
        }
        // Close audio context
        whisper.audioContext.close().then(() => {
          console.log('🔇 Closed audio context');
        }).catch(err => {
          console.log('⚠️ Error closing audio context:', err.message);
        });
        whisper.audioContext = null;
      } catch (error) {
        console.log('⚠️ Error cleaning up audio context:', error.message);
      }
    }
    
    // ✅ CRITICAL: Clear any pending timers to prevent conflicts on re-recording
    if (whisper.chunkTimer) {
      clearTimeout(whisper.chunkTimer);
      whisper.chunkTimer = null;
      console.log('⏰ Cleared chunk timer');
    }
    if (whisper.emergencyStopTimer) {
      clearTimeout(whisper.emergencyStopTimer);
      whisper.emergencyStopTimer = null;
      console.log('⏰ Cleared emergency stop timer');
    }
    if (whisper.gapTimer) {
      clearTimeout(whisper.gapTimer);
      whisper.gapTimer = null;
      console.log('⏰ Cleared gap timer');
    }
    if (whisper.autoStopTimer) {
      clearTimeout(whisper.autoStopTimer);
      whisper.autoStopTimer = null;
      console.log('⏰ Cleared auto-stop timer');
    }
    if (whisper.monitoringInitTimer) {
      clearTimeout(whisper.monitoringInitTimer);
      whisper.monitoringInitTimer = null;
      console.log('⏰ Cleared monitoring init timer');
    }
    
    // ✅ CRITICAL FIX: Clear periodic memory cleanup timer
    if (whisper.memoryCleanupTimer) {
      clearInterval(whisper.memoryCleanupTimer);
      whisper.memoryCleanupTimer = null;
      console.log('⏰ Cleared memory cleanup timer');
    }
    
    // ✅ CRITICAL: Reset Whisper state and clear all memory leaks
    whisper.mediaRecorder = null;
    whisper.audioChunks = [];
    whisper.isRecording = false;
    whisper.initializationAttempted = false;
    
    // ✅ CRITICAL FIX: Clear memory leak sources
    whisper.pendingTranscriptions.clear();
    whisper.processedTimeRanges = [];
    console.log('🧹 CRITICAL: Cleared pending transcriptions and processed ranges');
    
    // ✅ CRITICAL FIX: Force garbage collection hint
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
      console.log('🗑️ Triggered garbage collection');
    }
    
    if (captionCollection.interval) {
      clearInterval(captionCollection.interval);
      captionCollection.interval = null;
    }
    
    const duration = (Date.now() - captionCollection.startTime) / 1000;
    let segments = [...captionCollection.segments];
    
    console.log(`✅ HYBRID Collection complete: ${segments.length} segments in ${duration}s`);
    
    // Apply master cleanup for auto-generated captions
    if (captionCollection.autoGenerated && segments.length > 0) {
      console.log('🤖 Applying master cleanup for auto-generated captions');
      segments = masterCleanupSegments(segments);
    }
    
    return { segments, duration };
  }

  async function downloadCompleteTranscript(videoId) {
    console.log('📥 HYBRID Attempting direct transcript download for:', videoId);
    
    try {
      // Method 1: Try to get caption tracks from page data
      const captionTracks = await getYouTubeCaptionTracks();
      console.log('🔍 Caption tracks search result:', captionTracks);
      
      if (captionTracks && captionTracks.length > 0) {
        console.log('🎯 Found', captionTracks.length, 'caption tracks:', captionTracks.map(t => ({
          language: t.languageCode,
          name: t.name?.simpleText,
          isAsr: t.vssId?.includes('.asr')
        })));
        
        // Try each track until we get a complete transcript
        for (const track of captionTracks) {
          const transcript = await downloadFromCaptionTrack(track);
          if (transcript && transcript.length > 0) {
            console.log('✅ Downloaded complete transcript from track:', track.languageCode);
            return transcript;
          }
        }
        console.log('❌ All caption tracks failed to download');
      } else {
        console.log('❌ No caption tracks found in page data');
      }

      // Method 2: Try YouTube's timedtext API directly
      console.log('🔄 Trying timedtext API...');
      const timedTextTranscript = await tryTimedTextAPI(videoId);
      if (timedTextTranscript && timedTextTranscript.length > 0) {
        console.log('✅ Downloaded via timedtext API');
        return timedTextTranscript;
      } else {
        console.log('❌ Timedtext API failed');
      }

      // Method 3: Don't fall back to metadata immediately - return null instead
      console.log('❌ All direct download methods failed');
      return null;
      
    } catch (error) {
      console.error('❌ Direct download failed:', error);
      return null;
    }
  }

  async function getYouTubeCaptionTracks() {
    // Try multiple sources for caption track information
    const sources = [
      () => window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks,
      () => window.ytplayer?.config?.args?.player_response && JSON.parse(window.ytplayer.config.args.player_response)?.captions?.playerCaptionsTracklistRenderer?.captionTracks,
      () => {
        // Search in page scripts
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          if (script.textContent?.includes('captionTracks')) {
            const match = script.textContent.match(/"captionTracks":\s*(\[[^\]]*\])/);
            if (match) {
              try {
                return JSON.parse(match[1]);
              } catch (e) {
                continue;
              }
            }
          }
        }
        return null;
      }
    ];

    for (const getSource of sources) {
      try {
        const tracks = getSource();
        if (tracks && tracks.length > 0) {
          // Prioritize auto-generated tracks as they're more likely to be complete
          return tracks.sort((a, b) => {
            if (a.vssId?.includes('.asr') && !b.vssId?.includes('.asr')) return -1;
            if (!a.vssId?.includes('.asr') && b.vssId?.includes('.asr')) return 1;
            return 0;
          });
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  async function downloadFromCaptionTrack(track) {
    if (!track.baseUrl) return null;

    console.log('📡 Downloading from track:', track.name?.simpleText || track.languageCode);

    try {
      // Try different URL formats
      const urls = [
        track.baseUrl,
        track.baseUrl + '&fmt=srv3',
        track.baseUrl + '&fmt=json3',
        track.baseUrl + '&fmt=vtt',
        track.baseUrl.replace(/&caps=.*?(&|$)/, '$1'),
        track.baseUrl + '&tlang=en' // Try with translation
      ];

      for (const url of urls) {
        try {
          console.log('🌐 Trying URL format...');
          const response = await fetch(url, {
            credentials: 'same-origin',
            headers: {
              'Accept': 'application/xml, text/xml, text/plain, application/json'
            }
          });

          if (response.ok) {
            const content = await response.text();
            if (content && content.trim().length > 100) { // Must be substantial content
              console.log('✅ Got substantial response:', content.length, 'characters');
              
              // Try to parse as XML first
              const xmlTranscript = parseXMLTranscript(content);
              if (xmlTranscript && xmlTranscript.length > 0) {
                return xmlTranscript;
              }

              // Try to parse as JSON
              try {
                const jsonData = JSON.parse(content);
                const jsonTranscript = parseJSONTranscript(jsonData);
                if (jsonTranscript && jsonTranscript.length > 0) {
                  return jsonTranscript;
                }
              } catch (e) {
                // Not JSON, continue
              }

              // Try to parse as VTT
              const vttTranscript = parseVTTTranscript(content);
              if (vttTranscript && vttTranscript.length > 0) {
                return vttTranscript;
              }
            }
          }
        } catch (e) {
          console.log('❌ URL failed:', e.message);
          continue;
        }
      }
    } catch (error) {
      console.error('❌ Track download failed:', error);
    }

    return null;
  }

  function parseXMLTranscript(xmlContent) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      if (doc.querySelector('parsererror')) {
        return null;
      }

      const textElements = doc.querySelectorAll('text');
      if (textElements.length === 0) return null;

      const transcript = [];
      textElements.forEach(element => {
        const start = parseFloat(element.getAttribute('start') || '0');
        const duration = parseFloat(element.getAttribute('dur') || '3');
        const text = element.textContent
          ?.replace(/&amp;/g, '&')
          ?.replace(/&lt;/g, '<')
          ?.replace(/&gt;/g, '>')
          ?.replace(/&#39;/g, "'")
          ?.replace(/&quot;/g, '"')
          ?.trim();

        if (text && text.length > 0) {
          transcript.push({
            start: start,
            end: start + duration,
            duration: duration,
            text: text
          });
        }
      });

      return transcript.length > 0 ? transcript : null;
    } catch (error) {
      console.error('❌ XML parsing failed:', error);
      return null;
    }
  }

  function parseJSONTranscript(jsonData) {
    try {
      if (jsonData.events) {
        const transcript = [];
        jsonData.events.forEach(event => {
          if (event.segs) {
            let eventText = '';
            event.segs.forEach(seg => {
              if (seg.utf8) {
                eventText += seg.utf8;
              }
            });
            
            if (eventText.trim()) {
              transcript.push({
                start: (event.tStartMs || 0) / 1000,
                end: ((event.tStartMs || 0) + (event.dDurationMs || 3000)) / 1000,
                duration: (event.dDurationMs || 3000) / 1000,
                text: eventText.trim()
              });
            }
          }
        });
        return transcript.length > 0 ? transcript : null;
      }
      return null;
    } catch (error) {
      console.error('❌ JSON parsing failed:', error);
      return null;
    }
  }

  function parseVTTTranscript(vttContent) {
    try {
      const lines = vttContent.split('\n');
      const transcript = [];
      let currentEntry = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Time format: 00:00:00.000 --> 00:00:03.000
        const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
        if (timeMatch) {
          if (currentEntry && currentEntry.text) {
            transcript.push(currentEntry);
          }
          
          currentEntry = {
            start: timeToSeconds(timeMatch[1]),
            end: timeToSeconds(timeMatch[2]),
            duration: timeToSeconds(timeMatch[2]) - timeToSeconds(timeMatch[1]),
            text: ''
          };
        } else if (currentEntry && line && !line.includes('WEBVTT') && !line.match(/^\d+$/)) {
          currentEntry.text += (currentEntry.text ? ' ' : '') + line;
        }
      }

      if (currentEntry && currentEntry.text) {
        transcript.push(currentEntry);
      }

      return transcript.length > 0 ? transcript : null;
    } catch (error) {
      console.error('❌ VTT parsing failed:', error);
      return null;
    }
  }

  function timeToSeconds(timeString) {
    const parts = timeString.split(':');
    const seconds = parts[2].split('.');
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(seconds[0]) + parseInt(seconds[1]) / 1000;
  }

  async function tryTimedTextAPI(videoId) {
    console.log('⚡ Trying timedtext API for:', videoId);
    
    const apiUrls = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3`
    ];

    for (const url of apiUrls) {
      try {
        const response = await fetch(url, {
          credentials: 'same-origin'
        });
        
        if (response.ok) {
          const content = await response.text();
          if (content && content.trim().length > 50) {
            const transcript = parseXMLTranscript(content) || parseJSONTranscript(JSON.parse(content));
            if (transcript && transcript.length > 0) {
              return transcript;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  async function tryVideoMetadata() {
    console.log('📋 Extracting from video metadata...');
    
    // This is a fallback - not really a transcript but better than nothing
    const title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim();
    const description = document.querySelector('#description')?.textContent?.trim()?.substring(0, 500);
    
    if (title || description) {
      return [{
        start: 0,
        end: 30,
        duration: 30,
        text: `Video: ${title || 'Untitled'}. ${description ? 'Description: ' + description : ''} (Note: This is metadata, not actual captions. The video may not have completed auto-captions yet.)`
      }];
    }

    return null;
  }

  async function tryAlternativeTranscriptMethods(videoId) {
    console.log('🔄 Trying alternative methods...');
    
    // Try to wait for auto-captions to be processed and then get them
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          // Try one more time to get current captions after waiting
          const transcript = await getCurrentCaptions();
          resolve(transcript);
        } catch (e) {
          resolve(null);
        }
      }, 3000);
    });
  }

  function parseTimestamp(timestamp) {
    const parts = timestamp.trim().split(':').map(p => parseInt(p, 10));
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
  }

  function isNewMeaningfulContent(newText, existingSegments) {
    // Basic length check
    if (!newText || newText.length < 10) return false;
    
    // Check against recent segments (last 5)
    const recentSegments = existingSegments.slice(-5);
    
    for (const segment of recentSegments) {
      const existingText = segment.text.toLowerCase();
      const currentText = newText.toLowerCase();
      
      // Skip if too similar to existing content
      if (calculateTextSimilarity(currentText, existingText) > 0.7) {
        return false;
      }
      
      // Skip if current text is contained in existing or vice versa
      if (existingText.includes(currentText) || currentText.includes(existingText)) {
        return false;
      }
    }
    
    // Check for repetitive patterns within the text itself
    const words = newText.split(' ');
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    
    // Require good word diversity (at least 60% unique words)
    const wordDiversity = uniqueWords.size / words.length;
    if (wordDiversity < 0.6) {
      return false;
    }
    
    // Check for obvious repetition patterns
    const hasRepetitivePattern = /(.{10,})\1/.test(newText.toLowerCase());
    if (hasRepetitivePattern) {
      return false;
    }
    
    return true;
  }

  function calculateTextSimilarity(text1, text2) {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  async function forceCollectionSample() {
    console.log('🔄 HYBRID Force collection sample...');
    
    try {
      // Enable captions
      const ccButton = document.querySelector('.ytp-subtitles-button');
      if (ccButton && ccButton.getAttribute('aria-pressed') !== 'true') {
        ccButton.click();
        await sleep(2000);
      }
      
      // Try to collect for 15 seconds
      const collectedCaptions = await monitorCaptionsForPeriod(15000);
      
      if (collectedCaptions.length > 0) {
        return collectedCaptions;
      }
      
      // If still nothing, try to get any text from video description or title
      const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer, #title h1')?.textContent?.trim();
      const videoDescription = document.querySelector('#description')?.textContent?.trim()?.substring(0, 200);
      
      if (videoTitle || videoDescription) {
        console.log('📝 HYBRID Using video metadata as fallback');
        const fallbackText = [videoTitle, videoDescription].filter(Boolean).join('. ');
        
        return [{
          start: 0,
          end: 10,
          duration: 10,
          text: `Video content: ${fallbackText} (Note: This is video metadata, not actual captions. Try using "Collect" feature while playing the video.)`
        }];
      }
      
      return null;
    } catch (error) {
      console.error('❌ HYBRID Force collection failed:', error);
      return null;
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

})();