// Netflix Page Script - Runs in page context for deeper API access
// Accesses Netflix's internal APIs and player functions

(function() {
  'use strict';

  console.log('🎭 Netflix Page Script injected');

  // Netflix internal object references
  let netflixPlayer = null;
  let netflixVideoElement = null;
  
  // Create communication channel with content script
  function createMessageChannel() {
    // Listen for messages from content script
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'NETFLIX_LEARNING_REQUEST') {
        handleNetflixRequest(event.data.payload);
      }
    });

    // Send response back to content script
    function sendResponse(data) {
      window.postMessage({
        type: 'NETFLIX_LEARNING_RESPONSE',
        payload: data
      }, '*');
    }

    return { sendResponse };
  }

  // Handle requests from content script
  function handleNetflixRequest(request) {
    console.log('🎯 Netflix page script request:', request);
    
    const { sendResponse } = createMessageChannel();

    switch (request.action) {
      case 'getPlayerInfo':
        const playerInfo = getNetflixPlayerInfo();
        sendResponse({ success: true, playerInfo });
        break;

      case 'getSubtitleTracks':
        const tracks = getAvailableSubtitleTracks();
        sendResponse({ success: true, tracks });
        break;

      case 'setSubtitleTrack':
        const result = setSubtitleTrack(request.trackId);
        sendResponse({ success: result });
        break;

      case 'getCurrentTime':
        const currentTime = getCurrentVideoTime();
        sendResponse({ success: true, currentTime });
        break;

      case 'seekTo':
        const seekResult = seekToTime(request.time);
        sendResponse({ success: seekResult });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  // Find Netflix player instance
  function findNetflixPlayer() {
    try {
      // Try multiple ways to access Netflix player
      if (window.netflix && window.netflix.cadmium) {
        const player = window.netflix.cadmium.objects.videoPlayer;
        if (player) {
          console.log('🎬 Found Netflix Cadmium player');
          return player;
        }
      }

      // Try accessing through global netflix object
      if (window.netflix && window.netflix.player) {
        console.log('🎬 Found Netflix player object');
        return window.netflix.player;
      }

      // Try finding player through DOM
      const playerContainer = document.querySelector('.watch-video');
      if (playerContainer && playerContainer._reactInternalInstance) {
        console.log('🎬 Found Netflix player through React');
        return playerContainer;
      }

      // Fallback to video element
      const video = document.querySelector('video');
      if (video) {
        console.log('🎬 Found Netflix video element');
        return video;
      }

      return null;
    } catch (error) {
      console.log('⚠️ Error finding Netflix player:', error);
      return null;
    }
  }

  // Get comprehensive player information
  function getNetflixPlayerInfo() {
    try {
      const player = findNetflixPlayer();
      const video = document.querySelector('video');
      
      const info = {
        hasPlayer: !!player,
        hasVideo: !!video,
        currentTime: video ? video.currentTime : 0,
        duration: video ? video.duration : 0,
        paused: video ? video.paused : true,
        volume: video ? video.volume : 1,
        playbackRate: video ? video.playbackRate : 1
      };

      // Try to get Netflix-specific info
      if (window.netflix && window.netflix.cadmium) {
        const metadata = window.netflix.cadmium.metadata;
        if (metadata) {
          info.movieId = metadata.movieId;
          info.title = metadata.title;
          info.year = metadata.year;
          info.runtime = metadata.runtime;
        }
      }

      return info;
    } catch (error) {
      console.log('⚠️ Error getting player info:', error);
      return { hasPlayer: false, error: error.message };
    }
  }

  // Get available subtitle tracks
  function getAvailableSubtitleTracks() {
    try {
      const tracks = [];

      // Try to access subtitle tracks through Netflix API
      if (window.netflix && window.netflix.cadmium) {
        const textTracks = window.netflix.cadmium.textTracks;
        if (textTracks) {
          textTracks.forEach((track, index) => {
            tracks.push({
              id: track.id || index,
              language: track.language,
              label: track.label,
              kind: track.kind,
              active: track.active
            });
          });
        }
      }

      // Fallback to HTML5 text tracks
      const video = document.querySelector('video');
      if (video && video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const track = video.textTracks[i];
          tracks.push({
            id: i,
            language: track.language,
            label: track.label,
            kind: track.kind,
            mode: track.mode
          });
        }
      }

      console.log(`🌐 Found ${tracks.length} subtitle tracks`);
      return tracks;
    } catch (error) {
      console.log('⚠️ Error getting subtitle tracks:', error);
      return [];
    }
  }

  // Set active subtitle track
  function setSubtitleTrack(trackId) {
    try {
      // Try Netflix-specific method
      if (window.netflix && window.netflix.cadmium && window.netflix.cadmium.setTextTrack) {
        window.netflix.cadmium.setTextTrack(trackId);
        console.log('✅ Set Netflix subtitle track:', trackId);
        return true;
      }

      // Fallback to HTML5 method
      const video = document.querySelector('video');
      if (video && video.textTracks) {
        // Disable all tracks
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = 'disabled';
        }
        
        // Enable selected track
        if (video.textTracks[trackId]) {
          video.textTracks[trackId].mode = 'showing';
          console.log('✅ Set HTML5 subtitle track:', trackId);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.log('⚠️ Error setting subtitle track:', error);
      return false;
    }
  }

  // Get current video time
  function getCurrentVideoTime() {
    try {
      const video = document.querySelector('video');
      return video ? video.currentTime : 0;
    } catch (error) {
      console.log('⚠️ Error getting current time:', error);
      return 0;
    }
  }

  // Seek to specific time
  function seekToTime(timeInSeconds) {
    try {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = timeInSeconds;
        console.log('⏭️ Seeked to:', timeInSeconds);
        return true;
      }
      return false;
    } catch (error) {
      console.log('⚠️ Error seeking:', error);
      return false;
    }
  }

  // Monitor for Netflix player changes
  function monitorNetflixPlayer() {
    let lastPlayerState = null;

    setInterval(() => {
      const player = findNetflixPlayer();
      const video = document.querySelector('video');
      
      if (video && (!netflixVideoElement || netflixVideoElement !== video)) {
        console.log('🎥 Netflix video element changed');
        netflixVideoElement = video;
        
        // Set up video event listeners
        video.addEventListener('timeupdate', () => {
          // Could send time updates to content script if needed
        });

        video.addEventListener('loadedmetadata', () => {
          console.log('📊 Netflix video metadata loaded');
          window.postMessage({
            type: 'NETFLIX_LEARNING_RESPONSE',
            payload: {
              type: 'videoLoaded',
              duration: video.duration,
              currentTime: video.currentTime
            }
          }, '*');
        });
      }

      if (player && player !== netflixPlayer) {
        console.log('🎬 Netflix player instance changed');
        netflixPlayer = player;
      }
    }, 1000);
  }

  // Enhance Netflix API access
  function enhanceNetflixAccess() {
    // Try to expose more Netflix internals
    try {
      if (window.netflix) {
        // Make player more accessible
        window.netflixLearningPlayer = window.netflix;
        
        // Hook into player events if possible
        if (window.netflix.cadmium && window.netflix.cadmium.addEventListener) {
          window.netflix.cadmium.addEventListener('timeupdate', (event) => {
            window.postMessage({
              type: 'NETFLIX_LEARNING_RESPONSE',
              payload: {
                type: 'timeUpdate',
                currentTime: event.currentTime || getCurrentVideoTime()
              }
            }, '*');
          });
        }
      }
    } catch (error) {
      console.log('⚠️ Error enhancing Netflix access:', error);
    }
  }

  // Hook into Netflix's internal APIs for subtitle access
  function hookSubtitleAPIs() {
    try {
      // Hook into XMLHttpRequest for subtitle requests
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._netflixUrl = url;
        return originalXHROpen.call(this, method, url, ...args);
      };

      XMLHttpRequest.prototype.send = function(data) {
        const xhr = this;
        
        xhr.addEventListener('load', function() {
          if (xhr._netflixUrl && typeof xhr._netflixUrl === 'string') {
            // Check for subtitle-related URLs
            if (xhr._netflixUrl.includes('timedtext') || 
                xhr._netflixUrl.includes('.webvtt') ||
                xhr._netflixUrl.includes('.dfxp')) {
              
              console.log('🎯 Subtitle request intercepted:', xhr._netflixUrl);
              
              window.postMessage({
                type: 'NETFLIX_LEARNING_RESPONSE',
                payload: {
                  type: 'subtitleRequest',
                  url: xhr._netflixUrl,
                  response: xhr.responseText
                }
              }, '*');
            }
          }
        });
        
        return originalXHRSend.call(this, data);
      };

      console.log('🕵️ Netflix subtitle APIs hooked');
    } catch (error) {
      console.log('⚠️ Error hooking subtitle APIs:', error);
    }
  }

  // Create floating learning button
  function createLearningButton() {
    // Check if button already exists
    if (document.getElementById('netflix-learning-btn')) return;

    const button = document.createElement('div');
    button.id = 'netflix-learning-btn';
    button.innerHTML = '📚';
    button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: #e50914;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    `;

    button.addEventListener('click', () => {
      console.log('📚 Netflix learning button clicked');
      
      // Open side panel
      window.postMessage({
        type: 'NETFLIX_LEARNING_RESPONSE',
        payload: {
          type: 'learningButtonClicked'
        }
      }, '*');
    });

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });

    document.body.appendChild(button);
    console.log('📚 Netflix learning button created');
  }

  // Initialize page script
  function initialize() {
    console.log('🚀 Initializing Netflix page script');
    
    // Set up message communication
    createMessageChannel();
    
    // Start monitoring
    monitorNetflixPlayer();
    
    // Enhance Netflix access
    enhanceNetflixAccess();
    
    // Hook subtitle APIs
    hookSubtitleAPIs();
    
    // Create learning button
    setTimeout(createLearningButton, 2000);
    
    console.log('✅ Netflix page script initialized');
  }

  // Wait for Netflix to be ready
  function waitForNetflix() {
    if (window.netflix || document.querySelector('video')) {
      initialize();
    } else {
      setTimeout(waitForNetflix, 1000);
    }
  }

  waitForNetflix();

})();