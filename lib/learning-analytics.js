// Learning Analytics - Track and analyze user learning patterns
class LearningAnalytics {
  constructor() {
    this.analytics = {
      vocabulary: new Map(),
      sessions: [],
      streaks: {
        current: 0,
        longest: 0,
        lastActivity: null
      },
      preferences: {
        studyTimes: new Map(), // Hour -> frequency
        difficultLanguages: new Map(),
        strongTopics: new Set()
      }
    };
  }

  // Initialize analytics system
  async initialize() {
    try {
      const stored = await chrome.storage.local.get(['learningAnalytics']);
      if (stored.learningAnalytics) {
        this.loadFromStorage(stored.learningAnalytics);
      }
      await this.updateStreaks();
      return true;
    } catch (error) {
      console.error('Failed to initialize learning analytics:', error);
      return false;
    }
  }

  // Load analytics from storage
  loadFromStorage(data) {
    this.analytics = {
      vocabulary: new Map(data.vocabulary || []),
      sessions: data.sessions || [],
      streaks: data.streaks || { current: 0, longest: 0, lastActivity: null },
      preferences: {
        studyTimes: new Map(data.preferences?.studyTimes || []),
        difficultLanguages: new Map(data.preferences?.difficultLanguages || []),
        strongTopics: new Set(data.preferences?.strongTopics || [])
      }
    };
  }

  // Save analytics to storage
  async save() {
    const analyticsData = {
      vocabulary: Array.from(this.analytics.vocabulary.entries()),
      sessions: this.analytics.sessions.slice(-100), // Keep last 100 sessions
      streaks: this.analytics.streaks,
      preferences: {
        studyTimes: Array.from(this.analytics.preferences.studyTimes.entries()),
        difficultLanguages: Array.from(this.analytics.preferences.difficultLanguages.entries()),
        strongTopics: Array.from(this.analytics.preferences.strongTopics)
      }
    };

    try {
      await chrome.storage.local.set({ learningAnalytics: analyticsData });
      return true;
    } catch (error) {
      console.error('Failed to save learning analytics:', error);
      return false;
    }
  }

  // Record vocabulary interaction
  recordVocabularyInteraction(word, language, action, context = {}) {
    const key = `${word.toLowerCase()}_${language}`;
    const now = Date.now();
    
    if (!this.analytics.vocabulary.has(key)) {
      this.analytics.vocabulary.set(key, {
        word,
        language,
        firstSeen: now,
        lastSeen: now,
        interactions: 0,
        actions: new Map(),
        retention: {
          reviews: 0,
          correct: 0,
          lastReview: null,
          difficulty: 0.5 // 0 = easy, 1 = difficult
        },
        context: []
      });
    }

    const vocabData = this.analytics.vocabulary.get(key);
    vocabData.lastSeen = now;
    vocabData.interactions++;
    
    // Record action
    const actionCount = vocabData.actions.get(action) || 0;
    vocabData.actions.set(action, actionCount + 1);
    
    // Record context
    if (context.webpage) {
      vocabData.context.push({
        webpage: context.webpage,
        timestamp: now,
        action
      });
    }

    this.save();
  }

  // Record study session
  recordStudySession(type, duration, wordsStudied, accuracy = null) {
    const session = {
      id: Date.now(),
      type, // 'flashcard', 'lookup', 'analysis'
      timestamp: Date.now(),
      duration, // in milliseconds
      wordsStudied,
      accuracy, // 0-1 if applicable
      hour: new Date().getHours()
    };

    this.analytics.sessions.push(session);
    
    // Update study time preferences
    const hour = session.hour;
    const currentCount = this.analytics.preferences.studyTimes.get(hour) || 0;
    this.analytics.preferences.studyTimes.set(hour, currentCount + 1);

    this.updateStreaks();
    this.save();
  }

