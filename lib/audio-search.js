// Audio Search Service - Voice-to-Text for Language Learning
// Supports both Web Speech API (free) and OpenAI Whisper (premium)

class AudioSearchService {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recognition = null;
    this.settings = {
      useWhisper: false, // Default to free Web Speech API
      whisperApiKey: '',
      language: 'auto', // Auto-detect or specific language
      maxRecordingTime: 30000, // 30 seconds max
      audioQuality: 'medium' // low, medium, high
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
    try {
      const result = await chrome.storage.sync.get([
        'audioSearch_useWhisper',
        'audioSearch_whisperApiKey', 
        'audioSearch_language',
        'audioSearch_maxRecordingTime',
        'audioSearch_audioQuality'
      ]);

      this.settings = {
        useWhisper: result.audioSearch_useWhisper || false,
        whisperApiKey: result.audioSearch_whisperApiKey || '',
        language: result.audioSearch_language || 'auto',
        maxRecordingTime: result.audioSearch_maxRecordingTime || 30000,
        audioQuality: result.audioSearch_audioQuality || 'medium'
      };

      console.log('🎤 Audio search settings loaded:', this.settings);
    } catch (error) {
      console.error('❌ Failed to load audio search settings:', error);
    }
  }

  // Save settings to storage
  async saveSettings(newSettings) {
    try {
      const settingsToSave = {};
      Object.keys(newSettings).forEach(key => {
        settingsToSave[`audioSearch_${key}`] = newSettings[key];
      });

      await chrome.storage.sync.set(settingsToSave);
      this.settings = { ...this.settings, ...newSettings };
      
      console.log('💾 Audio search settings saved:', newSettings);
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: this.getAudioSampleRate()
        }
      });
      
      console.log('✅ Microphone access granted');
      return stream;
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
      await this.loadSettings();
      
      // Check microphone permission
      const hasPermission = await this.checkMicrophonePermission();
      if (!hasPermission) {
        await this.requestMicrophoneAccess();
      }

      this.isRecording = true;
      onStatusUpdate?.('🎤 Starting voice recognition...');

      if (this.settings.useWhisper && this.settings.whisperApiKey) {
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
      this.mediaRecorder.start(100); // Collect data every 100ms
      onStatusUpdate?.('🎤 Recording... Click stop when finished');

      // Auto-stop after max recording time
      setTimeout(() => {
        if (this.isRecording && this.mediaRecorder.state === 'recording') {
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
    
    if (this.settings.language !== 'auto') {
      formData.append('language', this.getWhisperLanguageCode());
    }

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
    return {
      text: result.text.trim(),
      confidence: 1.0, // Whisper doesn't provide confidence scores
      language: result.language || this.settings.language,
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