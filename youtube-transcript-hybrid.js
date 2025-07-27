// Hybrid YouTube Transcript Content Script
// Combines real-time caption monitoring with API attempts

(function() {
  'use strict';

  console.log('🎬 HYBRID YouTube transcript content script loaded');

  // Caption collection state
  let captionCollection = {
    segments: [],
    isCollecting: false,
    startTime: 0,
    lastCaptionTime: 0,
    currentVideoTime: 0,
    lastCollectedTimestamp: 0,
    timeSegmentThreshold: 10, // ✅ FIX: Lower threshold - create new segment if time gap > 10s (user jumped)
    // ✅ NEW: Automatic chunking within collection sessions
    chunkDurationThreshold: 45, // Seconds - create new chunk every 45 seconds
    currentChunkStartTime: 0,
    currentChunkStartTimestamp: null,
    chunkCounter: 0
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
        isCollecting: captionCollection.isCollecting,
        collectedSegments: captionCollection.segments.length
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
      startCaptionCollection(chunkDuration);
      sendResponse({ success: true, message: 'Caption collection started' });
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
  });

  function extractVideoId() {
    const url = window.location.href;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
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
      if (captionCollection.segments.length > 0 && captionCollection.isCollecting === false) {
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

  function startCaptionCollection(chunkDuration = 45) {
    if (captionCollection.isCollecting) {
      console.log('📡 HYBRID Caption collection already in progress');
      return;
    }
    
    console.log(`🚀 HYBRID Starting real-time caption collection with ${chunkDuration}s chunks...`);
    captionCollection.isCollecting = true;
    captionCollection.startTime = Date.now();
    
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
    
    // Enable captions if needed with better detection
    const ccButton = document.querySelector('.ytp-subtitles-button, .ytp-menuitem[aria-label*="Captions"], button[aria-label*="Captions"]');
    if (ccButton && ccButton.getAttribute('aria-pressed') !== 'true') {
      console.log('🔘 HYBRID Enabling captions...');
      ccButton.click();
      
      // Wait for captions to load
      setTimeout(() => {
        const captionCheck = document.querySelectorAll('.ytp-caption-segment, .captions-text, .caption-visual-line, .ytp-caption-window-container span');
        console.log('📺 HYBRID Caption elements after enabling:', captionCheck.length);
      }, 2000);
    }
    
    // Start monitoring with enhanced selectors
    captionCollection.interval = setInterval(() => {
      // More focused caption selectors to avoid UI noise
      const allCaptionElements = document.querySelectorAll(`
        .ytp-caption-segment, 
        .captions-text, 
        .caption-visual-line
      `);
      
      // Filter out UI elements
      const captionElements = Array.from(allCaptionElements).filter(el => {
        // Skip elements that are clearly UI controls
        if (el.closest('.ytp-chrome-controls') || 
            el.closest('.ytp-settings-menu') ||
            el.closest('.ytp-popup') ||
            el.closest('.ytp-menuitem') ||
            el.closest('.ytp-tooltip') ||
            el.closest('.ytp-panel')) {
          return false;
        }
        
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
        
        return text.length > 5; // Only meaningful text
      });
      
      // Debug logging every 5 seconds
      if (Date.now() % 5000 < 1000) {
        console.log('🔍 HYBRID Caption status:', {
          elementsFound: captionElements.length,
          ccButtonPressed: document.querySelector('.ytp-subtitles-button')?.getAttribute('aria-pressed'),
          collecting: captionCollection.isCollecting,
          segmentsCollected: captionCollection.segments.length,
          videoPlaying: !document.querySelector('#movie_player')?.paused
        });
        
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
        const player = document.querySelector('#movie_player');
        const currentTime = player && player.getCurrentTime ? player.getCurrentTime() : 0;
        
        // Get text from caption elements with better filtering
        let currentText = Array.from(captionElements)
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 3) // Filter out very short text
          .join(' ');
        
        // Enhanced cleaning for better learning experience
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
            currentText.length > 15 && // Slightly lower threshold for learning content
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
              isNewChunk = chunkDuration > captionCollection.chunkDurationThreshold && 
                          captionCollection.segments.length > 0 && 
                          !isSignificantTimeGap; // Don't create chunk if already creating new segment
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
              console.log(`📦 AUTO-CHUNK: Duration ${Math.floor(chunkDuration)}s exceeded threshold ${captionCollection.chunkDurationThreshold}s - Creating new chunk at ${extractedTimestamp}`);
              captionCollection.chunkCounter++;
              captionCollection.currentChunkStartTime = timestampInSeconds;
              captionCollection.currentChunkStartTimestamp = extractedTimestamp;
            }
            
            // Get current video info for creating YouTube links
            const videoId = extractVideoId();
            console.log('🆔 Video ID extracted:', videoId, 'from URL:', window.location.href);
            const youtubeLink = videoId ? `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestampInSeconds)}s` : '#';
            console.log('🔗 Generated YouTube link:', youtubeLink);
            
            captionCollection.segments.push({
              start: timestampInSeconds,
              end: timestampInSeconds + 3,
              duration: 3,
              text: currentText,
              timestamp: Date.now(),
              videoId: videoId,
              youtubeLink: youtubeLink,
              originalTimestamp: extractedTimestamp, // Keep original format for display
              isNewTimeSegment: (isSignificantTimeGap || isUserJump), // ✅ FIX: Mark as new segment for any user jump
              timeGapFromPrevious: timeGap,
              // ✅ NEW: Chunk information for automatic chunking
              chunkNumber: captionCollection.chunkCounter,
              isNewChunk: isNewChunk,
              chunkStartTime: captionCollection.currentChunkStartTime,
              chunkStartTimestamp: captionCollection.currentChunkStartTimestamp
            });
            
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
          } else if (currentText.length <= 10) {
            console.log('❌ HYBRID Text too short after cleaning:', currentText.length, 'chars:', currentText);
          } else if (currentText === captionCollection.lastCaptionText) {
            console.log('❌ HYBRID Same text as before:', currentText.substring(0, 30));
          }
        }
      }
    }, 1000); // Check every second
  }

  function stopCaptionCollection() {
    if (!captionCollection.isCollecting) {
      return { segments: [], duration: 0 };
    }
    
    console.log('🛑 HYBRID Stopping caption collection...');
    captionCollection.isCollecting = false;
    
    if (captionCollection.interval) {
      clearInterval(captionCollection.interval);
      captionCollection.interval = null;
    }
    
    const duration = (Date.now() - captionCollection.startTime) / 1000;
    const segments = [...captionCollection.segments];
    
    console.log(`✅ HYBRID Collection complete: ${segments.length} segments in ${duration}s`);
    
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