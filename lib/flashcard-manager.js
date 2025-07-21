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

  // Create a new flashcard
  async createFlashcard(data) {
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

  // Create flashcard from saved report
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
      const ipaMatch = analysis.match(/\[(.+?)\]|\/(.*?)\//);
      if (ipaMatch) return ipaMatch[1] || ipaMatch[2];
      
      const pronMatch = analysis.match(/發音[：:]\s*(.+?)(?:\n|$)/i);
      if (pronMatch) return pronMatch[1].trim();
    }
    return analysis.pronunciation || analysis.ipa || '';
  }

  // Get flashcards due for review
  getDueFlashcards(difficulty = 'all') {
    const now = new Date().getTime();
    let dueCards = this.flashcards.filter(card => card.nextReview <= now);
    
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