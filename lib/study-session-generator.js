// Smart Study Session Generator - Creates optimized learning sessions
class StudySessionGenerator {
  constructor(learningAnalytics, flashcardManager) {
    this.analytics = learningAnalytics;
    this.flashcardManager = flashcardManager;
    this.sessionTypes = {
      REVIEW: 'review',
      NEW_WORDS: 'new_words',
      WEAK_POINTS: 'weak_points',
      MIXED: 'mixed',
      SPEED_DRILL: 'speed_drill',
      CONTEXTUAL: 'contextual'
    };
  }

  // Generate optimal study session based on user data
  async generateOptimalSession(preferences = {}) {
    const {
      duration = 15, // minutes
      sessionType = 'auto',
      maxWords = 20,
      focusLanguage = null,
      difficulty = 'adaptive'
    } = preferences;

    // Get analytics insights (these are synchronous methods)
    const insights = this.analytics.getInsights();
    const needsReview = this.analytics.getVocabularyNeedingReview();
    
    // Determine session type if auto
    let selectedType = sessionType;
    if (sessionType === 'auto') {
      selectedType = this.determineOptimalSessionType(insights, needsReview);
    }

    // Generate session content
    const session = await this.createSession({
      type: selectedType,
      duration,
      maxWords,
      focusLanguage,
      difficulty,
      insights,
      needsReview
    });

    return session;
  }

  // Determine the best session type based on user data
  determineOptimalSessionType(insights, needsReview) {
    // If many words need review, prioritize review
    if (needsReview.length > 15) {
      return this.sessionTypes.REVIEW;
    }

    // If user has weak languages, focus on them
    if (insights.weakLanguages && insights.weakLanguages.length > 0) {
      return this.sessionTypes.WEAK_POINTS;
    }

    // If user is consistent but needs variety
    if (insights.currentStreak > 7) {
      return this.sessionTypes.MIXED;
    }

    // Default to mixed session
    return this.sessionTypes.MIXED;
  }

  // Create session based on parameters
  async createSession(params) {
    const { type, duration, maxWords, focusLanguage, difficulty, insights, needsReview } = params;

    let words = [];
    let sessionConfig = {};

    switch (type) {
      case this.sessionTypes.REVIEW:
        words = await this.createReviewSession(needsReview, maxWords, focusLanguage);
        sessionConfig = {
          title: '📖 Review Session',
          description: `Review ${words.length} words to maintain retention`,
          studyMode: 'recall',
          timePerWord: Math.floor((duration * 60) / words.length),
          showProgress: true
        };
        break;

      case this.sessionTypes.NEW_WORDS:
        words = await this.createNewWordsSession(maxWords, focusLanguage);
        sessionConfig = {
          title: '✨ New Vocabulary',
          description: `Learn ${words.length} new words`,
          studyMode: 'learning',
          timePerWord: Math.floor((duration * 60) / words.length),
          showHints: true
        };
        break;

      case this.sessionTypes.WEAK_POINTS:
        words = await this.createWeakPointsSession(insights, maxWords, focusLanguage);
        sessionConfig = {
          title: '💪 Strengthen Weaknesses',
          description: `Focus on challenging vocabulary`,
          studyMode: 'intensive',
          timePerWord: Math.floor((duration * 60 * 1.5) / words.length), // More time for difficult words
          showDetailedFeedback: true
        };
        break;

      case this.sessionTypes.MIXED:
        words = await this.createMixedSession(needsReview, maxWords, focusLanguage);
        sessionConfig = {
          title: '🎯 Balanced Study',
          description: `Mix of review and new content`,
          studyMode: 'balanced',
          timePerWord: Math.floor((duration * 60) / words.length),
          showProgress: true
        };
        break;

      case this.sessionTypes.SPEED_DRILL:
        words = await this.createSpeedDrillSession(maxWords * 2, focusLanguage); // More words, less time each
        sessionConfig = {
          title: '⚡ Speed Drill',
          description: `Quick recall practice`,
          studyMode: 'speed',
          timePerWord: Math.floor((duration * 30) / words.length), // Half time per word
          showTimer: true
        };
        break;

      case this.sessionTypes.CONTEXTUAL:
        words = await this.createContextualSession(maxWords, focusLanguage);
        sessionConfig = {
          title: '📝 Context Practice',
          description: `Words in real contexts`,
          studyMode: 'contextual',
          timePerWord: Math.floor((duration * 90) / words.length), // More time for context
          showContext: true
        };
        break;

      default:
        words = await this.createMixedSession(needsReview, maxWords, focusLanguage);
    }

    return {
      id: `session_${Date.now()}`,
      type,
      config: sessionConfig,
      words,
      totalWords: words.length,
      estimatedDuration: duration,
      createdAt: Date.now(),
      algorithm: this.explainAlgorithm(type, words.length)
    };
  }

