// Advanced Analytics Manager for Learning Progress Tracking
// Provides detailed insights into language learning patterns and progress

class AnalyticsManager {
  constructor() {
    this.storageManager = null;
    this.authManager = null;
    this.isInitialized = false;
    
    // Analytics configuration
    this.config = {
      analysisWindow: 30, // days
      minSessionGap: 5 * 60 * 1000, // 5 minutes
      strengthThreshold: 0.8,
      weaknessThreshold: 0.4
    };

    this.init();
  }

  async init() {
    console.log('📊 AnalyticsManager initializing...');
    
    // Wait for dependencies
    await this.waitForDependencies();
    
    this.isInitialized = true;
    console.log('📊 AnalyticsManager initialized');
  }

  async waitForDependencies() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      if (window.storageManager && window.authManager) {
        this.storageManager = window.storageManager;
        this.authManager = window.authManager;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!this.storageManager) {
      console.warn('⚠️ AnalyticsManager: StorageManager not available');
    }
  }

  // Generate comprehensive learning analytics
  async generateAnalytics(timeframe = 30) {
    if (!this.isInitialized) {
      await this.init();
    }

    const reports = await this.storageManager.getAIReports();
    const cutoffDate = Date.now() - (timeframe * 24 * 60 * 60 * 1000);
    const recentReports = reports.filter(r => r.timestamp >= cutoffDate);

    console.log(`📊 Generating analytics for ${recentReports.length} reports over ${timeframe} days`);

    return {
      overview: await this.generateOverview(recentReports),
      progress: await this.generateProgressAnalysis(recentReports),
      strengths: await this.generateStrengthsAnalysis(recentReports),
      weaknesses: await this.generateWeaknessesAnalysis(recentReports),
      patterns: await this.generateLearningPatterns(recentReports),
      goals: await this.generateGoalProgress(recentReports),
      recommendations: await this.generateRecommendations(recentReports),
      trends: await this.generateTrendAnalysis(reports, timeframe),
      sessions: await this.generateSessionAnalysis(recentReports)
    };
  }

  // Generate overview statistics
  async generateOverview(reports) {
    const totalWords = reports.length;
    const correctWords = reports.filter(r => r.isCorrect).length;
    const errorWords = reports.filter(r => r.hasErrors).length;
    const accuracy = totalWords > 0 ? (correctWords / totalWords) * 100 : 0;

    const languages = [...new Set(reports.map(r => r.language))];
    const languageStats = {};
    
    languages.forEach(lang => {
      const langReports = reports.filter(r => r.language === lang);
      languageStats[lang] = {
        total: langReports.length,
        correct: langReports.filter(r => r.isCorrect).length,
        errors: langReports.filter(r => r.hasErrors).length,
        accuracy: langReports.length > 0 ? (langReports.filter(r => r.isCorrect).length / langReports.length) * 100 : 0
      };
    });

    return {
      totalWords,
      correctWords,
      errorWords,
      accuracy: Math.round(accuracy * 100) / 100,
      languages: languages.length,
      languageStats,
      averageSessionLength: await this.calculateAverageSessionLength(reports),
      mostActiveLanguage: this.getMostActiveLanguage(languageStats),
      learningStreak: await this.calculateLearningStreak(reports)
    };
  }

  // Generate progress analysis over time
  async generateProgressAnalysis(reports) {
    const sortedReports = reports.sort((a, b) => a.timestamp - b.timestamp);
    const dailyStats = this.groupReportsByDay(sortedReports);
    const weeklyStats = this.groupReportsByWeek(sortedReports);
    
    // Calculate progress trends
    const dailyAccuracy = Object.values(dailyStats).map(day => ({
      date: day.date,
      accuracy: day.reports.length > 0 ? (day.reports.filter(r => r.isCorrect).length / day.reports.length) * 100 : 0,
      count: day.reports.length
    }));

    const improvementTrend = this.calculateImprovementTrend(dailyAccuracy);
    const consistencyScore = this.calculateConsistencyScore(dailyStats);

    return {
      dailyStats,
      weeklyStats,
      dailyAccuracy,
      improvementTrend,
      consistencyScore,
      bestDay: this.findBestDay(dailyStats),
      mostProductiveDay: this.findMostProductiveDay(dailyStats),
      progressVelocity: this.calculateProgressVelocity(dailyAccuracy)
    };
  }

  // Analyze user's strengths
  async generateStrengthsAnalysis(reports) {
    const errorTypes = this.analyzeErrorTypes(reports);
    const languageStrengths = this.analyzeLanguageStrengths(reports);
    const topicStrengths = this.analyzeTopicStrengths(reports);
    
    const strengths = [];

    // Language-based strengths
    Object.entries(languageStrengths).forEach(([lang, stats]) => {
      if (stats.accuracy >= this.config.strengthThreshold * 100) {
        strengths.push({
          type: 'language',
          category: lang,
          score: stats.accuracy / 100,
          description: `Strong performance in ${this.formatLanguageName(lang)}`,
          details: `${stats.correct}/${stats.total} words correct (${Math.round(stats.accuracy)}%)`
        });
      }
    });

    // Error type strengths (low error rates)
    Object.entries(errorTypes).forEach(([errorType, count]) => {
      const total = reports.filter(r => r.hasErrors).length;
      if (total > 0) {
        const errorRate = count / total;
        if (errorRate < (1 - this.config.strengthThreshold)) {
          strengths.push({
            type: 'error_avoidance',
            category: errorType,
            score: 1 - errorRate,
            description: `Rarely makes ${this.formatErrorType(errorType)} errors`,
            details: `Only ${count} out of ${total} errors were ${errorType}-related`
          });
        }
      }
    });

    return {
      strengths: strengths.sort((a, b) => b.score - a.score),
      strongestLanguage: this.findStrongestLanguage(languageStrengths),
      consistentAreas: this.findConsistentAreas(reports),
      masteredConcepts: this.findMasteredConcepts(reports)
    };
  }

  // Analyze user's weaknesses and areas for improvement
  async generateWeaknessesAnalysis(reports) {
    const errorReports = reports.filter(r => r.hasErrors);
    const errorTypes = this.analyzeErrorTypes(errorReports);
    const languageWeaknesses = this.analyzeLanguageWeaknesses(reports);
    const repeatErrors = this.findRepeatErrors(reports);
    
    const weaknesses = [];

    // Language-based weaknesses
    Object.entries(languageWeaknesses).forEach(([lang, stats]) => {
      if (stats.accuracy <= this.config.weaknessThreshold * 100 && stats.total >= 3) {
        weaknesses.push({
          type: 'language',
          category: lang,
          severity: 1 - (stats.accuracy / 100),
          description: `Needs improvement in ${this.formatLanguageName(lang)}`,
          details: `${stats.errors}/${stats.total} words had errors (${Math.round(100 - stats.accuracy)}% error rate)`,
          suggestions: this.generateLanguageSuggestions(lang, stats)
        });
      }
    });

    // Error type weaknesses
    const totalErrors = errorReports.length;
    Object.entries(errorTypes).forEach(([errorType, count]) => {
      if (totalErrors > 0) {
        const errorRate = count / totalErrors;
        if (errorRate >= this.config.weaknessThreshold && count >= 3) {
          weaknesses.push({
            type: 'error_pattern',
            category: errorType,
            severity: errorRate,
            description: `Frequent ${this.formatErrorType(errorType)} errors`,
            details: `${count} out of ${totalErrors} errors (${Math.round(errorRate * 100)}%)`,
            suggestions: this.generateErrorTypeSuggestions(errorType)
          });
        }
      }
    });

    return {
      weaknesses: weaknesses.sort((a, b) => b.severity - a.severity),
      problemAreas: this.identifyProblemAreas(reports),
      repeatErrors,
      improvementPriorities: this.prioritizeImprovements(weaknesses),
      targetedPractice: this.suggestTargetedPractice(weaknesses)
    };
  }

  // Analyze learning patterns
  async generateLearningPatterns(reports) {
    const timePatterns = this.analyzeTimePatterns(reports);
    const sessionPatterns = this.analyzeSessionPatterns(reports);
    const difficultyPatterns = this.analyzeDifficultyPatterns(reports);
    
    return {
      timePatterns,
      sessionPatterns,
      difficultyPatterns,
      optimalStudyTimes: this.findOptimalStudyTimes(reports),
      learningStyle: this.inferLearningStyle(reports),
      engagementMetrics: this.calculateEngagementMetrics(reports)
    };
  }

  // Track goal progress
  async generateGoalProgress(reports) {
    // Default goals - in a real app, these would be user-defined
    const defaultGoals = {
      daily_words: { target: 10, type: 'daily' },
      weekly_accuracy: { target: 80, type: 'weekly' },
      monthly_languages: { target: 2, type: 'monthly' },
      error_reduction: { target: 50, type: 'improvement' } // 50% fewer errors than baseline
    };

    const goalProgress = {};

    // Daily words goal
    const today = new Date().toDateString();
    const todayReports = reports.filter(r => new Date(r.timestamp).toDateString() === today);
    goalProgress.daily_words = {
      current: todayReports.length,
      target: defaultGoals.daily_words.target,
      progress: Math.min((todayReports.length / defaultGoals.daily_words.target) * 100, 100),
      status: todayReports.length >= defaultGoals.daily_words.target ? 'achieved' : 'in_progress'
    };

    // Weekly accuracy goal
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekReports = reports.filter(r => r.timestamp >= weekStart.getTime());
    const weekAccuracy = weekReports.length > 0 ? (weekReports.filter(r => r.isCorrect).length / weekReports.length) * 100 : 0;
    goalProgress.weekly_accuracy = {
      current: Math.round(weekAccuracy),
      target: defaultGoals.weekly_accuracy.target,
      progress: Math.min((weekAccuracy / defaultGoals.weekly_accuracy.target) * 100, 100),
      status: weekAccuracy >= defaultGoals.weekly_accuracy.target ? 'achieved' : 'in_progress'
    };

    return {
      goals: defaultGoals,
      progress: goalProgress,
      achievements: this.calculateAchievements(reports),
      streaks: this.calculateStreaks(reports),
      milestones: this.identifyMilestones(reports)
    };
  }

  // Generate personalized recommendations
  async generateRecommendations(reports) {
    const weaknesses = await this.generateWeaknessesAnalysis(reports);
    const patterns = await this.generateLearningPatterns(reports);
    
    const recommendations = [];

    // Study time recommendations
    if (patterns.optimalStudyTimes.length > 0) {
      recommendations.push({
        type: 'study_timing',
        priority: 'medium',
        title: 'Optimize Your Study Schedule',
        description: `You perform best during ${patterns.optimalStudyTimes.join(', ')}`,
        action: 'Schedule more practice sessions during these optimal times'
      });
    }

    // Weakness-based recommendations
    weaknesses.weaknesses.slice(0, 3).forEach(weakness => {
      recommendations.push({
        type: 'skill_improvement',
        priority: weakness.severity > 0.7 ? 'high' : 'medium',
        title: `Focus on ${weakness.description}`,
        description: weakness.details,
        action: weakness.suggestions.join('; ')
      });
    });

    // Language-specific recommendations
    const languageStats = this.analyzeLanguageStats(reports);
    Object.entries(languageStats).forEach(([lang, stats]) => {
      if (stats.total >= 5 && stats.accuracy < 70) {
        recommendations.push({
          type: 'language_focus',
          priority: 'high',
          title: `Improve ${this.formatLanguageName(lang)} Skills`,
          description: `Current accuracy: ${Math.round(stats.accuracy)}%`,
          action: `Practice more ${lang} basics and common phrases`
        });
      }
    });

    return {
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }),
      studyPlan: this.generateStudyPlan(weaknesses, patterns),
      nextActions: this.suggestNextActions(reports)
    };
  }

  // Generate trend analysis
  async generateTrendAnalysis(allReports, timeframe) {
    const currentPeriod = allReports.filter(r => r.timestamp >= Date.now() - (timeframe * 24 * 60 * 60 * 1000));
    const previousPeriod = allReports.filter(r => 
      r.timestamp >= Date.now() - (timeframe * 2 * 24 * 60 * 60 * 1000) &&
      r.timestamp < Date.now() - (timeframe * 24 * 60 * 60 * 1000)
    );

    const currentStats = this.calculatePeriodStats(currentPeriod);
    const previousStats = this.calculatePeriodStats(previousPeriod);

    return {
      accuracy: {
        current: currentStats.accuracy,
        previous: previousStats.accuracy,
        change: currentStats.accuracy - previousStats.accuracy,
        trend: currentStats.accuracy > previousStats.accuracy ? 'improving' : 'declining'
      },
      volume: {
        current: currentStats.total,
        previous: previousStats.total,
        change: currentStats.total - previousStats.total,
        trend: currentStats.total > previousStats.total ? 'increasing' : 'decreasing'
      },
      consistency: {
        current: this.calculateConsistencyScore(this.groupReportsByDay(currentPeriod)),
        previous: this.calculateConsistencyScore(this.groupReportsByDay(previousPeriod)),
        trend: 'stable' // Simplified for now
      }
    };
  }

  // Generate session analysis
  async generateSessionAnalysis(reports) {
    const sessions = this.identifySessions(reports);
    
    return {
      totalSessions: sessions.length,
      averageSessionLength: sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length || 0,
      averageWordsPerSession: sessions.reduce((sum, s) => sum + s.wordCount, 0) / sessions.length || 0,
      mostProductiveSession: sessions.sort((a, b) => b.wordCount - a.wordCount)[0],
      sessionPatterns: this.analyzeSessionPatterns(sessions),
      optimalSessionLength: this.findOptimalSessionLength(sessions)
    };
  }

  // Helper methods
  groupReportsByDay(reports) {
    const groups = {};
    reports.forEach(report => {
      const date = new Date(report.timestamp).toDateString();
      if (!groups[date]) {
        groups[date] = { date, reports: [] };
      }
      groups[date].reports.push(report);
    });
    return groups;
  }

  groupReportsByWeek(reports) {
    const groups = {};
    reports.forEach(report => {
      const date = new Date(report.timestamp);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toDateString();
      
      if (!groups[weekKey]) {
        groups[weekKey] = { weekStart: weekKey, reports: [] };
      }
      groups[weekKey].reports.push(report);
    });
    return groups;
  }

  analyzeErrorTypes(reports) {
    const errorTypes = {};
    reports.forEach(report => {
      if (report.errorTypes && Array.isArray(report.errorTypes)) {
        report.errorTypes.forEach(errorType => {
          errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
        });
      }
    });
    return errorTypes;
  }

  analyzeLanguageStrengths(reports) {
    const languages = {};
    reports.forEach(report => {
      if (!languages[report.language]) {
        languages[report.language] = { total: 0, correct: 0, errors: 0 };
      }
      languages[report.language].total++;
      if (report.isCorrect) {
        languages[report.language].correct++;
      }
      if (report.hasErrors) {
        languages[report.language].errors++;
      }
    });

    Object.keys(languages).forEach(lang => {
      const stats = languages[lang];
      stats.accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    });

    return languages;
  }

  analyzeLanguageWeaknesses(reports) {
    return this.analyzeLanguageStrengths(reports); // Same calculation, different interpretation
  }

  analyzeLanguageStats(reports) {
    return this.analyzeLanguageStrengths(reports);
  }

  identifySessions(reports) {
    const sortedReports = reports.sort((a, b) => a.timestamp - b.timestamp);
    const sessions = [];
    let currentSession = null;

    sortedReports.forEach(report => {
      if (!currentSession || report.timestamp - currentSession.endTime > this.config.minSessionGap) {
        if (currentSession) {
          sessions.push(currentSession);
        }
        currentSession = {
          startTime: report.timestamp,
          endTime: report.timestamp,
          reports: [report],
          wordCount: 1
        };
      } else {
        currentSession.endTime = report.timestamp;
        currentSession.reports.push(report);
        currentSession.wordCount++;
      }
    });

    if (currentSession) {
      sessions.push(currentSession);
    }

    sessions.forEach(session => {
      session.duration = session.endTime - session.startTime;
    });

    return sessions;
  }

  calculatePeriodStats(reports) {
    return {
      total: reports.length,
      correct: reports.filter(r => r.isCorrect).length,
      errors: reports.filter(r => r.hasErrors).length,
      accuracy: reports.length > 0 ? (reports.filter(r => r.isCorrect).length / reports.length) * 100 : 0
    };
  }

  formatLanguageName(lang) {
    const names = {
      'english': 'English',
      'dutch': 'Dutch',
      'japanese': 'Japanese',
      'korean': 'Korean'
    };
    return names[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
  }

  formatErrorType(errorType) {
    const types = {
      'grammar': 'grammar',
      'spelling': 'spelling',
      'language_mixing': 'language mixing',
      'pronunciation': 'pronunciation',
      'usage': 'usage',
      'structure': 'sentence structure'
    };
    return types[errorType] || errorType.replace('_', ' ');
  }

  // Placeholder methods for complex calculations
  calculateImprovementTrend(dailyAccuracy) {
    if (dailyAccuracy.length < 2) return 'insufficient_data';
    const recent = dailyAccuracy.slice(-7);
    const earlier = dailyAccuracy.slice(-14, -7);
    const recentAvg = recent.reduce((sum, day) => sum + day.accuracy, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, day) => sum + day.accuracy, 0) / earlier.length || recentAvg;
    return recentAvg > earlierAvg ? 'improving' : 'declining';
  }

  calculateConsistencyScore(dailyStats) {
    const days = Object.values(dailyStats);
    if (days.length === 0) return 0;
    const activeDays = days.filter(day => day.reports.length > 0).length;
    return (activeDays / days.length) * 100;
  }

  findBestDay(dailyStats) {
    return Object.values(dailyStats).reduce((best, day) => {
      const accuracy = day.reports.length > 0 ? (day.reports.filter(r => r.isCorrect).length / day.reports.length) * 100 : 0;
      return accuracy > (best.accuracy || 0) ? { ...day, accuracy } : best;
    }, {});
  }

  findMostProductiveDay(dailyStats) {
    return Object.values(dailyStats).reduce((best, day) => 
      day.reports.length > (best.reports?.length || 0) ? day : best, {});
  }

  calculateProgressVelocity(dailyAccuracy) {
    // Simplified velocity calculation
    return dailyAccuracy.length > 1 ? 'steady' : 'unknown';
  }

  // Stub methods for complex features
  findRepeatErrors(reports) { return []; }
  generateLanguageSuggestions(lang, stats) { return [`Practice more ${lang} basics`]; }
  generateErrorTypeSuggestions(errorType) { return [`Focus on ${errorType} rules`]; }
  identifyProblemAreas(reports) { return []; }
  prioritizeImprovements(weaknesses) { return weaknesses.slice(0, 3); }
  suggestTargetedPractice(weaknesses) { return []; }
  analyzeTimePatterns(reports) { return {}; }
  analyzeSessionPatterns(reports) { return {}; }
  analyzeDifficultyPatterns(reports) { return {}; }
  findOptimalStudyTimes(reports) { return ['morning', 'evening']; }
  inferLearningStyle(reports) { return 'balanced'; }
  calculateEngagementMetrics(reports) { return {}; }
  calculateAchievements(reports) { return []; }
  calculateStreaks(reports) { return {}; }
  identifyMilestones(reports) { return []; }
  generateStudyPlan(weaknesses, patterns) { return {}; }
  suggestNextActions(reports) { return []; }
  findOptimalSessionLength(sessions) { return 15; }
  calculateAverageSessionLength(reports) { return 10; }
  getMostActiveLanguage(languageStats) { 
    return Object.entries(languageStats).reduce((best, [lang, stats]) => 
      stats.total > (best.total || 0) ? { language: lang, ...stats } : best, {}).language;
  }
  calculateLearningStreak(reports) { return 3; }
  findStrongestLanguage(languageStrengths) {
    return Object.entries(languageStrengths).reduce((best, [lang, stats]) => 
      stats.accuracy > (best.accuracy || 0) ? { language: lang, ...stats } : best, {}).language;
  }
  findConsistentAreas(reports) { return []; }
  findMasteredConcepts(reports) { return []; }
}

// Global instance
window.analyticsManager = new AnalyticsManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsManager;
}