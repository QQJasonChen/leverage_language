/**
 * Advanced Analytics Dashboard
 * Professional insights and learning analytics
 */

class AdvancedAnalyticsDashboard {
    constructor() {
        this.analytics = {
            sessions: [],
            learningProgress: {},
            usage: {},
            insights: []
        };
        this.charts = new Map();
        this.initialized = false;
        
        this.init();
    }

    async init() {
        if (this.initialized) return;
        
        await this.loadAnalyticsData();
        this.setupAnalyticsTracking();
        this.createAnalyticsDashboard();
        this.setupRealTimeUpdates();
        
        this.initialized = true;
        console.log('📊 Advanced Analytics Dashboard initialized');
    }

    async loadAnalyticsData() {
        try {
            const data = await chrome.storage.local.get(['analyticsData']);
            this.analytics = data.analyticsData || this.getDefaultAnalytics();
        } catch (error) {
            console.error('Failed to load analytics:', error);
            this.analytics = this.getDefaultAnalytics();
        }
    }

    getDefaultAnalytics() {
        return {
            sessions: [],
            learningProgress: {
                totalWords: 0,
                correctAnalyses: 0,
                errorsFound: 0,
                languagesStudied: new Set(),
                weeklyGoal: 50,
                streak: 0
            },
            usage: {
                dailyUsage: {},
                featureUsage: {},
                timeSpent: 0
            },
            insights: [],
            achievements: []
        };
    }

    setupAnalyticsTracking() {
        // Track session start
        this.startSession();
        
        // Track feature usage
        this.trackFeatureUsage();
        
        // Track learning progress
        this.trackLearningProgress();
        
        // Save analytics on page unload
        window.addEventListener('beforeunload', () => this.saveAnalytics());
    }

    startSession() {
        const session = {
            id: Date.now(),
            startTime: Date.now(),
            endTime: null,
            actionsCount: 0,
            features: new Set(),
            languages: new Set()
        };
        
        this.currentSession = session;
        this.analytics.sessions.push(session);
    }

