// Coursera Content Script - Language Learning Extension
// Handles Coursera video interaction and learning functionality

(function() {
  'use strict';
  
  // Silence verbose logs in production (match other content scripts)
  try { if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    const n = chrome.runtime.getManifest().name || '';
    if (!n.toLowerCase().includes('dev')) {
      console.log = function(){}; console.info = function(){}; console.debug = function(){}; console.warn = function(){};
    }
  } } catch (e) {}

  console.log('🎓 Coursera Language Learning Extension loaded');
  
  // Find primary Coursera video element
  function getVideoElement() {
    return document.querySelector('video[data-testid="video-player"], .video-js video, video.vjs-tech, .rc-VideoContainer video, video');
  }

  // Find the player container wrapping the video and caption display
  function getPlayerContainer() {
    const video = getVideoElement();
    if (!video) return null;
    const candidates = [
      '.rc-VideoContainer',
      '.rc-Video',
      '.rc-LectureView',
      '.video-container',
      '.vjs-tech' // video.js
    ];
    for (const sel of candidates) {
      const el = video.closest(sel);
      if (el) return el;
    }
    // Fallback to a few levels up
    let p = video.parentElement;
    for (let i = 0; i < 4 && p; i++) {
      if (p.querySelector && (p.querySelector('.rc-CaptionsRenderer') || p.querySelector('.vjs-text-track-display'))) {
        return p;
      }
      p = p.parentElement;
    }
    return video.parentElement || document.body;
  }

  // Read active cues directly from HTML5 textTracks for reliability
  function getActiveCueTextFromTextTracks() {
    try {
      const video = getVideoElement();
      if (!video || !video.textTracks) return '';
      const texts = [];
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        // Consider subtitle/caption kinds; 'showing' or 'hidden' can still have active cues
        if (!track || !(track.kind === 'subtitles' || track.kind === 'captions')) continue;
        const cues = track.activeCues || track.cues; // prefer activeCues
        if (!cues || cues.length === 0) continue;
        for (let j = 0; j < cues.length; j++) {
          const cue = cues[j];
          const raw = (cue && (cue.text || cue.payload || '')) + '';
          const text = raw
            .replace(/<[^>]+>/g, ' ') // strip HTML from WebVTT
            .replace(/\s+/g, ' ')
            .trim();
          if (text) texts.push(text);
        }
      }
      return texts.join(' ').trim();
    } catch (e) {
      return '';
    }
  }

  // ===== STATE MANAGEMENT =====
  let isCollecting = false;
  let collectedSegments = [];
  let collectionStartTime = null;
  let monitorInterval = null;
  let lastSubtitle = '';
  let lastSubtitleTime = 0;
  
  // ===== REQUIRED CORE FUNCTIONS =====
  
  // Extract Coursera video/lecture ID
  function extractVideoId() {
    // Coursera URL patterns:
    // https://www.coursera.org/learn/course-name/lecture/video-id/title
    // https://www.coursera.org/learn/course-name/programming/assignment-name
    const match = window.location.href.match(/\/learn\/([^\/]+)\/lecture\/([^\/]+)/);
    if (match) {
      return `${match[1]}_${match[2]}`;
    }
    
    // Alternative pattern for other content
    const altMatch = window.location.href.match(/\/learn\/([^\/]+)/);
    return altMatch ? altMatch[1] : 'coursera_video';
  }
  
  // Get current video timestamp
  function getCurrentTimestamp() {
    try {
      const video = document.querySelector('video[data-testid="video-player"], .video-js video, video.vjs-tech, video');
      if (video && !isNaN(video.currentTime)) {
        return Math.floor(video.currentTime);
      }
    } catch (error) {
      console.log('⚠️ Error getting Coursera timestamp:', error);
    }
    return 0;
  }
  
  // Get course title
  function getCourseTitle() {
    console.log('🔍 Extracting Coursera course title...');
    
    const selectors = [
      '[data-testid="course-title"]',
      '.banner-title',
      '.course-header h1',
      '.xdp-banner-title',
      '[data-track-component="course_title"]',
      '.course-name',
      'h1[class*="course"]',
      'h1',
      'h2'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        let title = element.textContent.trim();
        console.log(`✅ Found course title with selector "${selector}": "${title}"`);
        
        // Clean up common prefixes/suffixes  
        title = title.replace(/^Course:\s*/, '');
        title = title.replace(/\s*-\s*Coursera.*$/, '');
        title = title.replace(/\s*\|\s*Coursera.*$/, '');
        
        if (title.length > 3) {
          return title;
        }
      }
    }
    
    // Fallback: Extract from document title
    let docTitle = document.title;
    if (docTitle && docTitle !== 'Coursera') {
      console.log(`🔄 Using document title as course fallback: "${docTitle}"`);
      docTitle = docTitle.replace(/\s*\|\s*Coursera.*$/, '');
      
      if (docTitle.includes(' - ')) {
        docTitle = docTitle.split(' - ')[0].trim();
      }
      
      if (docTitle.length > 5) {
        return docTitle;
      }
    }
    
    console.log('❌ No course title found, using default');
    return 'Coursera Course';
  }
  
  // Get lecture title
  function getLectureTitle() {
    console.log('🔍 Extracting Coursera lecture title...');
    
    const selectors = [
      '[data-testid="lecture-title"]',
      '.lecture-name',
      '.video-title',
      '.item-name',
      '.current-item-name',
      'h3[class*="lecture"]',
      '.content-title',
      'h2',
      'h3'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        let title = element.textContent.trim();
        console.log(`✅ Found lecture title with selector "${selector}": "${title}"`);
        
        if (title.length > 3 && !title.includes('Coursera')) {
          return title;
        }
      }
    }
    
    console.log('❌ No lecture title found, using default');
    return 'Coursera Lecture';
  }
  
  // Get content title (course + lecture)
  function getContentTitle() {
    const courseTitle = getCourseTitle();
    const lectureTitle = getLectureTitle();
    
    if (lectureTitle !== 'Coursera Lecture' && lectureTitle !== courseTitle) {
      return `${courseTitle} - ${lectureTitle}`;
    }
    return courseTitle;
  }
  
  // Extract current subtitle text
  function captureCurrentSubtitle() {
    console.log('🎯 Attempting to capture Coursera subtitle...');
    
    // 1) Prefer textTracks active cues (most reliable)
    const trackText = getActiveCueTextFromTextTracks();
    const shouldSkipText = (text) => {
      if (!text) return true;
      const t = text.trim();
      if (t.length < 2 || t.length > 300) return true;
      // Skip UI/menu labels and track names
      const uiPatterns = /(\bCaptions\b|\bSubtitles\b|\b字幕\b|\b자막\b)/i;
      if (uiPatterns.test(t)) {
        const likelySentence = /[\w\p{L}][\s.,?!'"-][\w\p{L}]/u.test(t) && !/\bCaptions\b/i.test(t);
        if (!likelySentence) return true;
      }
      const langMenuPattern = /^(English|Deutsch|Español|Français|Português|Italiano|Nederlands|Türkçe|Русский|العربية|中文|日本語|한국어)(\s*\(.*\))?\s*Captions?$/i;
      if (langMenuPattern.test(t)) return true;
      const autoPattern = /(auto|automatik|automatic|자동|自動|自动)/i;
      if (autoPattern.test(t) && /Captions?/i.test(t)) return true;
      // Skip known 3rd-party overlay brands/phrases (e.g., Trancy)
      const overlayPattern = /(Trancy|Language\s*Reactor|LLN|GlotDojo|Dualsub)/i;
      if (overlayPattern.test(t)) return true;
      return false;
    };

    if (trackText && !shouldSkipText(trackText)) {
      const timestamp = getCurrentTimestamp();
      if (trackText === lastSubtitle && (timestamp - lastSubtitleTime) < 2) {
        return null;
      }
      lastSubtitle = trackText;
      lastSubtitleTime = timestamp;
      console.log(`📝 Captured Coursera subtitle (textTracks): "${trackText}"`);
      const captureData = {
        text: trackText,
        timestamp: timestamp,
        videoId: extractVideoId(),
        title: getContentTitle(),
        url: window.location.href,
        platform: 'coursera',
        courseTitle: getCourseTitle()
      };
      chrome.runtime.sendMessage({ action: 'recordCourseraLearning', data: captureData, source: 'coursera-content' });
      return captureData;
    }

    // 2) Prefer Coursera renderer lines next
    const collectFromRenderer = () => {
      try {
        const container = getPlayerContainer() || document;
        const lineEls = Array.from(container.querySelectorAll('.rc-CaptionsRenderer .caption-line'));
        const lines = lineEls.map(el => (el.textContent || '').trim()).filter(Boolean);
        if (lines.length) {
          return lines.join(' ');
        }
      } catch (e) {}
      return '';
    };

    const rendererText = collectFromRenderer();
    if (rendererText && !shouldSkipText(rendererText)) {
      const timestamp = getCurrentTimestamp();
      if (rendererText === lastSubtitle && (timestamp - lastSubtitleTime) < 2) {
        return null;
      }
      lastSubtitle = rendererText;
      lastSubtitleTime = timestamp;
      console.log(`📝 Captured Coursera subtitle (renderer): "${rendererText}"`);
      const captureData = {
        text: rendererText,
        timestamp: timestamp,
        videoId: extractVideoId(),
        title: getContentTitle(),
        url: window.location.href,
        platform: 'coursera',
        courseTitle: getCourseTitle()
      };
      chrome.runtime.sendMessage({ action: 'recordCourseraLearning', data: captureData, source: 'coursera-content' });
      return captureData;
    }

    const subtitleSelectors = [
      // within player container only
      '.vjs-text-track-cue',
      '[data-testid="video-caption"]',
      '.coursera-caption-text',
      '.video-captions .caption',
      '.subtitle-display',
      '.vjs-text-track-display div',
      '.video-js .vjs-text-track-cue',
      // last-resort generic cues
      '[aria-live="polite"]',
      '[role="region"][aria-live]'
    ];
    
    for (const selector of subtitleSelectors) {
      const container = getPlayerContainer() || document;
      const subtitleElements = container.querySelectorAll(selector);
      
      for (const element of subtitleElements) {
        if (element && element.textContent.trim()) {
          // Skip menu/controls
          if (element.closest && element.closest('.vjs-menu, [role="menu"], .vjs-settings-dialog')) {
            continue;
          }

          const subtitleText = element.textContent.trim();
          
          // Skip empty or very short text
          if (subtitleText.length < 3) continue;
          
          // Skip duplicate subtitles
          if (subtitleText === lastSubtitle) continue;
          
          if (shouldSkipText(subtitleText)) continue;

          const timestamp = getCurrentTimestamp();
          
          // Skip if same subtitle within 2 seconds
          if (subtitleText === lastSubtitle && (timestamp - lastSubtitleTime) < 2) {
            continue;
          }
          
          console.log(`📝 Captured Coursera subtitle: "${subtitleText}"`);
          
          lastSubtitle = subtitleText;
          lastSubtitleTime = timestamp;
          
          // Send to background script for processing
          const captureData = {
            text: subtitleText,
            timestamp: timestamp,
            videoId: extractVideoId(),
            title: getContentTitle(),
            url: window.location.href,
            platform: 'coursera',
            courseTitle: getCourseTitle()
          };
          
          chrome.runtime.sendMessage({
            action: 'recordCourseraLearning',
            data: captureData,
            source: 'coursera-content'
          });
          
          return captureData;
        }
      }
    }
    
    console.log('❌ No subtitle found on Coursera');
    return null;
  }
  
  // Monitor for subtitle changes
  function startSubtitleCollection() {
    if (isCollecting) {
      console.log('⚠️ Coursera collection already running');
      return;
    }
    
    console.log('🎬 Starting Coursera subtitle collection');
    isCollecting = true;
    collectionStartTime = Date.now();
    collectedSegments = [];
    
    monitorInterval = setInterval(() => {
      const subtitle = captureCurrentSubtitle();
      if (subtitle) {
        collectedSegments.push(subtitle);
      }
    }, 1500); // Slightly faster for Coursera stability
    
    // Set collection timeout
    setTimeout(() => {
      if (isCollecting) {
        stopSubtitleCollection();
      }
    }, 300000); // 5 minutes max
  }
  
  function stopSubtitleCollection() {
    if (!isCollecting) return;
    
    console.log('🛑 Stopping Coursera subtitle collection');
    isCollecting = false;
    
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
    
    if (collectedSegments.length > 0) {
      console.log(`📊 Collected ${collectedSegments.length} Coursera segments`);
      
      // Send collection summary
      chrome.runtime.sendMessage({
        action: 'courseraCollectionComplete',
        data: {
          segments: collectedSegments,
          duration: Date.now() - collectionStartTime,
          platform: 'coursera'
        }
      });
    }
    
    // Reset state
    collectedSegments = [];
    collectionStartTime = null;
  }
  
  // ===== MESSAGE HANDLER =====
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Coursera content script received:', request.action);
    
    switch (request.action) {
      case 'seekCourseraVideo':
        try {
          const video = getVideoElement();
          if (video && typeof request.time === 'number') {
            video.currentTime = Math.max(0, request.time);
            sendResponse({ success: true, time: video.currentTime });
          } else {
            sendResponse({ success: false, error: 'Video element not found or invalid time' });
          }
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return true;

      case 'ping':
        console.log('🏓 Coursera content script ping response');
        sendResponse({ 
          status: 'active', 
          platform: 'coursera',
          url: window.location.href,
          title: getContentTitle()
        });
        return true;
        
      case 'captureCurrentSubtitle':
        const subtitle = captureCurrentSubtitle();
        sendResponse({ 
          success: !!subtitle, 
          data: subtitle,
          platform: 'coursera'
        });
        return true;
        
      case 'startSubtitleCollection':
        startSubtitleCollection();
        sendResponse({ success: true, platform: 'coursera' });
        return true;
        
      case 'stopSubtitleCollection':
        stopSubtitleCollection();
        sendResponse({ success: true, platform: 'coursera' });
        return true;
        
      case 'getVideoInfo':
        sendResponse({
          videoId: extractVideoId(),
          title: getContentTitle(),
          courseTitle: getCourseTitle(),
          platform: 'coursera',
          url: window.location.href
        });
        return true;
        
      default:
        console.log('❓ Unknown action for Coursera:', request.action);
        sendResponse({ error: 'Unknown action', platform: 'coursera' });
        return true;
    }
  });
  
  // ===== INITIALIZATION =====
  
  // Auto-detect platform on load
  setTimeout(() => {
    console.log('🎓 Coursera content script ready');
    console.log('📋 Current course:', getContentTitle());
  }, 2000);
  
})();