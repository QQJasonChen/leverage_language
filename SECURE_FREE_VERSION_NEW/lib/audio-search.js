// Audio Search Service - Voice-to-Text for Language Learning
// Supports both Web Speech API (free) and OpenAI Whisper (premium)

class AudioSearchService {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recognition = null;
    this.settings = {
      useWhisper: true, // Default to OpenAI Whisper for better accuracy
      whisperApiKey: '',
      language: 'auto', // Auto-detect or specific language
      maxRecordingTime: 30000, // 30 seconds max
      audioQuality: 'high' // Use high quality for better accuracy
    };
    
    // Initialize Web Speech API if available
    this.initWebSpeechAPI();
  }

  // Initialize Web Speech API (free option)
  initWebSpeechAPI() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 3;
      
      console.log('🎤 Web Speech API initialized');
    } else {
      console.warn('⚠️ Web Speech API not supported in this browser');
    }
  }

  // Load settings from storage
  async loadSettings() {
    console.log('🔧 Starting to load audio search settings...');
    try {
      const result = await chrome.storage.sync.get([
        'audioSearch_useWhisper',
        'apiKey', // Use the same API key as the main AI service
        'audioSearch_language',
        'audioSearch_maxRecordingTime',
        'audioSearch_audioQuality'
      ]);

      console.log('🔧 Raw storage result:', JSON.stringify(result, null, 2));

      this.settings = {
        useWhisper: result.audioSearch_useWhisper !== undefined ? result.audioSearch_useWhisper : true,
        whisperApiKey: result.apiKey || '', // Use the main AI service API key
        language: result.audioSearch_language || 'auto',
        maxRecordingTime: result.audioSearch_maxRecordingTime || 30000,
        audioQuality: result.audioSearch_audioQuality || 'high'
      };

      console.log('🎤 Audio search settings loaded:', this.settings);
      console.log('🔑 API key present:', !!this.settings.whisperApiKey);
      console.log('🔑 API key length:', this.settings.whisperApiKey?.length || 0);
      console.log('🔧 Settings loading completed successfully');
    } catch (error) {
      console.error('❌ Failed to load audio search settings:', error);
      // Fallback to default settings with Web Speech API if loading fails
      this.settings.useWhisper = false;
      console.log('🔧 Falling back to Web Speech API due to settings loading failure');
    }
  }

  // Save settings to storage
  async saveSettings(newSettings) {
    try {
      const settingsToSave = {};
      Object.keys(newSettings).forEach(key => {
        settingsToSave[`audioSearch_${key}`] = newSettings[key];
      });

      console.log('💾 Settings to save:', JSON.stringify(settingsToSave, null, 2));
      await chrome.storage.sync.set(settingsToSave);
      this.settings = { ...this.settings, ...newSettings };
      
      console.log('💾 Audio search settings saved:', newSettings);
      console.log('💾 Updated settings object:', this.settings);
    } catch (error) {
      console.error('❌ Failed to save audio search settings:', error);
    }
  }

  // Check if microphone permission is granted
  async checkMicrophonePermission() {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' });
      console.log('🎤 Microphone permission status:', permission.state);
      return permission.state === 'granted';
    } catch (error) {
      console.warn('⚠️ Could not check microphone permission:', error);
      return false;
    }
  }

  // Request microphone access
  async requestMicrophoneAccess() {
    try {
      // Check if we're in an extension context
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        // We're in an extension - need to handle permissions differently
        console.log('🔧 Extension context detected, requesting microphone access...');
        
        // First try direct access (might work in some contexts)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: this.getAudioSampleRate(),
              channelCount: 1, // Mono for better speech recognition
              sampleSize: 16
            }
          });
          console.log('✅ Microphone access granted');
          return stream;
        } catch (directError) {
          console.log('⚠️ Direct microphone access failed, opening permissions page...');
          
          // Send message to background script to open permission page
          chrome.runtime.sendMessage({
            action: 'openMicrophonePermission'
          });
          
          throw new Error('Microphone permission needed. A new tab will open to grant permission. Please allow microphone access and try again.');
        }
      } else {
        // Regular web context
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: this.getAudioSampleRate(),
            channelCount: 1, // Mono for better speech recognition
            sampleSize: 16
          }
        });
        
        console.log('✅ Microphone access granted');
        return stream;
      }
    } catch (error) {
      console.error('❌ Microphone access denied:', error);
      throw new Error('Microphone access is required for voice search. Please allow microphone permission.');
    }
  }

  // Get audio sample rate based on quality setting
  getAudioSampleRate() {
    switch (this.settings.audioQuality) {
      case 'low': return 16000;
      case 'high': return 48000;
      default: return 22050; // medium
    }
  }

  // Start voice recording and recognition
  async startVoiceSearch(onResult, onError, onStatusUpdate) {
    if (this.isRecording) {
      console.warn('⚠️ Already recording');
      return;
    }

    try {
      // Settings should already be loaded during initialization
      console.log('🔧 Current settings before voice search:', this.settings);
      
      // Always try to request microphone access to trigger browser prompt
      // This ensures the permission prompt is shown even if previously denied
      try {
        await this.requestMicrophoneAccess();
      } catch (error) {
        // If permission is denied, show the error
        throw error;
      }

      this.isRecording = true;
      onStatusUpdate?.('🎤 Starting voice recognition...');

      if (this.settings.useWhisper) {
        console.log('🔍 Checking Whisper API key...');
        console.log('🔑 API key value:', this.settings.whisperApiKey);
        console.log('🔑 API key type:', typeof this.settings.whisperApiKey);
        console.log('🔑 API key trimmed length:', this.settings.whisperApiKey?.trim()?.length || 0);
        
        if (!this.settings.whisperApiKey || !this.settings.whisperApiKey.trim()) {
          throw new Error('OpenAI API key required for Whisper. Click the gear icon next to the microphone to add your API key, or switch to Web Speech API in settings.');
        }
        // Use OpenAI Whisper (premium)
        await this.startWhisperRecording(onResult, onError, onStatusUpdate);
      } else {
        // Use Web Speech API (free)
        await this.startWebSpeechRecognition(onResult, onError, onStatusUpdate);
      }

    } catch (error) {
      this.isRecording = false;
      console.error('❌ Failed to start voice search:', error);
      onError?.(error.message);
    }
  }

  // Stop voice recording
  stopVoiceSearch() {
    if (!this.isRecording) return;

    this.isRecording = false;

    // Stop Web Speech API
    if (this.recognition) {
      this.recognition.stop();
    }

    // Stop MediaRecorder for Whisper
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    console.log('🛑 Voice search stopped');
  }

  // Web Speech API implementation (free)
  async startWebSpeechRecognition(onResult, onError, onStatusUpdate) {
    if (!this.recognition) {
      throw new Error('Web Speech API not supported in this browser');
    }

    // Set language
    this.recognition.lang = this.getWebSpeechLanguage();

    this.recognition.onstart = () => {
      console.log('🎤 Web Speech recognition started');
      onStatusUpdate?.('🎤 Listening... Speak now!');
    };

    this.recognition.onresult = (event) => {
      try {
        const results = [];
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            for (let j = 0; j < result.length; j++) {
              results.push({
                text: result[j].transcript.trim(),
                confidence: result[j].confidence,
                language: this.recognition.lang
              });
            }
          }
        }

        if (results.length > 0) {
          console.log('🎤 Web Speech results:', results);
          onResult?.(results[0]); // Use best result
        }
      } catch (error) {
        console.error('❌ Error processing speech results:', error);
        onError?.(error.message);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('❌ Web Speech error:', event.error);
      this.isRecording = false;
      
      let errorMessage = 'Speech recognition failed';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
      }
      
      onError?.(errorMessage);
    };

    this.recognition.onend = () => {
      console.log('🎤 Web Speech recognition ended');
      this.isRecording = false;
      onStatusUpdate?.('🎤 Recognition completed');
    };

    // Start recognition
    this.recognition.start();

    // Auto-stop after max recording time
    setTimeout(() => {
      if (this.isRecording) {
        this.stopVoiceSearch();
      }
    }, this.settings.maxRecordingTime);
  }

  // OpenAI Whisper implementation (premium)
  async startWhisperRecording(onResult, onError, onStatusUpdate) {
    try {
      const stream = await this.requestMicrophoneAccess();
      
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedMimeType()
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        try {
          onStatusUpdate?.('🤖 Processing with OpenAI Whisper...');
          
          const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
          const result = await this.sendToWhisper(audioBlob);
          
          console.log('🤖 Whisper result:', result);
          onResult?.(result);
          
          // Clean up
          stream.getTracks().forEach(track => track.stop());
        } catch (error) {
          console.error('❌ Whisper processing error:', error);
          onError?.(error.message);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event.error);
        onError?.('Recording failed: ' + event.error);
      };

      // Start recording
      this.mediaRecorder.start(250); // Collect data every 250ms for better quality
      onStatusUpdate?.('🎤 Recording Dutch... Speak clearly and slowly');

      // Show countdown for better UX
      let timeLeft = this.settings.maxRecordingTime / 1000;
      const countdownInterval = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft > 0 && this.isRecording) {
          onStatusUpdate?.(`🎤 Recording... ${timeLeft}s left`);
        } else {
          clearInterval(countdownInterval);
        }
      }, 1000);

      // Auto-stop after max recording time
      setTimeout(() => {
        clearInterval(countdownInterval);
        if (this.isRecording && this.mediaRecorder.state === 'recording') {
          onStatusUpdate?.('🎤 Processing audio...');
          this.mediaRecorder.stop();
        }
      }, this.settings.maxRecordingTime);

    } catch (error) {
      console.error('❌ Failed to start Whisper recording:', error);
      onError?.(error.message);
    }
  }

  // Send audio to OpenAI Whisper API
  async sendToWhisper(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    
    // Always specify Dutch for better accuracy when learning Dutch
    if (this.settings.language !== 'auto') {
      formData.append('language', this.getWhisperLanguageCode());
    } else {
      // Default to Dutch for auto-detection since you're learning Dutch
      formData.append('language', 'nl');
    }
    
    // Add temperature for more flexible transcription
    formData.append('temperature', '0.2');
    
    // Add prompt to help with Dutch context
    const dutchPrompt = "Nederlandse woorden en zinnen. Common Dutch phrases like 'hoe gaat het', 'dank je wel', 'tot ziens'.";
    formData.append('prompt', dutchPrompt);

    console.log('🤖 Sending to Whisper with language:', this.settings.language !== 'auto' ? this.getWhisperLanguageCode() : 'nl');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.settings.whisperApiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Whisper API error: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();
    console.log('🤖 Raw Whisper result:', result);
    
    return {
      text: result.text.trim(),
      confidence: 1.0, // Whisper doesn't provide confidence scores
      language: result.language || 'nl',
      provider: 'whisper'
    };
  }

  // Get supported MIME type for recording
  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  // Convert language setting to Web Speech API format
  getWebSpeechLanguage() {
    const languageMap = {
      'english': 'en-US',
      'dutch': 'nl-NL', 
      'japanese': 'ja-JP',
      'korean': 'ko-KR',
      'chinese': 'zh-CN',
      'auto': 'en-US' // Default to English for auto
    };

    return languageMap[this.settings.language] || 'en-US';
  }

  // Convert language setting to Whisper API format
  getWhisperLanguageCode() {
    const languageMap = {
      'english': 'en',
      'dutch': 'nl',
      'japanese': 'ja', 
      'korean': 'ko',
      'chinese': 'zh'
    };

    return languageMap[this.settings.language] || 'en';
  }

  // Check if Whisper is available and configured
  isWhisperAvailable() {
    return this.settings.useWhisper && this.settings.whisperApiKey;
  }

  // Check if Web Speech API is available
  isWebSpeechAvailable() {
    return this.recognition !== null;
  }

  // Get available recognition methods
  getAvailableMethods() {
    return {
      webSpeech: this.isWebSpeechAvailable(),
      whisper: this.isWhisperAvailable(),
      current: this.settings.useWhisper ? 'whisper' : 'webSpeech'
    };
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.AudioSearchService = AudioSearchService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioSearchService;
}