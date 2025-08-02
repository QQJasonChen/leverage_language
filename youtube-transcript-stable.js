// ULTRA-STABLE YouTube Transcript Content Script
// Focused on 60seconds max with zero crashes and quality timestamps

(function() {
  'use strict';

  console.log('🛡️ ULTRA-STABLE YouTube transcript content script loaded');

  // Ultra-minimal state - ONLY what we absolutely need
  let stableCollection = {
    segments: [],
    isRecording: false,
    startTime: 0,
    mediaRecorder: null,
    audioStream: null,
    recordingTimer: null,
    hasRecordedOnce: false // Prevent multiple recordings
  };

  // Listen for requests from extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🛡️ STABLE transcript content script received message:', request);
    
    if (request.action === 'ping') {
      console.log('🏓 Ping received, sending pong...');
      sendResponse({ 
        pong: true, 
        timestamp: Date.now(), 
        url: window.location.href,
        videoId: extractVideoId(),
        isCollecting: stableCollection.isRecording,
        collectedSegments: stableCollection.segments.length,
        hasRecordedOnce: stableCollection.hasRecordedOnce
      });
      return false;
    }
    
    if (request.action === 'startCaptionCollection') {
      console.log('🎯 Starting ULTRA-STABLE 60-second collection...');
      startStableCollection();
      sendResponse({ 
        success: true, 
        message: 'Ultra-stable 60s collection started'
      });
      return false;
    }

    if (request.action === 'stopCaptionCollection') {
      console.log('🛑 Stopping collection...');
      const result = stopStableCollection();
      sendResponse(result);
      return false;
    }

    return false;
  });

  function extractVideoId() {
    const match = window.location.href.match(/[?&]v=([^&#]*)/);
    return match ? match[1] : null;
  }

  async function startStableCollection() {
    // PREVENT multiple recordings - this is critical for stability
    if (stableCollection.isRecording || stableCollection.hasRecordedOnce) {
      console.log('🚫 Recording already done or in progress - skipping');
      return;
    }

    try {
      console.log('🎙️ Requesting microphone for 60-second recording...');
      
      // Ultra-simple audio request - no complex settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      console.log('✅ Microphone granted - starting 60s recording');
      
      stableCollection.audioStream = stream;
      stableCollection.isRecording = true;
      stableCollection.hasRecordedOnce = true;
      stableCollection.startTime = Date.now();
      stableCollection.segments = []; // Fresh start

      // Ultra-simple MediaRecorder - no complex options
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      stableCollection.mediaRecorder = mediaRecorder;

      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          console.log(`🎵 Audio chunk: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎵 Recording stopped - processing audio...');
        
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          await processAudioBlob(audioBlob);
        }
        
        // Clean up immediately
        cleanup();
      };

      // Start recording
      mediaRecorder.start();
      console.log('🔴 Recording started - will auto-stop in 60 seconds');

      // HARD STOP after exactly 60 seconds - this prevents crashes
      stableCollection.recordingTimer = setTimeout(() => {
        console.log('⏰ 60 seconds elapsed - auto-stopping');
        if (stableCollection.mediaRecorder && stableCollection.mediaRecorder.state === 'recording') {
          stableCollection.mediaRecorder.stop();
        }
      }, 60000); // Exactly 60 seconds

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      cleanup();
      throw error;
    }
  }

  async function processAudioBlob(audioBlob) {
    try {
      console.log('🤖 Sending to Whisper API...');
      
      // Get API key from extension storage
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please set it in extension options.');
      }
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'word');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Whisper transcription received');

      // Create quality segments with precise timestamps
      createQualitySegments(result);

    } catch (error) {
      console.error('❌ Transcription failed:', error);
      // Create fallback segment with error info
      stableCollection.segments = [{
        text: `[Recording completed but transcription failed: ${error.message}]`,
        timestamp: '0:00',
        timestampSeconds: 0,
        duration: 60,
        quality: 'error'
      }];
    }
  }

  function createQualitySegments(whisperResult) {
    console.log('📝 Creating quality segments with precise timestamps...');
    
    const segments = [];
    const words = whisperResult.words || [];
    
    if (words.length === 0) {
      // Fallback to text-only with consistent format
      segments.push({
        text: whisperResult.text || '[No transcription available]',
        timestamp: '0:00',
        timestampSeconds: 0,
        duration: 60,
        quality: 'basic',
        confidence: 0.5,
        wordCount: 0
      });
    } else {
      console.log(`🔍 Processing ${words.length} words for high-quality segmentation...`);
      
      // Enhanced segmentation with better boundary detection
      let currentSegment = {
        words: [],
        startTime: words[0].start,
        endTime: words[0].end,
        text: ''
      };

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const nextWord = words[i + 1];
        
        currentSegment.words.push(word);
        currentSegment.endTime = word.end;
        currentSegment.text += word.word;

        // Enhanced segment boundary detection
        const hasNaturalBreak = word.word.match(/[.!?]/);
        const hasLongPause = nextWord && (nextWord.start - word.end) > 1.0; // 1 second pause
        const reachedMaxWords = currentSegment.words.length >= 12;
        const isLastWord = i === words.length - 1;
        
        const shouldEndSegment = hasNaturalBreak || hasLongPause || reachedMaxWords || isLastWord;

        if (shouldEndSegment) {
          // Calculate confidence based on word-level confidence if available
          let avgConfidence = 0.8; // Default confidence
          if (currentSegment.words.some(w => w.confidence !== undefined)) {
            avgConfidence = currentSegment.words.reduce((sum, w) => sum + (w.confidence || 0.8), 0) / currentSegment.words.length;
          }
          
          // Add the completed segment with enhanced metadata
          segments.push({
            text: currentSegment.text.trim().replace(/\s+/g, ' '), // Clean up spacing
            timestamp: formatTimestamp(currentSegment.startTime),
            timestampSeconds: Math.round(currentSegment.startTime * 10) / 10, // Round to 0.1s precision
            duration: Math.round((currentSegment.endTime - currentSegment.startTime) * 10) / 10,
            quality: avgConfidence > 0.7 ? 'high' : 'medium',
            confidence: Math.round(avgConfidence * 100) / 100,
            wordCount: currentSegment.words.length,
            segmentType: hasNaturalBreak ? 'sentence' : hasLongPause ? 'pause' : 'chunk'
          });

          // Start new segment if there are more words
          if (i < words.length - 1) {
            currentSegment = {
              words: [],
              startTime: nextWord.start,
              endTime: nextWord.end,
              text: ''
            };
          }
        }
      }
    }

    stableCollection.segments = segments;
    console.log(`✨ Created ${segments.length} quality segments with precise timestamps`);
    
    // Log segment quality distribution
    const qualityCounts = segments.reduce((acc, seg) => {
      acc[seg.quality] = (acc[seg.quality] || 0) + 1;
      return acc;
    }, {});
    console.log('📊 Segment quality distribution:', qualityCounts);
  }

  function formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function stopStableCollection() {
    console.log('🛑 Stopping stable collection...');
    
    const duration = stableCollection.startTime ? 
      (Date.now() - stableCollection.startTime) / 1000 : 0;

    if (stableCollection.mediaRecorder && stableCollection.mediaRecorder.state === 'recording') {
      stableCollection.mediaRecorder.stop();
    }

    const result = {
      success: stableCollection.segments.length > 0,
      segments: stableCollection.segments,
      duration: duration,
      message: stableCollection.segments.length > 0 ? 
        `Collected ${stableCollection.segments.length} segments` : 
        'No segments collected'
    };

    cleanup();
    return result;
  }

  function cleanup() {
    console.log('🧹 Cleaning up resources...');
    
    // Stop and clean up audio stream
    if (stableCollection.audioStream) {
      stableCollection.audioStream.getTracks().forEach(track => track.stop());
      stableCollection.audioStream = null;
    }

    // Clear timer
    if (stableCollection.recordingTimer) {
      clearTimeout(stableCollection.recordingTimer);
      stableCollection.recordingTimer = null;
    }

    // Reset state
    stableCollection.mediaRecorder = null;
    stableCollection.isRecording = false;
    
    console.log('✅ Cleanup complete');
  }

  async function getApiKey() {
    try {
      const result = await chrome.storage.sync.get(['apiKey']);
      return result.apiKey || null;
    } catch (error) {
      console.error('❌ Failed to get API key:', error);
      return null;
    }
  }

  console.log('🛡️ Ultra-stable transcript system ready');

})();