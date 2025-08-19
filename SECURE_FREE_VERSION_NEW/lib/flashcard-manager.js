// Flashcard Manager - Handles flashcard creation, storage, and spaced repetition
class FlashcardManager {
  constructor() {
    this.flashcards = [];
    this.studyQueue = [];
    this.currentStudySession = null;
    this.stats = {
      totalCards: 0,
      todayReviews: 0,
      studyStreak: 0
    };
  }

  // Initialize flashcard system
  async initialize() {
    try {
      await this.loadFlashcards();
      await this.loadStats();
      return true;
    } catch (error) {
      console.error('Failed to initialize flashcard manager:', error);
      return false;
    }
  }

  // Load flashcards from storage
  async loadFlashcards() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['flashcards'], (data) => {
        this.flashcards = data.flashcards || [];
        this.updateStats();
        resolve();
      });
    });
  }

  // Save flashcards to storage
  async saveFlashcards() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        flashcards: this.flashcards,
        flashcardStats: this.stats
      }, resolve);
    });
  }

  // Load statistics
  async loadStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['flashcardStats'], (data) => {
        this.stats = {
          totalCards: this.flashcards.length,
          todayReviews: 0,
          studyStreak: 0,
          ...data.flashcardStats
        };
        resolve();
      });
    });
  }

  // Check for duplicate flashcards (enhanced duplicate detection)
  checkDuplicate(front, language, back = null) {
    const normalizedFront = front.toLowerCase().trim();
    const normalizedLanguage = (language || 'english').toLowerCase();
    const normalizedBack = back ? back.toLowerCase().trim() : null;
    
    return this.flashcards.find(card => {
      const cardFront = card.front.toLowerCase().trim();
      const cardLanguage = (card.language || 'english').toLowerCase();
      const cardBack = card.back ? card.back.toLowerCase().trim() : null;
      
      // Exact match on front text and language
      if (cardFront === normalizedFront && cardLanguage === normalizedLanguage) {
        return true;
      }
      
      // If we have back text, also check for reverse duplicates
      // (e.g., someone tries to create A->B when B->A already exists)
      if (normalizedBack && cardBack) {
        if (cardFront === normalizedBack && cardBack === normalizedFront && cardLanguage === normalizedLanguage) {
          return true;
        }
      }
      
      return false;
    });
  }

  // Create a new flashcard with duplicate checking
  async createFlashcard(data, allowDuplicates = false) {
    // Check for duplicates unless explicitly allowed
    if (!allowDuplicates) {
      const existing = this.checkDuplicate(data.front, data.language || 'english', data.back);
      if (existing) {
        console.log('Duplicate flashcard detected:', existing);
        throw new Error(`Flashcard already exists: "${data.front}" (${data.language || 'english'})`);
      }
    }

    const flashcard = {
      id: this.generateId(),
      front: data.front,
      back: data.back,
      definition: data.definition || '',
      pronunciation: data.pronunciation || '',
      language: data.language || 'english',
      tags: data.tags || [],
      difficulty: 0, // 0=new, 1=learning, 2=review, 3=mature
      interval: 1, // Days until next review
      easeFactor: 2.5, // Spaced repetition ease factor
      reviews: 0,
      lastReview: null,
      nextReview: new Date().getTime() + (24 * 60 * 60 * 1000), // Tomorrow
      created: new Date().getTime(),
      audioUrl: data.audioUrl || null
    };

    this.flashcards.push(flashcard);
    await this.saveFlashcards();
    this.updateStats();
    
    return flashcard;
  }

  // Create flashcard from saved report (legacy method)
  async createFromReport(report) {
    const flashcardData = {
      front: report.searchText,
      back: this.extractTranslation(report.analysis),
      definition: this.extractDefinition(report.analysis),
      pronunciation: this.extractPronunciation(report.analysis),
      language: report.language,
      tags: report.tags || ['imported']
    };

    return await this.createFlashcard(flashcardData);
  }

  // Create enhanced flashcard with concise AI-generated content
  async createEnhancedFromReport(report) {
    try {
      console.log('🃏 Creating enhanced flashcard for:', report.searchText);

      // Check if AI service is available
      if (!window.aiService || !window.aiService.isAvailable()) {
        console.log('⚠️ AI service not available, falling back to legacy method');
        return await this.createFromReport(report);
      }

      // Generate concise flashcard content using AI
      const flashcardContent = await window.aiService.generateFlashcardContent(
        report.searchText,
        report.language
      );

      console.log('✅ Generated flashcard content:', flashcardContent);

      // Create flashcard with enhanced content - with null safety
      const flashcardData = {
        front: report.searchText,
        back: (flashcardContent && flashcardContent.translation) || this.extractTranslation(report.analysis),
        definition: (flashcardContent && flashcardContent.context) || this.extractDefinition(report.analysis),
        pronunciation: (flashcardContent && flashcardContent.pronunciation) || this.extractPronunciation(report.analysis),
        language: report.language,
        tags: (report.tags || []).concat(['ai-enhanced']),
        // Store additional AI-generated content
        memoryTip: (flashcardContent && flashcardContent.memoryTip) || '',
        aiGenerated: true,
        generatedAt: (flashcardContent && flashcardContent.timestamp) || Date.now()
      };

      // Include audio if available from the report
      if (report.audioData || report.audioUrl) {
        flashcardData.audioUrl = report.audioUrl;
        flashcardData.audioData = report.audioData;
        flashcardData.tags.push('with-audio');
      }

      const flashcard = await this.createFlashcard(flashcardData);
      console.log('✅ Enhanced flashcard created:', flashcard.id);
      
      return flashcard;

    } catch (error) {
      console.error('❌ Failed to create enhanced flashcard:', error);
      // Fallback to legacy method if AI generation fails
      console.log('🔄 Falling back to legacy flashcard creation');
      return await this.createFromReport(report);
    }
  }

  // Create flashcard from quick translation
  async createFromQuickTranslation(word, translation, language) {
    const flashcardData = {
      front: word,
      back: translation,
      definition: `${language} word`,
      pronunciation: '',
      language: language,
      tags: ['quick-add']
    };

    return await this.createFlashcard(flashcardData);
  }

  // Extract translation from AI analysis
  extractTranslation(analysis) {
    if (typeof analysis === 'string') {
      // Try to find Chinese translation in the text
      const chineseMatch = analysis.match(/中文[：:]\s*(.+?)(?:\n|$)/i);
      if (chineseMatch) return chineseMatch[1].trim();
      
      const translationMatch = analysis.match(/翻譯[：:]\s*(.+?)(?:\n|$)/i);
      if (translationMatch) return translationMatch[1].trim();
      
      return analysis.substring(0, 50) + '...';
    }
    return analysis.translation || analysis.meaning || 'Translation needed';
  }

  // Extract definition from AI analysis
  extractDefinition(analysis) {
    if (typeof analysis === 'string') {
      const definitionMatch = analysis.match(/定義[：:]\s*(.+?)(?:\n|$)/i);
      if (definitionMatch) return definitionMatch[1].trim();
      
      const meaningMatch = analysis.match(/含義[：:]\s*(.+?)(?:\n|$)/i);
      if (meaningMatch) return meaningMatch[1].trim();
    }
    return analysis.definition || analysis.meaning || '';
  }

  // Extract pronunciation from AI analysis
  extractPronunciation(analysis) {
    if (typeof analysis === 'string') {
      // IPA notation in brackets or slashes
      const ipaMatch = analysis.match(/\[(.+?)\]|\/(.*?)\//);
      if (ipaMatch) return ipaMatch[1] || ipaMatch[2];
      
      // Japanese readings in hiragana/katakana
      const kanaMatch = analysis.match(/[ひらがな|カタカナ|読み方][：:]\s*([ひらがなカタカナー\s]+)/);
      if (kanaMatch) return kanaMatch[1].trim();
      
      // Korean pronunciation patterns
      const hangeulMatch = analysis.match(/[한글|발음][：:]\s*([가-힣\s]+)/);
      if (hangeulMatch) return hangeulMatch[1].trim();
      
      // Chinese pinyin
      const pinyinMatch = analysis.match(/[拼音|发音][：:]\s*([a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]+)/i);
      if (pinyinMatch) return pinyinMatch[1].trim();
      
      // General pronunciation patterns
      const pronMatch = analysis.match(/[發音|pronunciation|발음][：:]\s*(.+?)(?:\n|$)/i);
      if (pronMatch) return pronMatch[1].trim();
    }
    return analysis.pronunciation || analysis.ipa || '';
  }

  // Get flashcards due for review (including new cards for study)
  getDueFlashcards(difficulty = 'all') {
    const now = new Date().getTime();
    // Include cards that are due OR new cards (reviews === 0)
    let dueCards = this.flashcards.filter(card => 
      card.nextReview <= now || card.reviews === 0
    );
    
    if (difficulty !== 'all') {
      const difficultyMap = {
        'new': 0,
        'learning': 1,
        'review': 2,
        'difficult': [0, 1] // New and learning cards
      };
      
      if (difficulty === 'difficult') {
        dueCards = dueCards.filter(card => difficultyMap[difficulty].includes(card.difficulty));
      } else {
        dueCards = dueCards.filter(card => card.difficulty === difficultyMap[difficulty]);
      }
    }
    
    // Sort by priority: new cards first, then by next review time
    return dueCards.sort((a, b) => {
      if (a.difficulty !== b.difficulty) {
        return a.difficulty - b.difficulty;
      }
      return a.nextReview - b.nextReview;
    });
  }

  // Start a study session
  startStudySession(options = {}) {
    const {
      mode = 'word-to-translation',
      difficulty = 'all',
      maxCards = 20
    } = options;

    const dueCards = this.getDueFlashcards(difficulty);
    const studyCards = dueCards.slice(0, maxCards);

    this.currentStudySession = {
      cards: studyCards,
      currentIndex: 0,
      mode: mode,
      startTime: new Date().getTime(),
      answers: []
    };

    return this.currentStudySession;
  }

  // Get current card in study session
  getCurrentCard() {
    if (!this.currentStudySession || 
        this.currentStudySession.currentIndex >= this.currentStudySession.cards.length) {
      return null;
    }
    
    return this.currentStudySession.cards[this.currentStudySession.currentIndex];
  }

  // Process answer for current card (Spaced Repetition Algorithm)
  async processAnswer(answerQuality) {
    if (!this.currentStudySession) return false;

    const card = this.getCurrentCard();
    if (!card) return false;

    // Record answer
    this.currentStudySession.answers.push({
      cardId: card.id,
      quality: answerQuality,
      time: new Date().getTime()
    });

    // Update card using SM2 algorithm
    this.updateCardSM2(card, answerQuality);
    
    // Move to next card
    this.currentStudySession.currentIndex++;
    
    // Update stats
    this.stats.todayReviews++;
    
    // Save progress
    await this.saveFlashcards();
    
    return true;
  }

  // SM2 Spaced Repetition Algorithm
  updateCardSM2(card, quality) {
    card.reviews++;
    card.lastReview = new Date().getTime();

    if (quality >= 3) {
      // Correct answer
      if (card.reviews === 1) {
        card.interval = 1;
      } else if (card.reviews === 2) {
        card.interval = 6;
      } else {
        card.interval = Math.round(card.interval * card.easeFactor);
      }
      
      card.easeFactor = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    } else {
      // Incorrect answer
      card.reviews = 0;
      card.interval = 1;
    }

    // Ensure minimum ease factor
    if (card.easeFactor < 1.3) {
      card.easeFactor = 1.3;
    }

    // Update difficulty level
    if (card.reviews === 0) {
      card.difficulty = 0; // New
    } else if (card.interval < 21) {
      card.difficulty = 1; // Learning
    } else {
      card.difficulty = 2; // Review
    }

    // Set next review time
    card.nextReview = card.lastReview + (card.interval * 24 * 60 * 60 * 1000);
  }

  // Get study session progress
  getStudyProgress() {
    if (!this.currentStudySession) return null;

    const { cards, currentIndex } = this.currentStudySession;
    return {
      current: Math.min(currentIndex + 1, cards.length),
      total: cards.length,
      percentage: Math.round((currentIndex / cards.length) * 100)
    };
  }

  // End study session
  endStudySession() {
    if (!this.currentStudySession) return null;

    const session = this.currentStudySession;
    const results = {
      cardsStudied: session.answers.length,
      duration: new Date().getTime() - session.startTime,
      accuracy: this.calculateAccuracy(session.answers)
    };

    this.currentStudySession = null;
    return results;
  }

  // Calculate study accuracy
  calculateAccuracy(answers) {
    if (answers.length === 0) return 0;
    const correct = answers.filter(a => a.quality >= 3).length;
    return Math.round((correct / answers.length) * 100);
  }

  // Update statistics
  updateStats() {
    this.stats.totalCards = this.flashcards.length;
    
    const today = new Date().toDateString();
    const todayReviews = this.flashcards.filter(card => 
      card.lastReview && new Date(card.lastReview).toDateString() === today
    ).length;
    
    this.stats.todayReviews = todayReviews;
  }

  // Get flashcard statistics
  getStats() {
    this.updateStats();
    
    const dueCards = this.getDueFlashcards();
    const newCards = this.flashcards.filter(card => card.reviews === 0);
    const learningCards = this.flashcards.filter(card => card.difficulty === 1);
    const reviewCards = this.flashcards.filter(card => card.difficulty === 2);
    
    return {
      ...this.stats,
      dueCards: dueCards.length,
      newCards: newCards.length,
      learningCards: learningCards.length,
      reviewCards: reviewCards.length,
      studyProgress: this.flashcards.length > 0 ? 
        Math.round((reviewCards.length / this.flashcards.length) * 100) : 0
    };
  }

  // Delete flashcard
  async deleteFlashcard(cardId) {
    this.flashcards = this.flashcards.filter(card => card.id !== cardId);
    await this.saveFlashcards();
    this.updateStats();
    return true;
  }

  // Update flashcard
  async updateFlashcard(cardId, updates) {
    const cardIndex = this.flashcards.findIndex(card => card.id === cardId);
    if (cardIndex === -1) return false;

    this.flashcards[cardIndex] = { ...this.flashcards[cardIndex], ...updates };
    await this.saveFlashcards();
    return true;
  }

  // Generate unique ID
  generateId() {
    return 'fc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Generate pronunciation audio using Text-to-Speech
  async generatePronunciationAudio(text, language) {
    try {
      // Use Web Speech API if available
      if ('speechSynthesis' in window) {
        return new Promise((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Set language based on flashcard language
          const langMap = {
            'english': 'en-US',
            'japanese': 'ja-JP', 
            'korean': 'ko-KR',
            'dutch': 'nl-NL'
          };
          
          utterance.lang = langMap[language] || 'en-US';
          utterance.rate = 0.8; // Slower for learning
          utterance.pitch = 1.0;
          
          utterance.onend = () => resolve(true);
          utterance.onerror = () => resolve(false);
          
          speechSynthesis.speak(utterance);
        });
      }
      
      return false;
    } catch (error) {
      console.error('Failed to generate pronunciation audio:', error);
      return false;
    }
  }

  // Play pronunciation for a flashcard (with cached audio support)
  async playPronunciation(cardId) {
    const card = this.flashcards.find(c => c.id === cardId);
    if (!card) return false;

    try {
      // First, try to use stored audioUrl if available
      if (card.audioUrl) {
        console.log('🎯 Playing stored audio for flashcard:', card.front);
        const audio = new Audio(card.audioUrl);
        
        return new Promise((resolve) => {
          audio.onloadeddata = () => {
            audio.play()
              .then(() => {
                console.log('✅ Stored audio playing successfully');
                resolve(true);
              })
              .catch(error => {
                console.error('Failed to play stored audio:', error);
                resolve(false);
              });
          };
          
          audio.onerror = (error) => {
            console.error('Stored audio error:', error);
            resolve(false);
          };
        });
      }

      // If no stored audio, try OpenAI TTS
      if (typeof window.generateOpenAIAudio === 'function') {
        const success = await window.generateOpenAIAudio(card.front, card.language);
        if (success) {
          console.log('✅ Used OpenAI TTS for flashcard:', card.front);
          return true;
        }
      }

      // Fallback to Web Speech API
      const success = await this.generatePronunciationAudio(card.front, card.language);
      
      if (!success) {
        console.warn('Could not play pronunciation for:', card.front);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to play pronunciation:', error);
      return false;
    }
  }

  // Search flashcards
  searchFlashcards(query) {
    if (!query) return this.flashcards;
    
    const lowercaseQuery = query.toLowerCase();
    return this.flashcards.filter(card =>
      card.front.toLowerCase().includes(lowercaseQuery) ||
      card.back.toLowerCase().includes(lowercaseQuery) ||
      card.definition.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Filter flashcards by tags
  filterByTags(tags) {
    if (!tags || tags.length === 0) return this.flashcards;
    
    return this.flashcards.filter(card =>
      card.tags.some(tag => tags.includes(tag))
    );
  }

  // Get all unique tags
  getAllTags() {
    const tagSet = new Set();
    this.flashcards.forEach(card => {
      card.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }

  // Export flashcards
  exportFlashcards(format = 'json') {
    switch (format) {
      case 'csv':
        return this.exportToCSV();
      case 'anki':
        return this.exportToAnki();
      default:
        return this.exportToJSON();
    }
  }

  exportToJSON() {
    return JSON.stringify({
      flashcards: this.flashcards,
      stats: this.stats,
      exportDate: new Date().toISOString()
    }, null, 2);
  }

  exportToCSV() {
    const headers = ['Front', 'Back', 'Definition', 'Pronunciation', 'Language', 'Tags', 'Difficulty', 'Reviews'];
    const rows = this.flashcards.map(card => [
      card.front,
      card.back,
      card.definition,
      card.pronunciation,
      card.language,
      card.tags.join(';'),
      card.difficulty,
      card.reviews
    ]);
    
    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
  }

  exportToAnki() {
    // Anki deck format (simplified)
    return this.flashcards.map(card =>
      [card.front, card.back, card.definition, card.pronunciation].join('\t')
    ).join('\n');
  }

  // Import flashcards
  async importFlashcards(data, format = 'json') {
    try {
      let importedCards = [];
      
      switch (format) {
        case 'json':
          const parsed = JSON.parse(data);
          importedCards = parsed.flashcards || [];
          break;
        case 'csv':
          importedCards = this.parseCSV(data);
          break;
        default:
          throw new Error('Unsupported format');
      }

      // Add imported cards
      for (const cardData of importedCards) {
        await this.createFlashcard(cardData);
      }

      return importedCards.length;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  parseCSV(csvData) {
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.replace(/"/g, ''));
      return {
        front: values[0] || '',
        back: values[1] || '',
        definition: values[2] || '',
        pronunciation: values[3] || '',
        language: values[4] || 'english',
        tags: values[5] ? values[5].split(';') : []
      };
    });
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlashcardManager;
}