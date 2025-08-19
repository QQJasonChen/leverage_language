// Netflix Subtitle Extractor - Advanced subtitle capture and processing
// Intercepts Netflix APIs to extract subtitle tracks and content

(function() {
  'use strict';

  console.log('🎭 Netflix Subtitle Extractor loaded');

  // Check if extension context is still valid
  let contextInvalidated = false;
  
  function checkExtensionContext() {
    try {
      if (!chrome.runtime || !chrome.runtime.id) {
        contextInvalidated = true;
        return false;
      }
      return true;
    } catch (error) {
      contextInvalidated = true;
      return false;
    }
  }

  // Periodically check extension context
  setInterval(() => {
    if (!checkExtensionContext()) {
      console.log('🔄 Extension context invalidated, stopping all Netflix operations');
      contextInvalidated = true;
    }
  }, 5000);

  // Subtitle collection state
  let netflixSubtitles = {
    tracks: [],
    currentTrack: null,
    segments: [],
    isCollecting: false,
    movieId: null,
    videoTitle: null,
    availableLanguages: []
  };

  // Store original functions for interception
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalJSONParse = JSON.parse;

  // Inject page script for deeper API access
  function injectNetflixPageScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('netflix-page-script.js');
    script.onload = function() {
      console.log('📜 Netflix page script injected');
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // API Interception for subtitle track discovery
  function interceptNetflixAPIs() {
    // Override fetch to capture subtitle requests
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      
      try {
        const url = args[0];
        
        // Capture manifest/metadata requests
        if (typeof url === 'string' && 
            (url.includes('/manifest') || 
             url.includes('/metadata') || 
             url.includes('/playbackContexts'))) {
          
          console.log('🔍 Netflix API call intercepted:', url);
          
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          
          // Process metadata for subtitle tracks
          if (data && (data.video || data.result)) {
            processNetflixMetadata(data);
          }
        }
        
        // Capture subtitle file requests
        if (typeof url === 'string' && 
            (url.includes('.webvtt') || 
             url.includes('.dfxp') || 
             url.includes('.srt') ||
             url.includes('timedtexttracks'))) {
          
          console.log('📝 Subtitle file request intercepted:', url);
          
          const clonedResponse = response.clone();
          const subtitleContent = await clonedResponse.text();
          
          processSubtitleContent(subtitleContent, url);
        }
        
      } catch (error) {
        console.log('⚠️ Error processing intercepted response:', error);
      }
      
      return response;
    };

    // Override XMLHttpRequest
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this._interceptedUrl = url;
      return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(data) {
      const xhr = this;
      
      // Add response handler
      const originalReadyStateChange = xhr.onreadystatechange;
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          try {
            const url = xhr._interceptedUrl;
            
            if (url && typeof url === 'string') {
              // Check for metadata responses
              if (url.includes('/metadata') || url.includes('/manifest')) {
                const responseData = JSON.parse(xhr.responseText);
                processNetflixMetadata(responseData);
              }
              
              // Check for subtitle responses
              if (url.includes('.webvtt') || url.includes('.dfxp') || url.includes('.srt')) {
                processSubtitleContent(xhr.responseText, url);
              }
            }
          } catch (error) {
            console.log('⚠️ XHR response processing error:', error);
          }
        }
        
        if (originalReadyStateChange) {
          originalReadyStateChange.apply(this, arguments);
        }
      };
      
      return originalXHRSend.call(this, data);
    };

    // Override JSON.parse to capture data structures
    window.JSON.parse = function(text) {
      const result = originalJSONParse.call(this, text);
      
      try {
        // Look for Netflix-specific data structures
        if (result && typeof result === 'object') {
          if (result.timedtexttracks || result.movieId) {
            console.log('🎯 Netflix subtitle metadata detected');
            processNetflixMetadata(result);
          }
        }
      } catch (error) {
        console.log('⚠️ JSON.parse interception error:', error);
      }
      
      return result;
    };

    console.log('🕵️ Netflix API interception set up');
  }

  // Process Netflix metadata to extract subtitle information
  function processNetflixMetadata(data) {
    try {
      console.log('📊 Processing Netflix metadata:', data);
      
      // Extract movie/show ID
      if (data.movieId) {
        netflixSubtitles.movieId = data.movieId;
      }
      
      // Extract title information
      if (data.video && data.video.title) {
        netflixSubtitles.videoTitle = data.video.title;
      }
      
      // Extract subtitle tracks
      let tracks = [];
      
      if (data.timedtexttracks) {
        tracks = data.timedtexttracks;
      } else if (data.video && data.video.timedtexttracks) {
        tracks = data.video.timedtexttracks;
      } else if (data.result && data.result.timedtexttracks) {
        tracks = data.result.timedtexttracks;
      }
      
      if (tracks && tracks.length > 0) {
        console.log(`🎯 Found ${tracks.length} subtitle tracks`);
        
        netflixSubtitles.tracks = tracks.map(track => ({
          id: track.id || track.trackId,
          language: track.language,
          languageDescription: track.languageDescription,
          type: track.trackType || 'subtitles',
          url: track.ttDownloadables ? Object.values(track.ttDownloadables)[0] : null,
          isClosedCaptions: track.trackType === 'closedcaptions',
          isForcedNarrative: track.isForcedNarrative
        }));
        
        netflixSubtitles.availableLanguages = [...new Set(tracks.map(t => t.language))];
        
        console.log('🌐 Available subtitle languages:', netflixSubtitles.availableLanguages);
        
        // Notify extension of available subtitles
        if (!contextInvalidated && checkExtensionContext()) {
          try {
            chrome.runtime.sendMessage({
              action: 'netflixSubtitlesAvailable',
              tracks: netflixSubtitles.tracks,
              languages: netflixSubtitles.availableLanguages,
              movieId: netflixSubtitles.movieId,
              title: netflixSubtitles.videoTitle
            });
          } catch (err) {
            if (err.message && err.message.includes('Extension context invalidated')) {
              console.log('🔄 Extension context invalidated, stopping Netflix operations');
              contextInvalidated = true;
              return;
            }
            console.log('Failed to notify extension:', err);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing Netflix metadata:', error);
    }
  }

  // Process subtitle content (WebVTT, DFXP, SRT) with language support
  function processSubtitleContent(content, url) {
    try {
      console.log('📝 Processing subtitle content from:', url);
      
      let segments = [];
      let detectedLanguage = null;
      
      // Extract language from URL if possible
      const urlLangMatch = url.match(/[?&]lang=([a-z-]+)/i) || url.match(/\/([a-z]{2}(-[A-Z]{2})?)\//);
      if (urlLangMatch) {
        detectedLanguage = urlLangMatch[1];
        console.log('🌐 Detected language from URL:', detectedLanguage);
      }
      
      // Detect subtitle format and parse accordingly
      if (content.includes('WEBVTT')) {
        segments = parseWebVTT(content, detectedLanguage);
      } else if (content.includes('<?xml') && content.includes('tt ')) {
        segments = parseDFXP(content, detectedLanguage);
      } else if (content.match(/^\d+$/m)) {
        segments = parseSRT(content, detectedLanguage);
      } else {
        // Try to detect other formats
        console.log('⚠️ Unknown subtitle format, attempting generic parsing');
        segments = parseGenericSubtitles(content, detectedLanguage);
      }
      
      if (segments.length > 0) {
        console.log(`✨ Parsed ${segments.length} subtitle segments for language: ${detectedLanguage || 'unknown'}`);
        
        netflixSubtitles.segments = segments;
        netflixSubtitles.currentLanguage = detectedLanguage;
        
        // Notify extension of parsed subtitles with language info
        if (!contextInvalidated && checkExtensionContext()) {
          try {
            chrome.runtime.sendMessage({
              action: 'netflixSubtitlesParsed',
              segments: segments,
              format: detectSubtitleFormat(content),
              language: detectedLanguage,
              url: url,
              movieId: netflixSubtitles.movieId
            });
          } catch (err) {
            if (err.message && err.message.includes('Extension context invalidated')) {
              console.log('🔄 Extension context invalidated, stopping Netflix operations');
              contextInvalidated = true;
              return;
            }
            console.log('Failed to notify extension:', err);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing subtitle content:', error);
    }
  }

  // Parse WebVTT format with language support
  function parseWebVTT(content, language = null) {
    const segments = [];
    const lines = content.split('\n');
    let currentSegment = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Time code line (00:00:01.000 --> 00:00:03.000)
      if (line.includes(' --> ')) {
        const [startTime, endTime] = line.split(' --> ');
        currentSegment = {
          start: parseWebVTTTime(startTime),
          end: parseWebVTTTime(endTime),
          text: '',
          language: language
        };
      }
      // Text content
      else if (line && currentSegment && !line.startsWith('NOTE') && !line.startsWith('WEBVTT')) {
        // Clean text content for different languages
        const cleanText = cleanSubtitleText(line, language);
        if (currentSegment.text) {
          currentSegment.text += ' ' + cleanText;
        } else {
          currentSegment.text = cleanText;
        }
      }
      // Empty line - end of segment
      else if (!line && currentSegment && currentSegment.text) {
        currentSegment.duration = currentSegment.end - currentSegment.start;
        currentSegment.timestamp = formatTimestamp(currentSegment.start);
        segments.push(currentSegment);
        currentSegment = null;
      }
    }
    
    // Add last segment if exists
    if (currentSegment && currentSegment.text) {
      currentSegment.duration = currentSegment.end - currentSegment.start;
      currentSegment.timestamp = formatTimestamp(currentSegment.start);
      segments.push(currentSegment);
    }
    
    return segments;
  }

  // Parse DFXP/TTML format with language support
  function parseDFXP(content, language = null) {
    const segments = [];
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');
      const pElements = xmlDoc.querySelectorAll('p');
      
      pElements.forEach(p => {
        const begin = p.getAttribute('begin');
        const end = p.getAttribute('end');
        const text = p.textContent.trim();
        
        if (begin && end && text) {
          const startSeconds = parseDFXPTime(begin);
          const endSeconds = parseDFXPTime(end);
          const cleanText = cleanSubtitleText(text, language);
          
          segments.push({
            start: startSeconds,
            end: endSeconds,
            duration: endSeconds - startSeconds,
            text: cleanText,
            timestamp: formatTimestamp(startSeconds),
            language: language
          });
        }
      });
    } catch (error) {
      console.error('❌ DFXP parsing error:', error);
    }
    
    return segments;
  }

  // Parse SRT format with language support
  function parseSRT(content, language = null) {
    const segments = [];
    const blocks = content.split('\n\n');
    
    blocks.forEach(block => {
      const lines = block.trim().split('\n');
      if (lines.length >= 3) {
        const timeLine = lines[1];
        const textLines = lines.slice(2);
        
        if (timeLine.includes(' --> ')) {
          const [startTime, endTime] = timeLine.split(' --> ');
          const startSeconds = parseSRTTime(startTime);
          const endSeconds = parseSRTTime(endTime);
          const text = textLines.join(' ').trim();
          const cleanText = cleanSubtitleText(text, language);
          
          if (cleanText) {
            segments.push({
              start: startSeconds,
              end: endSeconds,
              duration: endSeconds - startSeconds,
              text: cleanText,
              timestamp: formatTimestamp(startSeconds),
              language: language
            });
          }
        }
      }
    });
    
    return segments;
  }

  // Clean subtitle text based on language
  function cleanSubtitleText(text, language = null) {
    if (!text) return '';
    
    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, '');
    
    // Remove common subtitle artifacts
    text = text.replace(/^\s*-\s*/, ''); // Remove leading dash
    text = text.replace(/\[.*?\]/g, ''); // Remove [sound effects]
    text = text.replace(/\(.*?\)/g, ''); // Remove (actions)
    text = text.replace(/♪.*?♪/g, ''); // Remove ♪ music ♪
    
    // Language-specific cleaning
    if (language) {
      switch (language.split('-')[0]) {
        case 'zh':
          // Chinese: Remove tone marks, clean punctuation
          text = text.replace(/[「」『』]/g, '"'); // Normalize quotes
          text = text.replace(/[，。！？]/g, match => {
            return match.replace('，', ',').replace('。', '.').replace('！', '!').replace('？', '?');
          });
          break;
        case 'ja':
          // Japanese: Clean hiragana/katakana artifacts
          text = text.replace(/[「」『』]/g, '"'); // Normalize quotes
          break;
        case 'ko':
          // Korean: Clean hangul artifacts
          text = text.replace(/[《》]/g, '"'); // Normalize quotes
          break;
        case 'ar':
          // Arabic: Handle RTL text markers
          text = text.replace(/[\u200F\u200E]/g, ''); // Remove RTL/LTR marks
          break;
      }
    }
    
    // Final cleanup
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  // Generic subtitle parser for unknown formats
  function parseGenericSubtitles(content, language = null) {
    const segments = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for time patterns
      const timePattern = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})/g;
      const timeMatches = [...line.matchAll(timePattern)];
      
      if (timeMatches.length >= 2) {
        // Found time codes, try to extract text from subsequent lines
        const start = parseGenericTime(timeMatches[0][0]);
        const end = parseGenericTime(timeMatches[1][0]);
        
        let text = '';
        for (let j = i + 1; j < lines.length && lines[j].trim(); j++) {
          if (!lines[j].match(timePattern)) {
            text += lines[j].trim() + ' ';
          }
        }
        
        text = cleanSubtitleText(text, language);
        
        if (text) {
          segments.push({
            start: start,
            end: end,
            duration: end - start,
            text: text,
            timestamp: formatTimestamp(start),
            language: language,
            format: 'generic'
          });
        }
      }
    }
    
    return segments;
  }

  // Parse generic time format
  function parseGenericTime(timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      const ms = parseInt(match[4]) / 1000;
      return hours * 3600 + minutes * 60 + seconds + ms;
    }
    return 0;
  }

  // Time parsing utilities
  function parseWebVTTTime(timeStr) {
    const parts = timeStr.split(':');
    const seconds = parseFloat(parts[2]);
    const minutes = parseInt(parts[1]);
    const hours = parseInt(parts[0]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  function parseDFXPTime(timeStr) {
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const seconds = parseFloat(parts[2]);
      const minutes = parseInt(parts[1]);
      const hours = parseInt(parts[0]);
      return hours * 3600 + minutes * 60 + seconds;
    } else if (timeStr.endsWith('s')) {
      return parseFloat(timeStr.slice(0, -1));
    }
    return parseFloat(timeStr);
  }

  function parseSRTTime(timeStr) {
    const [time, milliseconds] = timeStr.split(',');
    const parts = time.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseInt(parts[2]);
    const ms = parseInt(milliseconds) / 1000;
    return hours * 3600 + minutes * 60 + seconds + ms;
  }

  function formatTimestamp(seconds) {
    try {
      if (isNaN(seconds) || seconds < 0) {
        return '0:00';
      }
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    } catch (error) {
      console.log('⚠️ Error formatting timestamp:', error);
      return '0:00';
    }
  }

  function detectSubtitleFormat(content) {
    if (content.includes('WEBVTT')) return 'webvtt';
    if (content.includes('<?xml') && content.includes('tt ')) return 'dfxp';
    if (content.match(/^\d+$/m)) return 'srt';
    return 'unknown';
  }

  // Real-time subtitle monitoring
  function startRealtimeSubtitleMonitoring() {
    const subtitleSelectors = [
      '.player-timedtext',
      '.ltr-11vo9g5',  // Netflix subtitle container
      '[data-uia="player-subtitle-text"]',
      '.subtitle-text',
      '.PlayerSubtitles'
    ];

    let lastSubtitleText = '';
    let lastTimestamp = 0;

    function captureCurrentSubtitle() {
      for (const selector of subtitleSelectors) {
        const subtitleElement = document.querySelector(selector);
        if (subtitleElement && subtitleElement.textContent.trim()) {
          const currentText = subtitleElement.textContent.trim();
          const currentTime = getCurrentVideoTime();
          
          if (currentText !== lastSubtitleText && currentText.length > 0) {
            console.log('📝 Live subtitle captured:', currentText);
            
            const segment = {
              text: currentText,
              start: currentTime,
              timestamp: formatTimestamp(currentTime),
              source: 'live-capture'
            };
            
            // Add to current collection if collecting
            if (netflixSubtitles.isCollecting) {
              netflixSubtitles.segments.push(segment);
            }
            
            // Notify extension
            if (!contextInvalidated && checkExtensionContext()) {
              try {
                chrome.runtime.sendMessage({
                  action: 'netflixLiveSubtitle',
                  segment: segment
                });
              } catch (err) {
                if (err.message && err.message.includes('Extension context invalidated')) {
                  console.log('🔄 Extension context invalidated, stopping Netflix live subtitle monitoring');
                  contextInvalidated = true;
                  return;
                }
                console.log('Failed to send live subtitle:', err);
              }
            }
            
            lastSubtitleText = currentText;
            lastTimestamp = currentTime;
          }
          break;
        }
      }
    }

    // Monitor subtitle changes
    setInterval(captureCurrentSubtitle, 100);

    // Use MutationObserver for dynamic subtitle updates
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target;
          
          // Check if it's a subtitle-related change
          for (const selector of subtitleSelectors) {
            if (target.matches && target.matches(selector) || 
                target.closest && target.closest(selector)) {
              setTimeout(captureCurrentSubtitle, 10);
              break;
            }
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('👁️ Real-time subtitle monitoring started');
  }

  function getCurrentVideoTime() {
    try {
      const video = document.querySelector('video');
      return video ? video.currentTime : 0;
    } catch (error) {
      return 0;
    }
  }

  // Message handling from extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🎭 Netflix subtitle extractor received message:', request);

    switch (request.action) {
      case 'startNetflixSubtitleCollection':
        console.log('🎬 Starting Netflix subtitle collection');
        netflixSubtitles.isCollecting = true;
        netflixSubtitles.segments = [];
        sendResponse({ success: true });
        break;

      case 'stopNetflixSubtitleCollection':
        console.log('🛑 Stopping Netflix subtitle collection');
        netflixSubtitles.isCollecting = false;
        sendResponse({ 
          success: true, 
          segments: netflixSubtitles.segments,
          totalSegments: netflixSubtitles.segments.length
        });
        break;

      case 'getNetflixSubtitleInfo':
        sendResponse({
          success: true,
          tracks: netflixSubtitles.tracks,
          languages: netflixSubtitles.availableLanguages,
          isCollecting: netflixSubtitles.isCollecting,
          segments: netflixSubtitles.segments.length
        });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }

    return true;
  });

  // Initialize
  function initialize() {
    console.log('🚀 Initializing Netflix subtitle extractor (SIMPLIFIED MODE)');
    
    // DISABLED: API interception (was causing context invalidation errors)
    // interceptNetflixAPIs();
    
    // DISABLED: Page script injection (was causing errors)
    // setTimeout(injectNetflixPageScript, 1000);
    
    // DISABLED: Real-time monitoring (was causing context errors)
    // setTimeout(startRealtimeSubtitleMonitoring, 2000);
    
    console.log('✅ Netflix subtitle extractor initialized (SIMPLE MODE)');
    console.log('💡 Use the "Capture" button to manually save subtitle text');
  }

  // Listen for status check requests from content script
  window.addEventListener('netflixStatusCheck', (event) => {
    if (event.detail && event.detail.action === 'getCollectionStatus') {
      const statusResponse = new CustomEvent('netflixStatusResponse', {
        detail: {
          action: 'collectionStatus',
          isCollecting: netflixSubtitles.isCollecting
        }
      });
      window.dispatchEvent(statusResponse);
    }
  });

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();