    trackFeatureUsage() {
        // Track AI analysis usage
        const aiButton = document.getElementById('generateAiAnalysisBtn');
        if (aiButton) {
            aiButton.addEventListener('click', () => {
                this.recordFeatureUsage('ai-analysis');
                this.currentSession.features.add('ai-analysis');
            });
        }

        // Track audio generation
        const audioButton = document.getElementById('generateAudioBtn');
        if (audioButton) {
            audioButton.addEventListener('click', () => {
                this.recordFeatureUsage('audio-generation');
                this.currentSession.features.add('audio-generation');
            });
        }

        // Track manual search
        const searchButton = document.getElementById('manualSearchBtn');
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                this.recordFeatureUsage('manual-search');
                this.currentSession.features.add('manual-search');
            });
        }

        // Track tab switches
        document.querySelectorAll('.view-button').forEach((button, index) => {
            button.addEventListener('click', () => {
                this.recordFeatureUsage(`tab-${index}`);
            });
        });
    }

    recordFeatureUsage(feature) {
        const today = new Date().toDateString();
        
        if (!this.analytics.usage.dailyUsage[today]) {
            this.analytics.usage.dailyUsage[today] = {};
        }
        
        this.analytics.usage.dailyUsage[today][feature] = 
            (this.analytics.usage.dailyUsage[today][feature] || 0) + 1;
        
        this.analytics.usage.featureUsage[feature] = 
            (this.analytics.usage.featureUsage[feature] || 0) + 1;

        this.currentSession.actionsCount++;
        
        // Generate insights based on usage patterns
        this.generateInsights();
    }

    trackLearningProgress() {
        // Monitor storage changes for learning progress
        const observer = new MutationObserver(() => {
            this.updateLearningMetrics();
        });
        
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }

    async updateLearningMetrics() {
        try {
            // Get saved reports for analysis
            const reports = await chrome.storage.local.get(['aiReports']);
            const aiReports = reports.aiReports || [];
            
            // Calculate metrics
            this.analytics.learningProgress.totalWords = aiReports.length;
            this.analytics.learningProgress.correctAnalyses = 
                aiReports.filter(r => r.isCorrect).length;
            this.analytics.learningProgress.errorsFound = 
                aiReports.filter(r => r.hasErrors).length;
            
            // Track languages
            aiReports.forEach(report => {
                if (report.language) {
                    this.analytics.learningProgress.languagesStudied.add(report.language);
                }
            });
            
            // Calculate streak
            this.calculateLearningStreak(aiReports);
            
            // Update dashboard if visible
            this.updateDashboardMetrics();
            
        } catch (error) {
            console.error('Failed to update learning metrics:', error);
        }
    }

    calculateLearningStreak(reports) {
        if (!reports.length) {
            this.analytics.learningProgress.streak = 0;
            return;
        }
        
        // Sort reports by date
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
        
        this.analytics.learningProgress.streak = streak;
    }

    generateInsights() {
        const insights = [];
        const usage = this.analytics.usage;
        const progress = this.analytics.learningProgress;
        
        // Usage pattern insights
        const totalActions = Object.values(usage.featureUsage)
            .reduce((sum, count) => sum + count, 0);
        
        if (totalActions > 50) {
            const aiUsage = usage.featureUsage['ai-analysis'] || 0;
            const aiPercentage = (aiUsage / totalActions) * 100;
            
            if (aiPercentage > 60) {
                insights.push({
                    type: 'positive',
                    title: 'AI Power User!',
                    description: `You're using AI analysis ${aiPercentage.toFixed(0)}% of the time. Great for deep learning!`,
                    icon: '🧠'
                });
            }
        }
        
        // Learning progress insights
        if (progress.streak >= 7) {
            insights.push({
                type: 'achievement',
                title: 'Week Streak!',
                description: `Amazing! You've been learning for ${progress.streak} days straight.`,
                icon: '🔥'
            });
        }
        
        if (progress.correctAnalyses > progress.errorsFound * 2) {
            insights.push({
                type: 'positive',
                title: 'High Accuracy',
                description: 'Your texts are mostly grammatically correct. Consider challenging yourself with more complex content.',
                icon: '🎯'
            });
        }
        
        // Language diversity insight
        const languageCount = this.analytics.learningProgress.languagesStudied.size;
        if (languageCount >= 3) {
            insights.push({
                type: 'achievement',
                title: 'Polyglot Progress',
                description: `You're studying ${languageCount} languages! That's impressive dedication.`,
                icon: '🌍'
            });
        }
        
        // Store recent insights (keep last 10)
        this.analytics.insights = [...insights, ...this.analytics.insights]
            .slice(0, 10);
    }

    createAnalyticsDashboard() {
        // Add analytics tab button if it doesn't exist
        this.addAnalyticsTab();
        
        // Create dashboard content
        this.createDashboardContent();
    }

    addAnalyticsTab() {
        const tabContainer = document.querySelector('.nav-tabs');
        if (!tabContainer || document.getElementById('showAnalyticsProBtn')) return;
        
        const analyticsTab = document.createElement('button');
        analyticsTab.id = 'showAnalyticsProBtn';
        analyticsTab.className = 'view-button';
        analyticsTab.innerHTML = '📊 Analytics Pro';
        analyticsTab.addEventListener('click', () => this.showAnalyticsDashboard());
        
        tabContainer.appendChild(analyticsTab);
    }

    createDashboardContent() {
        // Create analytics content area
        const contentArea = document.querySelector('.content-area') || document.body;
        
        const analyticsHTML = `
            <div id="analytics-pro-content" class="analytics-dashboard" style="display: none;">
                <div class="dashboard-header">
                    <h2>📊 Learning Analytics Pro</h2>
                    <div class="dashboard-actions">
                        <button class="btn-refresh" onclick="analyticsCore.refreshDashboard()">🔄 Refresh</button>
                        <button class="btn-export" onclick="analyticsCore.exportAnalytics()">📥 Export</button>
                    </div>
                </div>
                
                <div class="analytics-grid">
                    <!-- Key Metrics -->
                    <div class="metrics-section">
                        <h3>📈 Key Metrics</h3>
                        <div class="metrics-cards">
                            <div class="metric-card primary">
                                <div class="metric-value" id="totalWords">0</div>
                                <div class="metric-label">Total Analyses</div>
                                <div class="metric-change">+12% this week</div>
                            </div>
                            <div class="metric-card success">
                                <div class="metric-value" id="correctRate">0%</div>
                                <div class="metric-label">Accuracy Rate</div>
                                <div class="metric-change">+5% improvement</div>
                            </div>
                            <div class="metric-card warning">
                                <div class="metric-value" id="currentStreak">0</div>
                                <div class="metric-label">Day Streak</div>
                                <div class="metric-change">🔥 Keep it up!</div>
                            </div>
                            <div class="metric-card info">
                                <div class="metric-value" id="languageCount">0</div>
                                <div class="metric-label">Languages</div>
                                <div class="metric-change">🌍 Multilingual</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Usage Chart -->
                    <div class="chart-section">
                        <h3>📊 Daily Usage</h3>
                        <div class="chart-container">
                            <canvas id="usageChart" width="400" height="200"></canvas>
                        </div>
                    </div>
                    
                    <!-- Learning Progress -->
                    <div class="progress-section">
                        <h3>🎯 Learning Progress</h3>
                        <div class="progress-items">
                            <div class="progress-item">
                                <div class="progress-header">
                                    <span>Weekly Goal</span>
                                    <span id="weeklyProgress">0/50</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill" id="weeklyProgressBar" style="width: 0%"></div>
                                </div>
                            </div>
                            <div class="progress-item">
                                <div class="progress-header">
                                    <span>Accuracy Improvement</span>
                                    <span id="accuracyTrend">+15%</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill success" id="accuracyProgressBar" style="width: 75%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Recent Insights -->
                    <div class="insights-section">
                        <h3>💡 AI Insights</h3>
                        <div class="insights-list" id="insightsList">
                            <!-- Insights will be populated here -->
                        </div>
                    </div>
                    
                    <!-- Feature Usage -->
                    <div class="features-section">
                        <h3>🛠️ Feature Usage</h3>
                        <div class="feature-stats" id="featureStats">
                            <!-- Feature stats will be populated here -->
                        </div>
                    </div>
                    
                    <!-- Achievements -->
                    <div class="achievements-section">
                        <h3>🏆 Achievements</h3>
                        <div class="achievements-grid" id="achievementsGrid">
                            <!-- Achievement badges will be populated here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        contentArea.insertAdjacentHTML('beforeend', analyticsHTML);
        
        // Store reference globally
        window.analyticsCore = this;
    }

    showAnalyticsDashboard() {
        // Hide other content
        document.querySelectorAll('.content-area > div').forEach(div => {
            div.style.display = 'none';
        });
        
        // Show analytics dashboard
        const dashboard = document.getElementById('analytics-pro-content');
        if (dashboard) {
            dashboard.style.display = 'block';
            this.updateDashboardMetrics();
            this.drawCharts();
        }
        
        // Update active tab
        document.querySelectorAll('.view-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById('showAnalyticsProBtn')?.classList.add('active');
    }

    updateDashboardMetrics() {
        const progress = this.analytics.learningProgress;
        const usage = this.analytics.usage;
        
        // Update metric cards
        document.getElementById('totalWords').textContent = progress.totalWords;
        document.getElementById('currentStreak').textContent = progress.streak;
        document.getElementById('languageCount').textContent = progress.languagesStudied.size;
        
        // Calculate accuracy rate
        const totalAnalyses = progress.correctAnalyses + progress.errorsFound;
        const accuracyRate = totalAnalyses > 0 ? 
            Math.round((progress.correctAnalyses / totalAnalyses) * 100) : 0;
        document.getElementById('correctRate').textContent = `${accuracyRate}%`;
        
        // Update weekly progress
        const weeklyCount = this.getWeeklyAnalysisCount();
        document.getElementById('weeklyProgress').textContent = `${weeklyCount}/${progress.weeklyGoal}`;
        const weeklyPercentage = Math.min((weeklyCount / progress.weeklyGoal) * 100, 100);
        document.getElementById('weeklyProgressBar').style.width = `${weeklyPercentage}%`;
        
        // Update insights
        this.updateInsightsList();
        
        // Update feature stats
        this.updateFeatureStats();
        
        // Update achievements
        this.updateAchievements();
    }

    getWeeklyAnalysisCount() {
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const today = new Date().toDateString();
        
        let count = 0;
        for (let i = 0; i < 7; i++) {
            const date = new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toDateString();
            const dayUsage = this.analytics.usage.dailyUsage[date];
            if (dayUsage) {
                count += Object.values(dayUsage).reduce((sum, val) => sum + val, 0);
            }
        }
        
        return count;
    }

    updateInsightsList() {
        const container = document.getElementById('insightsList');
        if (!container) return;
        
        const insights = this.analytics.insights.slice(0, 5); // Show top 5
        
        if (insights.length === 0) {
            container.innerHTML = `
                <div class="insight-item">
                    <div class="insight-icon">🤔</div>
                    <div class="insight-content">
                        <div class="insight-title">Keep Learning!</div>
                        <div class="insight-description">Use the extension more to get personalized insights.</div>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = insights.map(insight => `
            <div class="insight-item ${insight.type}">
                <div class="insight-icon">${insight.icon}</div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-description">${insight.description}</div>
                </div>
            </div>
        `).join('');
    }

    updateFeatureStats() {
        const container = document.getElementById('featureStats');
        if (!container) return;
        
        const features = this.analytics.usage.featureUsage;
        const total = Object.values(features).reduce((sum, count) => sum + count, 0);
        
        if (total === 0) {
            container.innerHTML = '<div class="no-data">No feature usage data yet</div>';
            return;
        }
        
        const featureNames = {
            'ai-analysis': 'AI Analysis',
            'audio-generation': 'Audio Generation',
            'manual-search': 'Manual Search',
            'tab-0': 'Analysis Tab',
            'tab-3': 'History Tab',
            'tab-4': 'Saved Reports'
        };
        
        container.innerHTML = Object.entries(features)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 6)
            .map(([feature, count]) => {
                const percentage = Math.round((count / total) * 100);
                return `
                    <div class="feature-stat">
                        <div class="feature-name">${featureNames[feature] || feature}</div>
                        <div class="feature-bar">
                            <div class="feature-fill" style="width: ${percentage}%"></div>
                        </div>
                        <div class="feature-count">${count} (${percentage}%)</div>
                    </div>
                `;
            }).join('');
    }

    updateAchievements() {
        const container = document.getElementById('achievementsGrid');
        if (!container) return;
        
        const achievements = this.calculateAchievements();
        
        container.innerHTML = achievements.map(achievement => `
            <div class="achievement-badge ${achievement.earned ? 'earned' : 'locked'}">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-description">${achievement.description}</div>
                ${achievement.earned ? '<div class="achievement-date">Earned!</div>' : ''}
            </div>
        `).join('');
    }

    calculateAchievements() {
        const progress = this.analytics.learningProgress;
        const usage = this.analytics.usage;
        
        return [
            {
                name: 'First Steps',
                description: 'Complete your first analysis',
                icon: '👶',
                earned: progress.totalWords >= 1
            },
            {
                name: 'Dedicated Learner',
                description: 'Analyze 50 texts',
                icon: '📚',
                earned: progress.totalWords >= 50
            },
            {
                name: 'Streak Master',
                description: '7-day learning streak',
                icon: '🔥',
                earned: progress.streak >= 7
            },
            {
                name: 'Polyglot',
                description: 'Study 3 different languages',
                icon: '🌍',
                earned: progress.languagesStudied.size >= 3
            },
            {
                name: 'AI Explorer',
                description: 'Use AI analysis 100 times',
                icon: '🧠',
                earned: (usage.featureUsage['ai-analysis'] || 0) >= 100
            },
            {
                name: 'Audio Master',
                description: 'Generate 25 audio files',
                icon: '🎵',
                earned: (usage.featureUsage['audio-generation'] || 0) >= 25
            }
        ];
    }

    drawCharts() {
        this.drawUsageChart();
    }

    drawUsageChart() {
        const canvas = document.getElementById('usageChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const usage = this.analytics.usage.dailyUsage;
        
        // Prepare data for last 7 days
        const days = [];
        const data = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
            const dateStr = date.toDateString();
            const dayUsage = usage[dateStr];
            
            days.push(date.toLocaleDateString('en', { weekday: 'short' }));
            data.push(dayUsage ? Object.values(dayUsage).reduce((sum, val) => sum + val, 0) : 0);
        }
        
        // Simple bar chart
        const maxValue = Math.max(...data, 1);
        const barWidth = canvas.width / days.length - 20;
        const barMaxHeight = canvas.height - 60;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw bars
        ctx.fillStyle = '#1976d2';
        data.forEach((value, index) => {
            const barHeight = (value / maxValue) * barMaxHeight;
            const x = (index * (barWidth + 20)) + 10;
            const y = canvas.height - barHeight - 30;
            
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw day labels
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(days[index], x + barWidth/2, canvas.height - 10);
            
            // Draw values
            if (value > 0) {
                ctx.fillStyle = '#333';
                ctx.fillText(value.toString(), x + barWidth/2, y - 5);
            }
            
            ctx.fillStyle = '#1976d2';
        });
    }

    async saveAnalytics() {
        try {
            // End current session
            if (this.currentSession) {
                this.currentSession.endTime = Date.now();
            }
            
            // Convert Set to Array for storage
            const analyticsToSave = {
                ...this.analytics,
                learningProgress: {
                    ...this.analytics.learningProgress,
                    languagesStudied: Array.from(this.analytics.learningProgress.languagesStudied)
                }
            };
            
            await chrome.storage.local.set({ analyticsData: analyticsToSave });
        } catch (error) {
            console.error('Failed to save analytics:', error);
        }
    }

    async exportAnalytics() {
        const data = {
            generatedAt: new Date().toISOString(),
            analytics: this.analytics,
            summary: {
                totalSessions: this.analytics.sessions.length,
                totalActions: Object.values(this.analytics.usage.featureUsage)
                    .reduce((sum, count) => sum + count, 0),
                averageSessionLength: this.calculateAverageSessionLength(),
                mostUsedFeature: this.getMostUsedFeature()
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youglish-analytics-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    calculateAverageSessionLength() {
        const completedSessions = this.analytics.sessions.filter(s => s.endTime);
        if (completedSessions.length === 0) return 0;
        
        const totalTime = completedSessions.reduce((sum, session) => 
            sum + (session.endTime - session.startTime), 0);
        
        return Math.round(totalTime / completedSessions.length / 1000); // in seconds
    }

    getMostUsedFeature() {
        const features = this.analytics.usage.featureUsage;
        let maxFeature = '';
        let maxCount = 0;
        
        for (const [feature, count] of Object.entries(features)) {
            if (count > maxCount) {
                maxCount = count;
                maxFeature = feature;
            }
        }
        
        return maxFeature;
    }

    refreshDashboard() {
        this.updateLearningMetrics();
        this.updateDashboardMetrics();
        this.drawCharts();
        
        // Show refresh animation
        const refreshBtn = document.querySelector('.btn-refresh');
        if (refreshBtn) {
            refreshBtn.style.animation = 'spin 0.5s ease';
            setTimeout(() => refreshBtn.style.animation = '', 500);
        }
    }

    setupRealTimeUpdates() {
        // Update analytics every 30 seconds
        setInterval(() => {
            this.updateLearningMetrics();
            if (document.getElementById('analytics-pro-content')?.style.display !== 'none') {
                this.updateDashboardMetrics();
            }
        }, 30000);
    }
}

// Initialize analytics dashboard
document.addEventListener('DOMContentLoaded', () => {
    new AdvancedAnalyticsDashboard();
});