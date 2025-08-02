// Netflix Content Script - Language Learning Extension
// Handles Netflix video interaction and learning functionality

(function() {
  'use strict';

  console.log('🎬 Netflix Language Learning extension loaded');

  let contextInvalidated = false;
  let lastKnownVideoId = null;
  let lastKnownTitle = null;
  let currentVideoInfo = null;

  // Netflix video ID patterns and extraction
  function extractNetflixVideoId() {
    // Netflix uses different URL patterns:
    // https://www.netflix.com/watch/81234567
    // https://www.netflix.com/title/81234567
    const match = window.location.href.match(/(?:watch|title)\/(\d+)/);
    return match ? match[1] : null;
  }

  function extractVideoTitle() {
    // Try multiple selectors for Netflix title
    const titleSelectors = [
      'h1[data-uia="video-title"]',
      '[data-uia="title-text"]',
      '.video-title h1',
      '.previewModal-info h1',
      '.PlayerControlsNeo__layout .PlayerControlsNeo__button-control-row h4',
      '[data-uia="player-title"]',
      '.watch-video h1',
      'h1',
      '.episode-title'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // Fallback to document title
    const title = document.title;
    if (title && title !== 'Netflix') {
      return title.replace(' - Netflix', '').trim();
    }

    return 'Netflix Video';
  }

  function getCurrentTimestamp() {
    try {
      // Netflix video player selector attempts
      const playerSelectors = [
        'video',
        '[data-uia="video-canvas"] video',
        '.VideoContainer video',
        '.watch-video video'
      ];

      for (const selector of playerSelectors) {
        const video = document.querySelector(selector);
        if (video && video.currentTime !== undefined) {
          return Math.floor(video.currentTime);
        }
      }

      return 0;
    } catch (error) {
      console.log('⚠️ Could not get Netflix timestamp:', error);
      return 0;
    }
  }

  function createTimestampedUrl(timestamp = null) {
    const videoId = extractNetflixVideoId();
    if (!videoId) return window.location.href;

    const currentTimestamp = timestamp || getCurrentTimestamp();
    const baseUrl = `https://www.netflix.com/watch/${videoId}`;
    
    // Netflix doesn't use URL fragments for timestamps like YouTube
    // We'll store the timestamp for internal use
    return `${baseUrl}#t=${currentTimestamp}s`;
  }

  function extractDetailedVideoInfo() {
    const videoId = extractNetflixVideoId();
    const title = extractVideoTitle();
    const timestamp = getCurrentTimestamp();
    
    // Extract additional metadata
    const metadata = {
      videoId,
      title,
      timestamp,
      url: createTimestampedUrl(timestamp),
      platform: 'netflix',
      contentType: detectContentType(),
      episodeInfo: extractEpisodeInfo(),
      duration: getVideoDuration(),
      playbackState: getPlaybackState(),
      availableLanguages: getAvailableAudioLanguages(),
      subtitleLanguages: getAvailableSubtitleLanguages(),
      quality: getVideoQuality(),
      genre: extractGenre(),
      year: extractYear(),
      maturityRating: extractMaturityRating(),
      cast: extractCastInfo(),
      description: extractDescription()
    };

    return metadata;
  }

  function detectContentType() {
    // Try to determine if it's a movie, series episode, documentary, etc.
    const url = window.location.href;
    
    // Check for episode indicators
    const episodeSelectors = [
      '[data-uia="episode-title"]',
      '.episode-title',
      '[data-uia="season-episode"]',
      '.watch-video [data-uia*="episode"]'
    ];
    
    for (const selector of episodeSelectors) {
      if (document.querySelector(selector)) {
        return 'episode';
      }
    }

    // Check for documentary indicators
    if (document.querySelector('[data-uia*="documentary"]') || 
        document.title.toLowerCase().includes('documentary')) {
      return 'documentary';
    }

    // Check for limited series
    if (document.querySelector('[data-uia*="limited"]') || 
        document.title.toLowerCase().includes('limited series')) {
      return 'limited-series';
    }

    // Default to movie
    return 'movie';
  }

  function extractEpisodeInfo() {
    try {
      const episodeInfo = {};
      
      // Try to extract season and episode numbers
      const seasonEpisodeSelectors = [
        '[data-uia="season-episode"]',
        '.episode-metadata',
        '.watch-video .episode-title',
        '[data-uia*="episode-selector"]'
      ];

      for (const selector of seasonEpisodeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent;
          
          // Parse "S1:E5" format
          const seasonEpisodeMatch = text.match(/S(\d+):E(\d+)/i);
          if (seasonEpisodeMatch) {
            episodeInfo.season = parseInt(seasonEpisodeMatch[1]);
            episodeInfo.episode = parseInt(seasonEpisodeMatch[2]);
            break;
          }
          
          // Parse "Season 1 Episode 5" format
          const seasonMatch = text.match(/Season\s+(\d+)/i);
          const episodeMatch = text.match(/Episode\s+(\d+)/i);
          if (seasonMatch) episodeInfo.season = parseInt(seasonMatch[1]);
          if (episodeMatch) episodeInfo.episode = parseInt(episodeMatch[1]);
        }
      }

      // Try to get episode title
      const episodeTitleElement = document.querySelector('[data-uia="episode-title"], .episode-title h3, .episode-title span');
      if (episodeTitleElement) {
        episodeInfo.episodeTitle = episodeTitleElement.textContent.trim();
      }

      return Object.keys(episodeInfo).length > 0 ? episodeInfo : null;
    } catch (error) {
      console.log('⚠️ Error extracting episode info:', error);
      return null;
    }
  }

  function getVideoDuration() {
    try {
      const video = document.querySelector('video');
      if (video && video.duration && !isNaN(video.duration)) {
        return Math.floor(video.duration);
      }
      
      // Try to get duration from UI elements
      const durationSelectors = [
        '[data-uia="video-duration"]',
        '.duration-text',
        '.time-remaining'
      ];
      
      for (const selector of durationSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const durationText = element.textContent;
          const durationMatch = durationText.match(/(\d+):(\d+)/);
          if (durationMatch) {
            return parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
          }
        }
      }
      
      return 0;
    } catch (error) {
      console.log('⚠️ Error getting duration:', error);
      return 0;
    }
  }

  function getPlaybackState() {
    try {
      const video = document.querySelector('video');
      if (video) {
        return {
          paused: video.paused,
          currentTime: video.currentTime,
          volume: video.volume,
          playbackRate: video.playbackRate,
          buffered: video.buffered.length > 0 ? video.buffered.end(0) : 0
        };
      }
      return null;
    } catch (error) {
      console.log('⚠️ Error getting playback state:', error);
      return null;
    }
  }

  function getAvailableAudioLanguages() {
    try {
      const languages = [];
      const audioSelectors = [
        '[data-uia="audio-track-selector"] option',
        '.audio-subtitle-controller .audio-tracks option',
        '[data-uia*="audio"] [data-uia*="language"]'
      ];

      for (const selector of audioSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const lang = element.textContent.trim();
          if (lang && !languages.includes(lang)) {
            languages.push(lang);
          }
        });
      }

      return languages;
    } catch (error) {
      console.log('⚠️ Error getting audio languages:', error);
      return [];
    }
  }

  function getAvailableSubtitleLanguages() {
    try {
      const languages = [];
      const subtitleSelectors = [
        '[data-uia="subtitle-track-selector"] option',
        '.audio-subtitle-controller .subtitle-tracks option',
        '[data-uia*="subtitle"] [data-uia*="language"]'
      ];

      for (const selector of subtitleSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const lang = element.textContent.trim();
          if (lang && !languages.includes(lang)) {
            languages.push(lang);
          }
        });
      }

      return languages;
    } catch (error) {
      console.log('⚠️ Error getting subtitle languages:', error);
      return [];
    }
  }

  function getVideoQuality() {
    try {
      const video = document.querySelector('video');
      if (video) {
        return {
          width: video.videoWidth,
          height: video.videoHeight,
          quality: video.videoHeight >= 2160 ? '4K' : 
                   video.videoHeight >= 1080 ? 'HD' : 
                   video.videoHeight >= 720 ? 'HD' : 'SD'
        };
      }
      return null;
    } catch (error) {
      console.log('⚠️ Error getting video quality:', error);
      return null;
    }
  }

  function extractGenre() {
    try {
      const genreSelectors = [
        '[data-uia="genre"]',
        '.video-metadata .genre',
        '.title-info-metadata .genre',
        '[data-uia*="genre"]'
      ];

      for (const selector of genreSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Error extracting genre:', error);
      return null;
    }
  }

  function extractYear() {
    try {
      const yearSelectors = [
        '[data-uia="video-year"]',
        '.video-metadata .year',
        '.title-info-metadata .year'
      ];

      for (const selector of yearSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const yearMatch = element.textContent.match(/(\d{4})/);
          if (yearMatch) {
            return parseInt(yearMatch[1]);
          }
        }
      }
      
      // Try extracting from title
      const title = document.title;
      const titleYearMatch = title.match(/\((\d{4})\)/);
      if (titleYearMatch) {
        return parseInt(titleYearMatch[1]);
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Error extracting year:', error);
      return null;
    }
  }

  function extractMaturityRating() {
    try {
      const ratingSelectors = [
        '[data-uia="maturity-rating"]',
        '.video-metadata .maturity-rating',
        '.title-info-metadata .rating',
        '[data-uia*="rating"]'
      ];

      for (const selector of ratingSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Error extracting maturity rating:', error);
      return null;
    }
  }

  function extractCastInfo() {
    try {
      const cast = [];
      const castSelectors = [
        '[data-uia="cast-info"] span',
        '.video-metadata .cast',
        '.title-info-metadata .cast'
      ];

      for (const selector of castSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const castMember = element.textContent.trim();
          if (castMember && !cast.includes(castMember)) {
            cast.push(castMember);
          }
        });
      }

      return cast.length > 0 ? cast : null;
    } catch (error) {
      console.log('⚠️ Error extracting cast info:', error);
      return null;
    }
  }

  function extractDescription() {
    try {
      const descriptionSelectors = [
        '[data-uia="video-synopsis"]',
        '.video-metadata .synopsis',
        '.title-info-metadata .description',
        '[data-uia*="synopsis"]'
      ];

      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Error extracting description:', error);
      return null;
    }
  }

  function getVideoInfo() {
    const videoId = extractNetflixVideoId();
    const title = extractVideoTitle();
    const timestamp = getCurrentTimestamp();

    if (videoId) {
      return {
        videoId,
        title,
        timestamp,
        url: createTimestampedUrl(timestamp),
        platform: 'netflix'
      };
    }
    return null;
  }

  // Get comprehensive video information
  function getComprehensiveVideoInfo() {
    const videoId = extractNetflixVideoId();
    if (videoId) {
      return extractDetailedVideoInfo();
    }
    return null;
  }

  // Enhanced language detection for Netflix content
  function detectLanguage() {
    try {
      // Check for language indicators in Netflix UI
      const langSelectors = [
        '[data-uia="audio-track-selector"] [aria-selected="true"]',
        '[data-uia="subtitle-track-selector"] [aria-selected="true"]',
        '.audio-subtitle-controller .language-selected',
        '[data-uia*="language"] [aria-selected="true"]',
        '.selected-language',
        '.active-track'
      ];

      for (const selector of langSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.toLowerCase();
          const lang = mapLanguageText(text);
          if (lang) return lang;
        }
      }

      // Try to get language from track attributes
      const activeTrack = document.querySelector('[data-uia*="track"][aria-selected="true"]');
      if (activeTrack) {
        const langAttr = activeTrack.getAttribute('data-language') || 
                        activeTrack.getAttribute('lang') ||
                        activeTrack.getAttribute('data-lang');
        if (langAttr) {
          return mapLanguageCode(langAttr);
        }
      }

      // Check video element track attributes
      const video = document.querySelector('video');
      if (video && video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const track = video.textTracks[i];
          if (track.mode === 'showing' && track.language) {
            return mapLanguageCode(track.language);
          }
        }
      }

      // Fallback to browser language
      return navigator.language.split('-')[0] || 'en';
    } catch (error) {
      console.log('⚠️ Language detection failed:', error);
      return 'en';
    }
  }

  // Map language text to language codes
  function mapLanguageText(text) {
    const languageMap = {
      // English variants
      'english': 'en', 'inglés': 'en', 'anglais': 'en', 'englisch': 'en',
      
      // Spanish variants  
      'spanish': 'es', 'español': 'es', 'espagnol': 'es', 'spanisch': 'es',
      'castilian': 'es', 'castellano': 'es',
      
      // French variants
      'french': 'fr', 'français': 'fr', 'francés': 'fr', 'französisch': 'fr',
      
      // German variants
      'german': 'de', 'deutsch': 'de', 'allemand': 'de', 'alemán': 'de',
      
      // Japanese variants
      'japanese': 'ja', 'japonés': 'ja', 'japonais': 'ja', 'japanisch': 'ja',
      '日本語': 'ja', 'にほんご': 'ja',
      
      // Korean variants
      'korean': 'ko', 'coreano': 'ko', 'coréen': 'ko', 'koreanisch': 'ko',
      '한국어': 'ko', '한글': 'ko',
      
      // Chinese variants
      'chinese': 'zh', 'chino': 'zh', 'chinois': 'zh', 'chinesisch': 'zh',
      'mandarin': 'zh', 'cantonese': 'zh',
      '中文': 'zh', '中国话': 'zh', '普通话': 'zh', '广东话': 'zh',
      
      // Portuguese variants
      'portuguese': 'pt', 'português': 'pt', 'portugués': 'pt', 'portugiesisch': 'pt',
      'brazilian': 'pt', 'brasileiro': 'pt',
      
      // Italian variants
      'italian': 'it', 'italiano': 'it', 'italien': 'it', 'italienisch': 'it',
      
      // Dutch variants
      'dutch': 'nl', 'holandés': 'nl', 'néerlandais': 'nl', 'niederländisch': 'nl',
      'nederlands': 'nl',
      
      // Russian variants
      'russian': 'ru', 'ruso': 'ru', 'russe': 'ru', 'russisch': 'ru',
      'русский': 'ru',
      
      // Arabic variants
      'arabic': 'ar', 'árabe': 'ar', 'arabe': 'ar', 'arabisch': 'ar',
      'العربية': 'ar',
      
      // Hindi variants
      'hindi': 'hi', 'हिन्दी': 'hi'
    };

    for (const [key, value] of Object.entries(languageMap)) {
      if (text.includes(key)) {
        return value;
      }
    }
    
    return null;
  }

  // Map language codes to standardized codes
  function mapLanguageCode(code) {
    const codeMap = {
      'en-US': 'en', 'en-GB': 'en', 'en-AU': 'en', 'en-CA': 'en',
      'es-ES': 'es', 'es-MX': 'es', 'es-AR': 'es', 'es-CL': 'es',
      'fr-FR': 'fr', 'fr-CA': 'fr', 'fr-BE': 'fr', 'fr-CH': 'fr',
      'de-DE': 'de', 'de-AT': 'de', 'de-CH': 'de',
      'ja-JP': 'ja',
      'ko-KR': 'ko',
      'zh-CN': 'zh', 'zh-TW': 'zh', 'zh-HK': 'zh',
      'pt-BR': 'pt', 'pt-PT': 'pt',
      'it-IT': 'it',
      'nl-NL': 'nl', 'nl-BE': 'nl',
      'ru-RU': 'ru',
      'ar-SA': 'ar', 'ar-EG': 'ar',
      'hi-IN': 'hi'
    };

    return codeMap[code] || code.split('-')[0] || 'en';
  }

  // Capture current Netflix subtitle text manually
  function captureCurrentNetflixSubtitle() {
    try {
      // Netflix subtitle selectors (multiple attempts)
      const subtitleSelectors = [
        '.player-timedtext-text-container',
        '.ltr-11vo9g5', // Netflix subtitle container
        '[data-uia="player-subtitle-text"]',
        '.subtitle-text',
        '.PlayerSubtitles',
        '.player-timedtext',
        '.timedtext',
        '[class*="subtitle"]',
        '[class*="timedtext"]'
      ];

      for (const selector of subtitleSelectors) {
        const subtitleElement = document.querySelector(selector);
        if (subtitleElement && subtitleElement.textContent.trim()) {
          const text = subtitleElement.textContent.trim();
          console.log('🎭 Captured Netflix subtitle:', text);
          return text;
        }
      }

      // Also try to find any visible text elements that might be subtitles
      const allTextElements = document.querySelectorAll('div, span, p');
      for (const element of allTextElements) {
        if (element.textContent && element.textContent.trim()) {
          const text = element.textContent.trim();
          // Check if element is positioned like a subtitle (bottom of screen)
          const rect = element.getBoundingClientRect();
          const isBottomPositioned = rect.bottom > window.innerHeight * 0.7;
          const isReasonableLength = text.length > 5 && text.length < 200;
          const isVisible = rect.width > 0 && rect.height > 0;
          
          if (isBottomPositioned && isReasonableLength && isVisible) {
            console.log('🎭 Found potential Netflix subtitle:', text);
            return text;
          }
        }
      }

      console.log('⚠️ No Netflix subtitle text found');
      return null;
    } catch (error) {
      console.log('⚠️ Error capturing Netflix subtitle:', error);
      return null;
    }
  }

  // Check subtitle collection status by communicating with subtitle extractor
  async function checkSubtitleCollectionStatus() {
    try {
      // Try to get status from the subtitle extractor script
      return new Promise((resolve) => {
        // Send a message to the subtitle extractor to check status
        const event = new CustomEvent('netflixStatusCheck', {
          detail: { action: 'getCollectionStatus' }
        });
        
        const statusHandler = (event) => {
          if (event.detail && event.detail.action === 'collectionStatus') {
            window.removeEventListener('netflixStatusResponse', statusHandler);
            resolve(event.detail.isCollecting || false);
          }
        };
        
        window.addEventListener('netflixStatusResponse', statusHandler);
        window.dispatchEvent(event);
        
        // Timeout after 100ms
        setTimeout(() => {
          window.removeEventListener('netflixStatusResponse', statusHandler);
          resolve(false);
        }, 100);
      });
    } catch (error) {
      console.log('⚠️ Error checking collection status:', error);
      return false;
    }
  }

  // Message handling
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (contextInvalidated) {
      sendResponse({ error: 'Context invalidated' });
      return;
    }

    console.log('🎬 Netflix content script received message:', request);

    try {
      switch (request.action) {
        case 'ping':
          console.log('🏓 Netflix ping received');
          
          // Check if subtitle collection is in progress (async)
          checkSubtitleCollectionStatus().then(isCollecting => {
            sendResponse({ 
              pong: true, 
              platform: 'netflix',
              isCollecting: isCollecting,
              videoId: extractNetflixVideoId(),
              title: extractVideoTitle(),
              timestamp: getCurrentTimestamp(),
              url: window.location.href
            });
          }).catch(error => {
            console.log('⚠️ Error in ping handler:', error);
            sendResponse({ 
              pong: true, 
              platform: 'netflix',
              isCollecting: false,
              videoId: extractNetflixVideoId(),
              title: extractVideoTitle(),
              timestamp: getCurrentTimestamp(),
              url: window.location.href
            });
          });
          return true; // Keep the message channel open for async response
          break;

        case 'getTimestamp':
          const timestamp = getCurrentTimestamp();
          console.log('⏰ Netflix timestamp requested:', timestamp);
          sendResponse({ 
            success: true, 
            timestamp,
            url: createTimestampedUrl(timestamp)
          });
          break;

        case 'getVideoInfo':
          const videoInfo = getVideoInfo();
          console.log('📱 Netflix video info requested:', videoInfo);
          sendResponse({
            success: !!videoInfo,
            videoInfo
          });
          break;

        case 'getComprehensiveVideoInfo':
          const comprehensiveInfo = getComprehensiveVideoInfo();
          console.log('📊 Netflix comprehensive video info requested:', comprehensiveInfo);
          sendResponse({
            success: !!comprehensiveInfo,
            videoInfo: comprehensiveInfo,
            metadata: comprehensiveInfo
          });
          break;

        case 'analyzeTextInSidepanel':
          const currentVideoInfo = getVideoInfo();
          if (currentVideoInfo) {
            console.log('📝 Sending Netflix text to sidepanel for analysis');
            
            chrome.runtime.sendMessage({
              action: 'analyzeTextInSidepanel',
              text: request.text,
              url: currentVideoInfo.url,
              title: currentVideoInfo.title,
              language: detectLanguage(),
              source: 'netflix-learning',
              platform: 'netflix',
              videoId: currentVideoInfo.videoId,
              timestamp: currentVideoInfo.timestamp
            }).then(() => {
              sendResponse({ success: true });
            }).catch(error => {
              console.error('❌ Failed to send to sidepanel:', error);
              sendResponse({ success: false, error: error.message });
            });
          } else {
            sendResponse({ 
              success: false, 
              error: 'Could not extract Netflix video information' 
            });
          }
          break;

        case 'captureCurrentSubtitle':
          console.log('🎭 Manual Netflix subtitle capture requested');
          const capturedText = captureCurrentNetflixSubtitle();
          if (capturedText) {
            sendResponse({ 
              success: true, 
              text: capturedText,
              timestamp: getCurrentTimestamp(),
              videoInfo: getVideoInfo()
            });
          } else {
            sendResponse({ 
              success: false, 
              error: 'No subtitle text found. Make sure subtitles are enabled and visible.' 
            });
          }
          break;

        default:
          console.log('❓ Unknown action for Netflix:', request.action);
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('❌ Netflix content script error:', error);
      sendResponse({ error: error.message });
    }

    return true; // Keep message channel open for async responses
  });

  // Context invalidation handling
  chrome.runtime.onConnect.addListener(() => {
    // Connection established - reset invalidation flag
    contextInvalidated = false;
  });

  // Handle context invalidation
  function handleContextInvalidation() {
    contextInvalidated = true;
    console.log('⚠️ Netflix extension context invalidated');
  }

  chrome.runtime.id && chrome.runtime.onMessage.addListener(() => {
    // Test if context is still valid
  });

  // Monitor for video changes
  let currentUrl = window.location.href;
  
  function handleUrlChange() {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log('🔄 Netflix URL changed:', currentUrl);
      
      // Update video info
      const newVideoInfo = getVideoInfo();
      const comprehensiveInfo = getComprehensiveVideoInfo();
      
      if (newVideoInfo && newVideoInfo.videoId !== lastKnownVideoId) {
        lastKnownVideoId = newVideoInfo.videoId;
        lastKnownTitle = newVideoInfo.title;
        currentVideoInfo = comprehensiveInfo || newVideoInfo;
        
        console.log('🎬 Netflix video changed:', newVideoInfo);
        console.log('📊 Netflix comprehensive info:', comprehensiveInfo);
        
        // Notify background script of video change with comprehensive info
        chrome.runtime.sendMessage({
          action: 'netflixVideoChanged',
          videoInfo: newVideoInfo,
          comprehensiveInfo: comprehensiveInfo
        }).catch(handleContextInvalidation);
      }
    }
  }

  // Monitor URL changes (Netflix is SPA)
  setInterval(handleUrlChange, 1000);

  // Monitor for Netflix-specific events
  function setupNetflixEventListeners() {
    // Listen for video player events
    document.addEventListener('click', (event) => {
      // Handle clicks on subtitle/language controls
      const target = event.target;
      if (target.closest('[data-uia*="subtitle"]') || 
          target.closest('[data-uia*="audio"]') ||
          target.closest('.audio-subtitle-controller')) {
        
        setTimeout(() => {
          const newLang = detectLanguage();
          console.log('🌐 Netflix language may have changed:', newLang);
        }, 500);
      }
    });

    // Monitor for player state changes
    const observer = new MutationObserver((mutations) => {
      // Check for video element changes
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          const hasVideo = Array.from(mutation.addedNodes).some(node => 
            node.nodeType === 1 && 
            (node.tagName === 'VIDEO' || node.querySelector('video'))
          );
          
          if (hasVideo) {
            console.log('🎥 Netflix video element detected');
            handleUrlChange(); // Update video info
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('👂 Netflix event listeners set up');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupNetflixEventListeners);
  } else {
    setupNetflixEventListeners();
  }

  // Initialize video info
  setTimeout(() => {
    const initialInfo = getVideoInfo();
    const comprehensiveInfo = getComprehensiveVideoInfo();
    
    if (initialInfo) {
      lastKnownVideoId = initialInfo.videoId;
      lastKnownTitle = initialInfo.title;
      currentVideoInfo = comprehensiveInfo || initialInfo;
      console.log('🎬 Initial Netflix video info:', initialInfo);
      console.log('📊 Initial Netflix comprehensive info:', comprehensiveInfo);
      
      // Notify background script of initial video info
      chrome.runtime.sendMessage({
        action: 'netflixVideoInitialized',
        videoInfo: initialInfo,
        comprehensiveInfo: comprehensiveInfo
      }).catch(handleContextInvalidation);
    }
  }, 1000);

  console.log('✅ Netflix content script initialized');

})();