  // Create review-focused session
  async createReviewSession(needsReview, maxWords, focusLanguage) {
    let words = needsReview.slice(0, maxWords);
    
    if (focusLanguage) {
      words = words.filter(word => word.language === focusLanguage);
    }

    // Sort by urgency (most urgent first)
    words.sort((a, b) => b.urgency - a.urgency);

    return this.formatWordsForSession(words, 'review');
  }

  // Create new words session
  async createNewWordsSession(maxWords, focusLanguage) {
    // Get unlearned flashcards
    if (!this.flashcardManager) return [];

    const allCards = this.flashcardManager.flashcards || [];
    let newCards = allCards.filter(card => card.reviews === 0);

    if (focusLanguage) {
      newCards = newCards.filter(card => card.language === focusLanguage);
    }

    // Randomly select to avoid bias
    const shuffled = this.shuffleArray(newCards);
    const selectedCards = shuffled.slice(0, maxWords);

    return this.formatWordsForSession(selectedCards, 'new');
  }

  // Create weak points focused session
  async createWeakPointsSession(insights, maxWords, focusLanguage) {
    const weakLanguages = insights.weakLanguages || [];
    const targetLanguage = focusLanguage || (weakLanguages[0] && weakLanguages[0].language);
    
    if (!targetLanguage) {
      // Fallback to review session
      const needsReview = this.analytics.getVocabularyNeedingReview();
      return this.createReviewSession(needsReview, maxWords, focusLanguage);
    }

    // Get words from weak language with low retention
    const weakWords = [];
    this.analytics.analytics.vocabulary.forEach((vocab, key) => {
      if (vocab.language === targetLanguage && vocab.retention.difficulty > 0.6) {
        weakWords.push(vocab);
      }
    });

    // Sort by difficulty and recent performance
    weakWords.sort((a, b) => {
      const aScore = a.retention.difficulty * 0.7 + (1 - (a.retention.correct / Math.max(a.retention.reviews, 1))) * 0.3;
      const bScore = b.retention.difficulty * 0.7 + (1 - (b.retention.correct / Math.max(b.retention.reviews, 1))) * 0.3;
      return bScore - aScore;
    });

    const selectedWords = weakWords.slice(0, maxWords);
    return this.formatWordsForSession(selectedWords, 'weak_points');
  }

  // Create mixed session (review + new)
  async createMixedSession(needsReview, maxWords, focusLanguage) {
    const reviewCount = Math.floor(maxWords * 0.7); // 70% review
    const newCount = maxWords - reviewCount; // 30% new

    const reviewWords = await this.createReviewSession(needsReview, reviewCount, focusLanguage);
    const newWords = await this.createNewWordsSession(newCount, focusLanguage);

    // Interleave review and new words for better learning
    const mixedWords = this.interleaveArrays(reviewWords, newWords);
    
    return mixedWords.map(word => ({
      ...word,
      sessionType: 'mixed'
    }));
  }

  // Create speed drill session
  async createSpeedDrillSession(maxWords, focusLanguage) {
    // Use familiar words for speed practice
    const familiarWords = [];
    this.analytics.analytics.vocabulary.forEach((vocab, key) => {
      if (vocab.retention.reviews > 2 && vocab.retention.correct / vocab.retention.reviews > 0.8) {
        if (!focusLanguage || vocab.language === focusLanguage) {
          familiarWords.push(vocab);
        }
      }
    });

    const shuffled = this.shuffleArray(familiarWords);
    const selected = shuffled.slice(0, maxWords);

    return this.formatWordsForSession(selected, 'speed_drill');
  }