  // Update learning streaks
  async updateStreaks() {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const lastActivity = this.analytics.streaks.lastActivity;

    if (!lastActivity) {
      // First activity
      this.analytics.streaks.current = 1;
      this.analytics.streaks.longest = 1;
      this.analytics.streaks.lastActivity = now;
      return;
    }

    const daysSinceLastActivity = Math.floor((now - lastActivity) / oneDayMs);

    if (daysSinceLastActivity === 0) {
      // Same day - no change
      return;
    } else if (daysSinceLastActivity === 1) {
      // Consecutive day
      this.analytics.streaks.current++;
      this.analytics.streaks.longest = Math.max(
        this.analytics.streaks.longest,
        this.analytics.streaks.current
      );
    } else {
      // Streak broken
      this.analytics.streaks.current = 1;
    }

    this.analytics.streaks.lastActivity = now;
  }

  // Get learning insights
  getInsights() {
    const insights = {
      totalVocabulary: this.analytics.vocabulary.size,
      studySessions: this.analytics.sessions.length,
      currentStreak: this.analytics.streaks.current,
      longestStreak: this.analytics.streaks.longest,
      averageSessionLength: this.getAverageSessionLength(),
      mostActiveHours: this.getMostActiveHours(),
      strongLanguages: this.getStrongLanguages(),
      weakLanguages: this.getWeakLanguages(),
      retentionRate: this.getOverallRetentionRate(),
      recommendedStudyTime: this.getRecommendedStudyTime(),
      vocabularyGrowth: this.getVocabularyGrowth()
    };

    return insights;
  }

  // Calculate average session length
  getAverageSessionLength() {
    if (this.analytics.sessions.length === 0) return 0;
    
    const totalDuration = this.analytics.sessions.reduce((sum, session) => sum + session.duration, 0);
    return Math.round(totalDuration / this.analytics.sessions.length / 1000); // Convert to seconds
  }

  // Get most active study hours
  getMostActiveHours() {
    const sortedHours = Array.from(this.analytics.preferences.studyTimes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    return sortedHours.map(([hour, count]) => ({
      hour: `${hour}:00`,
      sessions: count
    }));
  }

  // Identify strong languages (high accuracy, frequent use)
  getStrongLanguages() {
    const languageStats = new Map();
    
    this.analytics.vocabulary.forEach((vocab) => {
      const lang = vocab.language;
      if (!languageStats.has(lang)) {
        languageStats.set(lang, {
          language: lang,
          words: 0,
          totalRetention: 0,
          interactions: 0
        });
      }
      
      const stats = languageStats.get(lang);
      stats.words++;
      stats.totalRetention += vocab.retention.correct / Math.max(vocab.retention.reviews, 1);
      stats.interactions += vocab.interactions;
    });

    return Array.from(languageStats.values())
      .map(stats => ({
        ...stats,
        averageRetention: stats.totalRetention / stats.words,
        score: (stats.averageRetention * 0.6) + (Math.log(stats.interactions) * 0.4)
      }))
      .sort((a, b) => b.score - a.score);
  }

  // Identify weak languages (low accuracy, need focus)
  getWeakLanguages() {
    return this.getStrongLanguages()
      .filter(lang => lang.averageRetention < 0.7 && lang.interactions > 5)
      .reverse(); // Weakest first
  }

  // Calculate overall retention rate
  getOverallRetentionRate() {
    let totalReviews = 0;
    let totalCorrect = 0;

    this.analytics.vocabulary.forEach((vocab) => {
      totalReviews += vocab.retention.reviews;
      totalCorrect += vocab.retention.correct;
    });

    return totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;
  }

  // Recommend optimal study time
  getRecommendedStudyTime() {
    const mostActiveHours = this.getMostActiveHours();
    if (mostActiveHours.length === 0) return 'No data yet';
    
    return `Your most productive time is ${mostActiveHours[0].hour} (${mostActiveHours[0].sessions} sessions)`;
  }

  // Calculate vocabulary growth over time
  getVocabularyGrowth() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    let newWordsLast30Days = 0;
    let newWordsLast7Days = 0;

    this.analytics.vocabulary.forEach((vocab) => {
      if (vocab.firstSeen > thirtyDaysAgo) {
        newWordsLast30Days++;
        if (vocab.firstSeen > sevenDaysAgo) {
          newWordsLast7Days++;
        }
      }
    });

    return {
      last30Days: newWordsLast30Days,
      last7Days: newWordsLast7Days,
      weeklyAverage: Math.round(newWordsLast30Days / 4.3) // ~4.3 weeks in 30 days
    };
  }

