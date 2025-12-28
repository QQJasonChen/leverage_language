/**
 * Smart Learning Assistant
 * AI-powered learning recommendations and adaptive features
 */

class SmartLearningAssistant {
    constructor() {
        this.learningProfile = {
            level: 'intermediate',
            strengths: [],
            weaknesses: [],
            preferences: {},
            goals: []
        };
        this.recommendations = [];
        this.adaptiveFeatures = new Map();
        this.initialized = false;
        
        this.init();
    }

    async init() {
        if (this.initialized) return;
        
        await this.loadLearningProfile();
        this.setupLearningTracking();
        this.createAssistantInterface();
        this.generatePersonalizedRecommendations();
        
        this.initialized = true;
        console.log('🤖 Smart Learning Assistant activated');
    }

    async loadLearningProfile() {
        try {
            const data = await chrome.storage.local.get(['learningProfile']);
            this.learningProfile = data.learningProfile || this.getDefaultProfile();
        } catch (error) {
            console.error('Failed to load learning profile:', error);
            this.learningProfile = this.getDefaultProfile();
        }
    }

    getDefaultProfile() {
        return {
            level: 'intermediate',
            strengths: [],
            weaknesses: [],
            preferences: {
                learningStyle: 'visual',
                difficulty: 'medium',
                pace: 'moderate',
                focusAreas: ['grammar', 'vocabulary']
            },
            goals: [
                { type: 'daily', target: 10, current: 0, description: 'Analyze 10 texts daily' },
                { type: 'weekly', target: 50, current: 0, description: 'Complete 50 analyses per week' },
                { type: 'accuracy', target: 85, current: 0, description: 'Maintain 85% accuracy' }
            ],
            languages: ['english'],
            sessionHistory: []
        };
    }

    setupLearningTracking() {
        // Track learning patterns
        this.observeLearningBehavior();
        
        // Adaptive difficulty adjustment
        this.setupAdaptiveDifficulty();
        
        // Progress monitoring
        this.monitorProgress();
    }

    observeLearningBehavior() {
        // Track analysis patterns
        const originalAnalysisFunction = window.generateAiAnalysisBtn?.onclick;
        if (originalAnalysisFunction) {
            const aiButton = document.getElementById('generateAiAnalysisBtn');
            if (aiButton) {
                aiButton.addEventListener('click', () => {
                    this.recordLearningActivity('ai-analysis');
                });
            }
        }

        // Track time spent on different sections
        this.trackSectionEngagement();
        
        // Track error patterns
        this.analyzeErrorPatterns();
    }

    recordLearningActivity(activity, context = {}) {
        const activityRecord = {
            type: activity,
            timestamp: Date.now(),
            context,
            sessionId: this.getCurrentSessionId()
        };
        
        this.learningProfile.sessionHistory.push(activityRecord);
        
        // Analyze patterns every 10 activities
        if (this.learningProfile.sessionHistory.length % 10 === 0) {
            this.analyzeLearningPatterns();
        }
    }

