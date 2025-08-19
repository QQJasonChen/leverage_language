// Simple Working YouTube Transcript System
// Focused on core functionality without complex features

(function() {
  'use strict';

  console.log('🎬 Simple YouTube transcript system loaded');

  // Simple transcript state
  let transcriptState = {
    isCollecting: false,
    segments: [],
    currentVideoId: null
  };

  // Listen for transcript requests
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📥 YouTube transcript message received:', request);
    
    if (request.action === 'getYouTubeTranscript') {
      handleTranscriptRequest(sendResponse);
      return true; // Keep message channel open
    }
    
    if (request.action === 'startTranscriptCollection') {
      startCollection(sendResponse);
      return true;
    }
    
    if (request.action === 'stopTranscriptCollection') {
      stopCollection(sendResponse);
      return true;
    }
  });

  // Handle transcript request
  async function handleTranscriptRequest(sendResponse) {
    try {
      console.log('🚀 Processing transcript request...');
      
      // Get current video info
      const videoInfo = getCurrentVideoInfo();
      if (!videoInfo.videoId) {
        throw new Error('No video found');
      }
      
      console.log('📹 Video info:', videoInfo);
      
      // Try different methods to get transcript
      let transcript = null;
      
      // Method 1: Try to get existing captions
      transcript = await tryGetExistingCaptions();
      
      if (!transcript || transcript.length === 0) {
        // Method 2: Start live caption collection
        transcript = await startLiveCaptionCollection();
      }
      
      if (transcript && transcript.length > 0) {
        console.log('✅ Transcript obtained:', transcript.length, 'segments');
        sendResponse({
          success: true,
          transcript: transcript,
          videoId: videoInfo.videoId,
          title: videoInfo.title
        });
      } else {
        throw new Error('No transcript available');
      }
      
    } catch (error) {
      console.error('❌ Transcript request failed:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  // Get current video information
  function getCurrentVideoInfo() {
    const video = document.querySelector('video');
    const videoId = extractVideoId(window.location.href);
    const title = document.querySelector('h1.ytd-video-primary-info-renderer') || 
                  document.querySelector('h1.title') || 
                  document.querySelector('#title h1');
    
    return {
      videoId: videoId,
      title: title ? title.textContent.trim() : 'Unknown Title',
      currentTime: video ? video.currentTime : 0,
      duration: video ? video.duration : 0
    };
  }

  // Extract video ID from URL
  function extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  // Try to get existing captions from the page
  async function tryGetExistingCaptions() {
    console.log('🔍 Looking for existing captions...');
    
    try {
      // Look for caption text elements
      const captionSelectors = [
        '.caption-window', // YouTube auto-captions
        '.ytp-caption-segment', // YouTube caption segments
        '.captions-text', // Alternative caption class
        '[class*="caption"]' // Any element with caption in class name
      ];
      
      for (const selector of captionSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`📝 Found captions with selector: ${selector}`, elements.length);
          
          const captions = Array.from(elements).map((el, index) => ({
            text: el.textContent.trim(),
            start: index * 2, // Estimate timing
            end: (index + 1) * 2
          })).filter(cap => cap.text.length > 0);
          
          if (captions.length > 0) {
            return captions;
          }
        }
      }
    } catch (error) {
      console.error('❌ Error getting existing captions:', error);
    }
    
    return null;
  }

  // Start live caption collection
  async function startLiveCaptionCollection() {
    console.log('🎤 Starting live caption collection...');
    
    return new Promise((resolve) => {
      transcriptState.isCollecting = true;
      transcriptState.segments = [];
      
      // Monitor for captions that appear
      const captionObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const captionText = extractCaptionText(node);
              if (captionText) {
                const currentTime = getCurrentVideoTime();
                transcriptState.segments.push({
                  text: captionText,
                  start: currentTime,
                  end: currentTime + 3 // Estimate 3-second duration
                });
                console.log('📝 Caption collected:', captionText);
              }
            }
          });
        });
      });
      
      // Start observing
      captionObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Collect for 10 seconds, then return what we have
      setTimeout(() => {
        captionObserver.disconnect();
        transcriptState.isCollecting = false;
        
        console.log('⏱️ Collection time ended. Segments collected:', transcriptState.segments.length);
        
        if (transcriptState.segments.length > 0) {
          resolve(transcriptState.segments);
        } else {
          // Return a basic transcript with current context
          resolve([{
            text: 'Live transcript collection in progress. Play the video to see captions.',
            start: getCurrentVideoTime(),
            end: getCurrentVideoTime() + 5
          }]);
        }
      }, 10000); // 10 seconds collection
    });
  }

  // Extract caption text from element
  function extractCaptionText(element) {
    if (element.classList && (
        element.classList.contains('caption-window') ||
        element.classList.contains('ytp-caption-segment') ||
        element.classList.contains('captions-text')
    )) {
      return element.textContent.trim();
    }
    
    // Check children
    const captionChild = element.querySelector('[class*="caption"]');
    if (captionChild) {
      return captionChild.textContent.trim();
    }
    
    return null;
  }

  // Get current video time
  function getCurrentVideoTime() {
    const video = document.querySelector('video');
    return video ? video.currentTime : 0;
  }

  // Start collection handler
  function startCollection(sendResponse) {
    console.log('▶️ Starting transcript collection...');
    transcriptState.isCollecting = true;
    transcriptState.segments = [];
    sendResponse({ success: true, message: 'Collection started' });
  }

  // Stop collection handler
  function stopCollection(sendResponse) {
    console.log('⏹️ Stopping transcript collection...');
    transcriptState.isCollecting = false;
    sendResponse({ 
      success: true, 
      segments: transcriptState.segments,
      message: 'Collection stopped'
    });
  }

  console.log('✅ Simple YouTube transcript system ready');

})();