  // Get vocabulary that needs review (forgetting curve)
  getVocabularyNeedingReview() {
    const now = Date.now();
    const needsReview = [];

    this.analytics.vocabulary.forEach((vocab, key) => {
      const { retention } = vocab;
      
      if (retention.reviews === 0) {
        // Never reviewed
        needsReview.push({ ...vocab, priority: 'new', urgency: 1 });
        return;
      }

      const timeSinceLastReview = now - retention.lastReview;
      const forgettingCurve = this.calculateForgettingCurve(
        timeSinceLastReview,
        retention.difficulty,
        retention.reviews
      );

      if (forgettingCurve < 0.7) { // Below 70% retention
        needsReview.push({
          ...vocab,
          priority: 'review',
          urgency: 1 - forgettingCurve,
          estimatedRetention: Math.round(forgettingCurve * 100)
        });
      }
    });

    return needsReview.sort((a, b) => b.urgency - a.urgency);
  }

  // Calculate forgetting curve (simplified Ebbinghaus)
  calculateForgettingCurve(timeSinceReview, difficulty, reviewCount) {
    const hoursElapsed = timeSinceReview / (1000 * 60 * 60);
    const difficultyFactor = 1 + difficulty; // 1-2 range
    const reviewFactor = 1 + (reviewCount * 0.1); // More reviews = better retention
    
    // Simplified forgetting curve: R = e^(-t/S)
    const stability = 24 * reviewFactor / difficultyFactor; // Hours
    return Math.exp(-hoursElapsed / stability);
  }

  // Generate personalized study recommendations
  generateRecommendations() {
    const insights = this.getInsights();
    const needsReview = this.getVocabularyNeedingReview();
    const recommendations = [];

    // Study schedule recommendation
    if (insights.mostActiveHours.length > 0) {
      recommendations.push({
        type: 'schedule',
        title: 'Optimize your study schedule',
        description: `You're most productive at ${insights.mostActiveHours[0].hour}. Consider scheduling daily reviews at this time.`,
        priority: 'medium'
      });
    }

    // Vocabulary review recommendation
    if (needsReview.length > 10) {
      recommendations.push({
        type: 'review',
        title: 'Review overdue vocabulary',
        description: `${needsReview.length} words need review to maintain retention. Start with the most urgent ones.`,
        priority: 'high',
        action: 'review',
        data: needsReview.slice(0, 20)
      });
    }

    // Weak language focus
    const weakLanguages = insights.weakLanguages.slice(0, 2);
    weakLanguages.forEach(lang => {
      recommendations.push({
        type: 'focus',
        title: `Improve ${lang.language} retention`,
        description: `Your retention rate for ${lang.language} is ${Math.round(lang.averageRetention * 100)}%. Focus on this language.`,
        priority: 'medium',
        action: 'focus_language',
        data: { language: lang.language }
      });
    });

    // Streak motivation
    if (insights.currentStreak < insights.longestStreak) {
      recommendations.push({
        type: 'motivation',
        title: 'Rebuild your streak',
        description: `Your current streak is ${insights.currentStreak} days. Your record is ${insights.longestStreak} days. Keep learning daily!`,
        priority: 'low'
      });
    }

    return recommendations.sort((a, b) => {
      const priorities = { high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LearningAnalytics;
}