  // Create contextual session
  async createContextualSession(maxWords, focusLanguage) {
    // Get words with context information
    const contextualWords = [];
    this.analytics.analytics.vocabulary.forEach((vocab, key) => {
      if (vocab.context && vocab.context.length > 0) {
        if (!focusLanguage || vocab.language === focusLanguage) {
          contextualWords.push(vocab);
        }
      }
    });

    const shuffled = this.shuffleArray(contextualWords);
    const selected = shuffled.slice(0, maxWords);

    return this.formatWordsForSession(selected, 'contextual');
  }

  // Format words for study session
  formatWordsForSession(words, sessionType) {
    return words.map((word, index) => ({
      id: word.id || `${word.word}_${word.language}`,
      word: word.word || word.front || word.searchText,
      translation: word.back || word.translation || 'Translation needed',
      language: word.language,
      pronunciation: word.pronunciation || '',
      definition: word.definition || word.analysis || '',
      context: word.context || [],
      difficulty: word.retention?.difficulty || word.difficulty || 0.5,
      reviewHistory: {
        reviews: word.retention?.reviews || word.reviews || 0,
        correct: word.retention?.correct || 0,
        lastReview: word.retention?.lastReview || word.lastReview
      },
      sessionInfo: {
        type: sessionType,
        order: index + 1,
        urgency: word.urgency || 0.5,
        estimatedRetention: word.estimatedRetention || null
      }
    }));
  }

  // Utility: Shuffle array
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Utility: Interleave two arrays
  interleaveArrays(arr1, arr2) {
    const result = [];
    const maxLength = Math.max(arr1.length, arr2.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (i < arr1.length) result.push(arr1[i]);
      if (i < arr2.length) result.push(arr2[i]);
    }
    
    return result;
  }

  // Explain the algorithm used for session generation
  explainAlgorithm(sessionType, wordCount) {
    const explanations = {
      [this.sessionTypes.REVIEW]: `Selected ${wordCount} words using spaced repetition algorithm. Words are prioritized by forgetting curve and urgency.`,
      [this.sessionTypes.NEW_WORDS]: `Selected ${wordCount} unlearned words randomly to avoid selection bias and maintain variety.`,
      [this.sessionTypes.WEAK_POINTS]: `Focused on vocabulary with high error rates and difficulty scores. Uses performance analytics to identify problem areas.`,
      [this.sessionTypes.MIXED]: `Balanced approach with 70% review and 30% new content. Interleaved presentation enhances learning retention.`,
      [this.sessionTypes.SPEED_DRILL]: `Selected familiar words (>80% accuracy) for rapid recall practice. Builds automatic recognition.`,
      [this.sessionTypes.CONTEXTUAL]: `Prioritized words with real-world context data to improve practical usage understanding.`
    };

    return explanations[sessionType] || 'Custom algorithm based on your learning patterns.';
  }

  // Generate session recommendations for the user
  generateSessionRecommendations() {
    const now = new Date();
    const hour = now.getHours();
    const recommendations = [];

    // Morning recommendation (6-11 AM)
    if (hour >= 6 && hour < 11) {
      recommendations.push({
        type: this.sessionTypes.NEW_WORDS,
        title: '🌅 Morning Learning',
        description: 'Start your day with new vocabulary - your brain is fresh!',
        duration: 15,
        maxWords: 15
      });
    }

    // Lunch break (11 AM - 2 PM)
    if (hour >= 11 && hour < 14) {
      recommendations.push({
        type: this.sessionTypes.SPEED_DRILL,
        title: '⚡ Quick Review',
        description: 'Perfect for a short lunch break session',
        duration: 10,
        maxWords: 25
      });
    }

    // Afternoon (2-6 PM)
    if (hour >= 14 && hour < 18) {
      recommendations.push({
        type: this.sessionTypes.WEAK_POINTS,
        title: '💪 Challenge Session',
        description: 'Tackle difficult vocabulary when energy is high',
        duration: 20,
        maxWords: 12
      });
    }

    // Evening (6-10 PM)
    if (hour >= 18 && hour < 22) {
      recommendations.push({
        type: this.sessionTypes.REVIEW,
        title: '📖 Evening Review',
        description: 'Reinforce what you learned today',
        duration: 15,
        maxWords: 20
      });
    }

    // Always available
    recommendations.push({
      type: 'auto',
      title: '🎯 Smart Session',
      description: 'Let AI choose the best session for you right now',
      duration: 15,
      maxWords: 18
    });

    return recommendations;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StudySessionGenerator;
}