    trackSectionEngagement() {
        // Track time spent in different tabs
        const tabs = document.querySelectorAll('.view-button');
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                this.recordSectionEntry(index);
            });
        });
    }

    recordSectionEntry(sectionIndex) {
        const sections = ['analysis', 'video', 'websites', 'history', 'saved', 'flashcards'];
        const section = sections[sectionIndex] || `section-${sectionIndex}`;
        
        // End previous section timing
        if (this.currentSection) {
            const timeSpent = Date.now() - this.sectionStartTime;
            this.recordLearningActivity('section-exit', {
                section: this.currentSection,
                timeSpent
            });
        }
        
        // Start new section timing
        this.currentSection = section;
        this.sectionStartTime = Date.now();
        
        this.recordLearningActivity('section-enter', { section });
    }

    analyzeErrorPatterns() {
        // This would analyze AI analysis results to identify common errors
        // For now, we'll simulate pattern detection
        setTimeout(() => {
            this.detectCommonErrors();
        }, 1000);
    }

    async detectCommonErrors() {
        try {
            const reports = await chrome.storage.local.get(['aiReports']);
            const aiReports = reports.aiReports || [];
            
            const errorPatterns = {};
            
            aiReports.forEach(report => {
                if (report.hasErrors && report.analysisData) {
                    // Simple pattern detection (in real implementation, would use NLP)
                    const analysis = report.analysisData.toLowerCase();
                    
                    if (analysis.includes('grammar')) {
                        errorPatterns.grammar = (errorPatterns.grammar || 0) + 1;
                    }
                    if (analysis.includes('tense')) {
                        errorPatterns.tense = (errorPatterns.tense || 0) + 1;
                    }
                    if (analysis.includes('spelling')) {
                        errorPatterns.spelling = (errorPatterns.spelling || 0) + 1;
                    }
                    if (analysis.includes('vocabulary')) {
                        errorPatterns.vocabulary = (errorPatterns.vocabulary || 0) + 1;
                    }
                }
            });
            
            // Update weaknesses based on patterns
            this.updateWeaknesses(errorPatterns);
            
        } catch (error) {
            console.error('Error pattern analysis failed:', error);
        }
    }

    updateWeaknesses(errorPatterns) {
        const threshold = 3; // Need at least 3 occurrences to identify weakness
        
        this.learningProfile.weaknesses = Object.entries(errorPatterns)
            .filter(([error, count]) => count >= threshold)
            .map(([error, count]) => ({ type: error, frequency: count }))
            .sort((a, b) => b.frequency - a.frequency);
        
        // Generate targeted recommendations
        this.generateWeaknessRecommendations();
    }

    generateWeaknessRecommendations() {
        const recommendations = [];
        
        this.learningProfile.weaknesses.forEach(weakness => {
            switch (weakness.type) {
                case 'grammar':
                    recommendations.push({
                        type: 'weakness-focus',
                        title: 'Grammar Focus Needed',
                        description: 'Practice with grammar-focused texts and exercises',
                        action: () => this.suggestGrammarPractice(),
                        priority: 'high',
                        icon: '📝'
                    });
                    break;
                case 'tense':
                    recommendations.push({
                        type: 'weakness-focus',
                        title: 'Tense Practice',
                        description: 'Focus on verb tenses in your next analyses',
                        action: () => this.suggestTensePractice(),
                        priority: 'high',
                        icon: '⏰'
                    });
                    break;
                case 'vocabulary':
                    recommendations.push({
                        type: 'weakness-focus',
                        title: 'Vocabulary Building',
                        description: 'Expand your vocabulary with targeted exercises',
                        action: () => this.suggestVocabularyPractice(),
                        priority: 'medium',
                        icon: '📚'
                    });
                    break;
            }
        });
        
        this.recommendations.push(...recommendations);
    }

    setupAdaptiveDifficulty() {
        // Adjust recommendations based on performance
        this.adaptiveFeatures.set('difficulty', {
            current: 'medium',
            adjustmentHistory: [],
            lastAdjustment: Date.now()
        });
    }

    adjustDifficulty(performance) {
        const difficulty = this.adaptiveFeatures.get('difficulty');
        const accuracyRate = performance.correct / (performance.correct + performance.incorrect);
        
        let newDifficulty = difficulty.current;
        
        if (accuracyRate > 0.9 && difficulty.current !== 'hard') {
            newDifficulty = difficulty.current === 'easy' ? 'medium' : 'hard';
        } else if (accuracyRate < 0.6 && difficulty.current !== 'easy') {
            newDifficulty = difficulty.current === 'hard' ? 'medium' : 'easy';
        }
        
        if (newDifficulty !== difficulty.current) {
            difficulty.current = newDifficulty;
            difficulty.adjustmentHistory.push({
                from: difficulty.current,
                to: newDifficulty,
                reason: `Accuracy: ${Math.round(accuracyRate * 100)}%`,
                timestamp: Date.now()
            });
            
            this.recommendations.push({
                type: 'adaptive',
                title: `Difficulty Adjusted to ${newDifficulty.charAt(0).toUpperCase() + newDifficulty.slice(1)}`,
                description: `Based on your ${Math.round(accuracyRate * 100)}% accuracy rate`,
                action: () => this.showDifficultyExplanation(newDifficulty),
                priority: 'medium',
                icon: '🎯'
            });
        }
    }

    monitorProgress() {
        // Check goal progress every 5 minutes
        setInterval(() => {
            this.updateGoalProgress();
        }, 300000);
    }

    async updateGoalProgress() {
        try {
            const reports = await chrome.storage.local.get(['aiReports']);
            const aiReports = reports.aiReports || [];
            
            // Update daily goal
            const today = new Date().toDateString();
            const todayReports = aiReports.filter(report => 
                new Date(report.timestamp).toDateString() === today
            );
            
            const dailyGoal = this.learningProfile.goals.find(g => g.type === 'daily');
            if (dailyGoal) {
                dailyGoal.current = todayReports.length;
                
                if (dailyGoal.current >= dailyGoal.target) {
                    this.celebrateGoalAchievement('daily');
                }
            }
            
            // Update accuracy goal
            const accuracyGoal = this.learningProfile.goals.find(g => g.type === 'accuracy');
            if (accuracyGoal && aiReports.length > 0) {
                const correctReports = aiReports.filter(r => r.isCorrect).length;
                accuracyGoal.current = Math.round((correctReports / aiReports.length) * 100);
                
                if (accuracyGoal.current >= accuracyGoal.target) {
                    this.celebrateGoalAchievement('accuracy');
                }
            }
            
        } catch (error) {
            console.error('Progress monitoring failed:', error);
        }
    }

    celebrateGoalAchievement(goalType) {
        const celebrations = {
            daily: {
                title: '🎉 Daily Goal Achieved!',
                message: 'Great job completing your daily analysis target!',
                reward: 'streak-bonus'
            },
            weekly: {
                title: '🏆 Weekly Champion!',
                message: 'Incredible! You\'ve hit your weekly target!',
                reward: 'feature-unlock'
            },
            accuracy: {
                title: '🎯 Accuracy Master!',
                message: 'Your accuracy rate is impressive!',
                reward: 'difficulty-boost'
            }
        };
        
        const celebration = celebrations[goalType];
        if (celebration) {
            this.showCelebration(celebration);
        }
    }

    createAssistantInterface() {
        this.addAssistantButton();
        this.createAssistantPanel();
    }

    addAssistantButton() {
        const header = document.querySelector('.header');
        if (!header || document.getElementById('assistantBtn')) return;
        
        const assistantButton = document.createElement('button');
        assistantButton.id = 'assistantBtn';
        assistantButton.className = 'assistant-btn';
        assistantButton.innerHTML = '🤖 Assistant';
        assistantButton.title = 'Smart Learning Assistant';
        assistantButton.addEventListener('click', () => this.toggleAssistantPanel());
        
        header.appendChild(assistantButton);
    }

    createAssistantPanel() {
        const panelHTML = `
            <div id="assistantPanel" class="assistant-panel" style="display: none;">
                <div class="assistant-header">
                    <div class="assistant-avatar">🤖</div>
                    <div class="assistant-info">
                        <div class="assistant-name">Learning Assistant</div>
                        <div class="assistant-status">Ready to help</div>
                    </div>
                    <button class="assistant-close" onclick="learningAssistant.toggleAssistantPanel()">✕</button>
                </div>
                
                <div class="assistant-content">
                    <!-- Quick Stats -->
                    <div class="assistant-section">
                        <h4>📊 Quick Stats</h4>
                        <div class="quick-stats">
                            <div class="stat-item">
                                <span class="stat-label">Today:</span>
                                <span class="stat-value" id="todayCount">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Accuracy:</span>
                                <span class="stat-value" id="currentAccuracy">0%</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Streak:</span>
                                <span class="stat-value" id="currentStreak">0d</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Recommendations -->
                    <div class="assistant-section">
                        <h4>💡 Recommendations</h4>
                        <div class="recommendations-list" id="recommendationsList">
                            <div class="recommendation-item">
                                <div class="rec-icon">🎯</div>
                                <div class="rec-content">
                                    <div class="rec-title">Keep practicing!</div>
                                    <div class="rec-description">Continue your learning journey</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Goals Progress -->
                    <div class="assistant-section">
                        <h4>🎯 Goals</h4>
                        <div class="goals-list" id="goalsList">
                            <!-- Goals will be populated here -->
                        </div>
                    </div>
                    
                    <!-- Quick Actions -->
                    <div class="assistant-section">
                        <h4>⚡ Quick Actions</h4>
                        <div class="quick-actions">
                            <button class="quick-action-btn" onclick="learningAssistant.suggestPracticeText()">
                                📝 Practice Suggestion
                            </button>
                            <button class="quick-action-btn" onclick="learningAssistant.showWeaknessAnalysis()">
                                🎯 Weakness Analysis
                            </button>
                            <button class="quick-action-btn" onclick="learningAssistant.generateStudyPlan()">
                                📅 Study Plan
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        
        // Store global reference
        window.learningAssistant = this;
    }

    toggleAssistantPanel() {
        const panel = document.getElementById('assistantPanel');
        if (!panel) return;
        
        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            this.updateAssistantPanel();
        }
    }

    async updateAssistantPanel() {
        // Update quick stats
        await this.updateQuickStats();
        
        // Update recommendations
        this.updateRecommendationsList();
        
        // Update goals
        this.updateGoalsList();
    }

    async updateQuickStats() {
        try {
            const reports = await chrome.storage.local.get(['aiReports']);
            const aiReports = reports.aiReports || [];
            
            // Today's count
            const today = new Date().toDateString();
            const todayReports = aiReports.filter(report => 
                new Date(report.timestamp).toDateString() === today
            );
            document.getElementById('todayCount').textContent = todayReports.length;
            
            // Accuracy
            const correctReports = aiReports.filter(r => r.isCorrect).length;
            const accuracy = aiReports.length > 0 ? 
                Math.round((correctReports / aiReports.length) * 100) : 0;
            document.getElementById('currentAccuracy').textContent = `${accuracy}%`;
            
            // Streak (simplified calculation)
            const streak = this.calculateCurrentStreak(aiReports);
            document.getElementById('currentStreak').textContent = `${streak}d`;
            
        } catch (error) {
            console.error('Failed to update quick stats:', error);
        }
    }

    calculateCurrentStreak(reports) {
        // Simplified streak calculation
        if (reports.length === 0) return 0;
        
        const sortedReports = reports
            .filter(r => r.timestamp)
            .sort((a, b) => b.timestamp - a.timestamp);
        
        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        
        for (const report of sortedReports) {
            const reportDate = new Date(report.timestamp);
            reportDate.setHours(0, 0, 0, 0);
            
            const dayDiff = Math.floor((currentDate - reportDate) / (1000 * 60 * 60 * 24));
            
            if (dayDiff === streak) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else if (dayDiff > streak) {
                break;
            }
        }
        
        return streak;
    }

    updateRecommendationsList() {
        const container = document.getElementById('recommendationsList');
        if (!container) return;
        
        if (this.recommendations.length === 0) {
            container.innerHTML = `
                <div class="recommendation-item">
                    <div class="rec-icon">✨</div>
                    <div class="rec-content">
                        <div class="rec-title">Great start!</div>
                        <div class="rec-description">Keep using the extension to get personalized recommendations</div>
                    </div>
                </div>
            `;
            return;
        }
        
        const topRecommendations = this.recommendations
            .sort((a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            })
            .slice(0, 3);
        
        container.innerHTML = topRecommendations.map(rec => `
            <div class="recommendation-item ${rec.priority}" onclick="learningAssistant.executeRecommendation('${rec.type}')">
                <div class="rec-icon">${rec.icon}</div>
                <div class="rec-content">
                    <div class="rec-title">${rec.title}</div>
                    <div class="rec-description">${rec.description}</div>
                </div>
            </div>
        `).join('');
    }

    updateGoalsList() {
        const container = document.getElementById('goalsList');
        if (!container) return;
        
        container.innerHTML = this.learningProfile.goals.map(goal => {
            const progress = Math.min((goal.current / goal.target) * 100, 100);
            const isCompleted = goal.current >= goal.target;
            
            return `
                <div class="goal-item ${isCompleted ? 'completed' : ''}">
                    <div class="goal-header">
                        <span class="goal-title">${goal.description}</span>
                        <span class="goal-progress">${goal.current}/${goal.target}</span>
                    </div>
                    <div class="goal-bar">
                        <div class="goal-fill" style="width: ${progress}%"></div>
                    </div>
                    ${isCompleted ? '<div class="goal-badge">🎉 Completed!</div>' : ''}
                </div>
            `;
        }).join('');
    }

    generatePersonalizedRecommendations() {
        // Generate recommendations based on learning profile
        this.recommendations = [];
        
        // Time-based recommendations
        const hour = new Date().getHours();
        if (hour >= 9 && hour <= 11) {
            this.recommendations.push({
                type: 'time-based',
                title: 'Morning Learning Session',
                description: 'Perfect time for focused language practice',
                action: () => this.startMorningSession(),
                priority: 'medium',
                icon: '🌅'
            });
        }
        
        // Progress-based recommendations
        const dailyGoal = this.learningProfile.goals.find(g => g.type === 'daily');
        if (dailyGoal && dailyGoal.current < dailyGoal.target) {
            const remaining = dailyGoal.target - dailyGoal.current;
            this.recommendations.push({
                type: 'progress-based',
                title: 'Daily Goal Progress',
                description: `${remaining} more analyses to reach your daily goal`,
                action: () => this.focusOnDailyGoal(),
                priority: 'high',
                icon: '🎯'
            });
        }
    }

    // Action methods
    executeRecommendation(type) {
        const recommendation = this.recommendations.find(r => r.type === type);
        if (recommendation && recommendation.action) {
            recommendation.action();
        }
    }

    suggestPracticeText() {
        const suggestions = [
            "Try analyzing a news article for current vocabulary",
            "Practice with song lyrics for colloquial expressions",
            "Analyze a business email for formal language",
            "Work with a short story for narrative structures",
            "Practice with social media posts for informal language"
        ];
        
        const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        this.showAssistantMessage('Practice Suggestion', suggestion);
    }

    showWeaknessAnalysis() {
        if (this.learningProfile.weaknesses.length === 0) {
            this.showAssistantMessage('Weakness Analysis', 'Great job! No significant weaknesses detected yet. Keep learning to get more detailed analysis.');
            return;
        }
        
        const topWeakness = this.learningProfile.weaknesses[0];
        const message = `Your main area for improvement is ${topWeakness.type}. You've encountered this ${topWeakness.frequency} times. Focus on this area in your next learning sessions.`;
        
        this.showAssistantMessage('Weakness Analysis', message);
    }

    generateStudyPlan() {
        const plan = [
            "📅 Weekly Study Plan:",
            "• Morning: Grammar practice (15 min)",
            "• Afternoon: Vocabulary building (10 min)",
            "• Evening: Reading comprehension (20 min)",
            "",
            "🎯 Focus Areas:",
            "• " + (this.learningProfile.weaknesses[0]?.type || "General practice"),
            "• " + (this.learningProfile.weaknesses[1]?.type || "Vocabulary expansion"),
            "",
            "🏆 Goals:",
            "• Complete daily analysis target",
            "• Maintain accuracy above 80%",
            "• Build learning streak"
        ].join('\n');
        
        this.showAssistantMessage('Study Plan', plan);
    }

    showAssistantMessage(title, message) {
        const messageHTML = `
            <div class="assistant-message-overlay" onclick="this.remove()">
                <div class="assistant-message" onclick="event.stopPropagation()">
                    <div class="message-header">
                        <h3>${title}</h3>
                        <button onclick="this.closest('.assistant-message-overlay').remove()">✕</button>
                    </div>
                    <div class="message-content">
                        <pre>${message}</pre>
                    </div>
                    <div class="message-actions">
                        <button onclick="this.closest('.assistant-message-overlay').remove()">Got it!</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', messageHTML);
    }

    showCelebration(celebration) {
        const celebrationHTML = `
            <div class="celebration-overlay">
                <div class="celebration-content">
                    <div class="celebration-title">${celebration.title}</div>
                    <div class="celebration-message">${celebration.message}</div>
                    <div class="celebration-animation">🎉✨🎊</div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', celebrationHTML);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            document.querySelector('.celebration-overlay')?.remove();
        }, 3000);
    }

    async saveLearningProfile() {
        try {
            await chrome.storage.local.set({ learningProfile: this.learningProfile });
        } catch (error) {
            console.error('Failed to save learning profile:', error);
        }
    }

    getCurrentSessionId() {
        if (!this.sessionId) {
            this.sessionId = Date.now().toString();
        }
        return this.sessionId;
    }

    analyzeLearningPatterns() {
        // Analyze recent learning activity for patterns
        const recentActivities = this.learningProfile.sessionHistory.slice(-50);
        
        // Time pattern analysis
        const timePattern = this.analyzeTimePatterns(recentActivities);
        
        // Feature usage patterns
        const featurePattern = this.analyzeFeaturePatterns(recentActivities);
        
        // Generate insights based on patterns
        this.generatePatternInsights(timePattern, featurePattern);
    }

    analyzeTimePatterns(activities) {
        const timeDistribution = {};
        
        activities.forEach(activity => {
            const hour = new Date(activity.timestamp).getHours();
            const timeSlot = this.getTimeSlot(hour);
            timeDistribution[timeSlot] = (timeDistribution[timeSlot] || 0) + 1;
        });
        
        return timeDistribution;
    }

    getTimeSlot(hour) {
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }

    analyzeFeaturePatterns(activities) {
        const featureUsage = {};
        
        activities.forEach(activity => {
            featureUsage[activity.type] = (featureUsage[activity.type] || 0) + 1;
        });
        
        return featureUsage;
    }

    generatePatternInsights(timePattern, featurePattern) {
        // Find most productive time
        const mostProductiveTime = Object.entries(timePattern)
            .sort(([,a], [,b]) => b - a)[0];
        
        if (mostProductiveTime) {
            this.recommendations.push({
                type: 'pattern-insight',
                title: `Peak Learning Time: ${mostProductiveTime[0]}`,
                description: `You're most active during ${mostProductiveTime[0]}. Schedule important practice sessions then.`,
                priority: 'medium',
                icon: '⏰'
            });
        }
        
        // Find most used feature
        const mostUsedFeature = Object.entries(featurePattern)
            .sort(([,a], [,b]) => b - a)[0];
        
        if (mostUsedFeature) {
            this.recommendations.push({
                type: 'pattern-insight',
                title: `Favorite Feature: ${mostUsedFeature[0]}`,
                description: `You use ${mostUsedFeature[0]} frequently. Consider exploring other features too.`,
                priority: 'low',
                icon: '🔍'
            });
        }
    }
}

// Initialize smart learning assistant
document.addEventListener('DOMContentLoaded', () => {
    new SmartLearningAssistant();
});