/**
 * Professional Error Handler
 * Provides intelligent, contextual error handling like premium tools
 */

class ProfessionalErrorHandler {
    constructor() {
        this.errorQueue = [];
        this.retryAttempts = new Map();
        this.userContext = new Map();
        this.init();
    }

    init() {
        this.injectErrorStyles();
        this.setupGlobalErrorHandling();
        this.setupRetryStrategies();
    }

    /**
     * Show intelligent error with contextual solutions
     * @param {string} containerId - Element to show error in
     * @param {Error|string} error - Error object or message
     * @param {Object} context - Context information
     */
    showIntelligentError(containerId, error, context = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const errorInfo = this.analyzeError(error, context);
        const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store error context
        this.userContext.set(errorId, {
            containerId,
            error: errorInfo,
            context,
            timestamp: Date.now()
        });

        // Create intelligent error UI
        const errorHTML = this.createIntelligentErrorHTML(errorInfo, errorId, context);
        
        // Show error with smooth transition
        container.innerHTML = errorHTML;
        
        // Add to error queue for analytics
        this.errorQueue.push({
            id: errorId,
            type: errorInfo.type,
            message: errorInfo.message,
            timestamp: Date.now(),
            context
        });

        return errorId;
    }

    /**
     * Analyze error and provide intelligent context
     */
    analyzeError(error, context) {
        let errorMessage = typeof error === 'string' ? error : error.message;
        let errorType = 'unknown';
        let solutions = [];
        let severity = 'medium';
        let canRetry = false;
        let icon = '⚠️';

        // Network errors
        if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
            errorType = 'network';
            icon = '🌐';
            severity = 'high';
            canRetry = true;
            solutions = [
                'Check your internet connection',
                'Try again in a few moments',
                'Switch to a different network if available'
            ];
            errorMessage = 'Connection issue - please check your internet';
        }
        
        // API errors
        else if (errorMessage.includes('API') || errorMessage.includes('401') || errorMessage.includes('403')) {
            errorType = 'api';
            icon = '🔑';
            severity = 'high';
            canRetry = false;
            solutions = [
                'Check your API key in settings',
                'Verify your account has sufficient credits',
                'Contact support if the issue persists'
            ];
            errorMessage = 'API authentication issue';
        }
        
        // Rate limiting
        else if (errorMessage.includes('rate') || errorMessage.includes('limit') || errorMessage.includes('429')) {
            errorType = 'rate_limit';
            icon = '⏱️';
            severity = 'medium';
            canRetry = true;
            solutions = [
                'Wait a moment before trying again',
                'Consider upgrading your plan for higher limits',
                'Try analyzing shorter text segments'
            ];
            errorMessage = 'Rate limit reached - please wait a moment';
        }
        
        // Audio generation errors
        else if (context.operation === 'audio-generation') {
            errorType = 'audio';
            icon = '🎵';
            severity = 'medium';
            canRetry = true;
            solutions = [
                'Try a shorter text segment',
                'Check if the text contains special characters',
                'Switch to a different voice model'
            ];
            errorMessage = 'Audio generation failed';
        }
        
        // AI analysis errors
        else if (context.operation === 'ai-analysis') {
            errorType = 'ai_analysis';
            icon = '🧠';
            severity = 'medium';
            canRetry = true;
            solutions = [
                'Try simplifying the text',
                'Check if the language is supported',
                'Break down longer texts into smaller parts'
            ];
            errorMessage = 'AI analysis encountered an issue';
        }
        
        // Storage errors
        else if (errorMessage.includes('storage') || errorMessage.includes('quota')) {
            errorType = 'storage';
            icon = '💾';
            severity = 'high';
            canRetry = false;
            solutions = [
                'Clear some old saved reports',
                'Export your data to free up space',
                'Check browser storage settings'
            ];
            errorMessage = 'Storage space issue';
        }

        return {
            type: errorType,
            message: errorMessage,
            originalError: error,
            solutions,
            severity,
            canRetry,
            icon,
            timestamp: Date.now()
        };
    }

    /**
     * Create intelligent error HTML with solutions
     */
    createIntelligentErrorHTML(errorInfo, errorId, context) {
        const { type, message, solutions, severity, canRetry, icon } = errorInfo;
        
        const severityClass = severity === 'high' ? 'error-high' : severity === 'medium' ? 'error-medium' : 'error-low';
        
        return `
            <div class="professional-error ${severityClass}" data-error-id="${errorId}">
                <div class="error-container">
                    <div class="error-header">
                        <div class="error-icon">${icon}</div>
                        <div class="error-title">${message}</div>
                    </div>
                    
                    <div class="error-details">
                        <div class="error-type">Error Type: ${type.replace('_', ' ').toUpperCase()}</div>
                        
                        ${solutions.length > 0 ? `
                            <div class="error-solutions">
                                <div class="solutions-title">💡 Quick Solutions:</div>
                                <ul class="solutions-list">
                                    ${solutions.map(solution => `<li>${solution}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="error-actions">
                        ${canRetry ? `
                            <button class="error-button retry-button" onclick="window.professionalErrorHandler.retryOperation('${errorId}')">
                                🔄 Try Again
                            </button>
                        ` : ''}
                        
                        <button class="error-button report-button" onclick="window.professionalErrorHandler.reportError('${errorId}')">
                            📝 Report Issue
                        </button>
                        
                        <button class="error-button dismiss-button" onclick="window.professionalErrorHandler.dismissError('${errorId}')">
                            ✕ Dismiss
                        </button>
                    </div>
                    
                    <div class="error-footer">
                        <div class="error-time">Occurred at ${new Date().toLocaleTimeString()}</div>
                        <div class="error-help">
                            <a href="#" onclick="window.professionalErrorHandler.showDetailedHelp('${type}')">
                                Need more help?
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Retry operation with intelligent backoff
     */
    async retryOperation(errorId) {
        const errorContext = this.userContext.get(errorId);
        if (!errorContext) return;

        const { containerId, error, context } = errorContext;
        const retryKey = `${context.operation || 'unknown'}_${containerId}`;
        
        // Get current retry count
        const currentRetries = this.retryAttempts.get(retryKey) || 0;
        const maxRetries = this.getMaxRetries(error.type);
        
        if (currentRetries >= maxRetries) {
            this.showMaxRetriesError(containerId);
            return;
        }

        // Increment retry count
        this.retryAttempts.set(retryKey, currentRetries + 1);
        
        // Calculate backoff delay
        const backoffDelay = this.calculateBackoffDelay(currentRetries, error.type);
        
        // Show retry in progress
        this.showRetryInProgress(containerId, backoffDelay);
        
        // Wait for backoff
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        // Attempt retry
        try {
            await this.executeRetry(context, containerId);
            // Reset retry count on success
            this.retryAttempts.delete(retryKey);
        } catch (retryError) {
            this.showIntelligentError(containerId, retryError, context);
        }
    }

    /**
     * Execute the retry based on context
     */
    async executeRetry(context, containerId) {
        const { operation, originalFunction, button } = context;
        
        if (button && button.onclick) {
            // Re-trigger the original button click
            button.onclick();
        } else if (originalFunction) {
            // Call the original function
            await originalFunction();
        } else {
            // Try to find and re-trigger based on operation type
            await this.retryByOperationType(operation, containerId);
        }
    }

    /**
     * Retry by operation type
     */
    async retryByOperationType(operation, containerId) {
        switch (operation) {
            case 'ai-analysis':
                const aiButton = document.getElementById('generateAiAnalysisBtn');
                if (aiButton && aiButton.onclick) aiButton.onclick();
                break;
                
            case 'audio-generation':
                const audioButton = document.getElementById('generateAudioBtn');
                if (audioButton && audioButton.onclick) audioButton.onclick();
                break;
                
            default:
                throw new Error('Unable to retry this operation automatically');
        }
    }

    /**
     * Show retry in progress
     */
    showRetryInProgress(containerId, delay) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const retryHTML = `
            <div class="retry-progress">
                <div class="retry-icon">🔄</div>
                <div class="retry-message">Retrying in ${Math.ceil(delay / 1000)} seconds...</div>
                <div class="retry-bar">
                    <div class="retry-bar-fill" style="animation: countdown ${delay}ms linear"></div>
                </div>
            </div>
        `;
        
        container.innerHTML = retryHTML;
    }

    /**
     * Calculate intelligent backoff delay
     */
    calculateBackoffDelay(retryCount, errorType) {
        const baseDelays = {
            'network': 2000,
            'api': 5000,
            'rate_limit': 10000,
            'default': 3000
        };
        
        const baseDelay = baseDelays[errorType] || baseDelays['default'];
        
        // Exponential backoff with jitter
        const exponentialDelay = baseDelay * Math.pow(2, retryCount);
        const jitter = Math.random() * 1000;
        
        return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
    }

    /**
     * Get max retries for error type
     */
    getMaxRetries(errorType) {
        const maxRetries = {
            'network': 3,
            'api': 1,
            'rate_limit': 2,
            'audio': 2,
            'ai_analysis': 2,
            'storage': 0,
            'default': 2
        };
        
        return maxRetries[errorType] || maxRetries['default'];
    }

    /**
     * Report error to development team
     */
    reportError(errorId) {
        const errorContext = this.userContext.get(errorId);
        if (!errorContext) return;

        // Create error report
        const report = {
            errorId,
            timestamp: errorContext.timestamp,
            error: errorContext.error,
            context: errorContext.context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Store locally for now (could send to analytics service)
        const reports = JSON.parse(localStorage.getItem('errorReports') || '[]');
        reports.push(report);
        localStorage.setItem('errorReports', JSON.stringify(reports.slice(-50))); // Keep last 50

        // Show confirmation
        this.showReportConfirmation(errorContext.containerId);
    }

    /**
     * Show report confirmation
     */
    showReportConfirmation(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const confirmHTML = `
            <div class="report-confirmation">
                <div class="confirmation-icon">✅</div>
                <div class="confirmation-message">Error reported successfully</div>
                <div class="confirmation-detail">Thank you for helping us improve!</div>
            </div>
        `;
        
        container.innerHTML = confirmHTML;
        
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            this.dismissError(null, containerId);
        }, 3000);
    }

    /**
     * Dismiss error
     */
    dismissError(errorId, containerId = null) {
        if (errorId) {
            const errorContext = this.userContext.get(errorId);
            containerId = errorContext?.containerId;
        }
        
        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = '';
            }
        }
        
        if (errorId) {
            this.userContext.delete(errorId);
        }
    }

    /**
     * Show detailed help for error type
     */
    showDetailedHelp(errorType) {
        const helpContent = this.getDetailedHelp(errorType);
        
        // Create modal or popup with detailed help
        // For now, show in a simple alert (could be enhanced with a proper modal)
        alert(`Detailed Help for ${errorType.replace('_', ' ').toUpperCase()}:\n\n${helpContent}`);
    }

    /**
     * Get detailed help content
     */
    getDetailedHelp(errorType) {
        const helpContent = {
            'network': 'Network issues can occur due to poor internet connection, firewall settings, or server outages. Try switching networks, disabling VPN, or contacting your network administrator.',
            'api': 'API issues typically involve authentication or quota problems. Check your API key, verify your account status, and ensure you have sufficient credits or permissions.',
            'rate_limit': 'Rate limiting protects services from overuse. Wait before retrying, consider upgrading your plan, or spread out your requests over time.',
            'audio': 'Audio generation can fail with complex text, unsupported characters, or long segments. Try shorter text, simpler language, or different voice settings.',
            'ai_analysis': 'AI analysis issues may occur with very long text, unsupported languages, or complex formatting. Break down your text or try a different language setting.',
            'storage': 'Storage issues happen when browser storage is full. Clear old data, export important information, or check browser storage settings.',
            'default': 'If the issue persists, try refreshing the page, clearing browser cache, or contacting support with the error details.'
        };
        
        return helpContent[errorType] || helpContent['default'];
    }

    /**
     * Setup global error handling
     */
    setupGlobalErrorHandling() {
        // Store reference to this instance
        window.professionalErrorHandler = this;

        // Override common error scenarios
        this.overrideAIAnalysisErrors();
        this.overrideAudioGenerationErrors();
        this.overrideNetworkErrors();
    }

    /**
     * Override AI analysis error handling
     */
    overrideAIAnalysisErrors() {
        // This would integrate with existing AI error handling
        // For now, provide the interface for manual integration
    }

    /**
     * Override audio generation error handling
     */
    overrideAudioGenerationErrors() {
        // This would integrate with existing audio error handling
    }

    /**
     * Override network error handling
     */
    overrideNetworkErrors() {
        // Global network error handler
        window.addEventListener('error', (event) => {
            if (event.error && event.error.message && event.error.message.includes('fetch')) {
                // Handle fetch errors globally
                console.log('Global network error detected:', event.error);
            }
        });
    }

    /**
     * Inject professional error styles
     */
    injectErrorStyles() {
        if (document.getElementById('professional-error-styles')) return;

        const styles = `
            <style id="professional-error-styles">
                .professional-error {
                    padding: 20px;
                    margin: 16px;
                    border-radius: 12px;
                    border: 1px solid #e0e0e0;
                    background: #ffffff;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .error-high {
                    border-left: 4px solid #d32f2f;
                    background: #ffebee;
                }

                .error-medium {
                    border-left: 4px solid #f57c00;
                    background: #fff3e0;
                }

                .error-low {
                    border-left: 4px solid #1976d2;
                    background: #e3f2fd;
                }

                .error-container {
                    max-width: 500px;
                }

                .error-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .error-icon {
                    font-size: 24px;
                }

                .error-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #212121;
                }

                .error-details {
                    margin-bottom: 20px;
                }

                .error-type {
                    font-size: 12px;
                    color: #666;
                    text-transform: uppercase;
                    font-weight: 500;
                    margin-bottom: 12px;
                }

                .solutions-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #1976d2;
                    margin-bottom: 8px;
                }

                .solutions-list {
                    margin: 0;
                    padding-left: 20px;
                    font-size: 14px;
                    color: #424242;
                }

                .solutions-list li {
                    margin-bottom: 4px;
                    line-height: 1.5;
                }

                .error-actions {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    margin-bottom: 16px;
                }

                .error-button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }

                .retry-button {
                    background: #1976d2;
                    color: white;
                }

                .retry-button:hover {
                    background: #1565c0;
                    transform: translateY(-1px);
                }

                .report-button {
                    background: #f5f5f5;
                    color: #424242;
                    border: 1px solid #e0e0e0;
                }

                .report-button:hover {
                    background: #eeeeee;
                }

                .dismiss-button {
                    background: transparent;
                    color: #666;
                }

                .dismiss-button:hover {
                    background: #f5f5f5;
                }

                .error-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                    color: #666;
                    border-top: 1px solid #e0e0e0;
                    padding-top: 12px;
                }

                .error-help a {
                    color: #1976d2;
                    text-decoration: none;
                }

                .error-help a:hover {
                    text-decoration: underline;
                }

                .retry-progress {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    padding: 30px;
                }

                .retry-icon {
                    font-size: 32px;
                    animation: spin 1s linear infinite;
                }

                .retry-message {
                    font-size: 16px;
                    color: #424242;
                }

                .retry-bar {
                    width: 200px;
                    height: 4px;
                    background: #e0e0e0;
                    border-radius: 2px;
                    overflow: hidden;
                }

                .retry-bar-fill {
                    height: 100%;
                    background: #1976d2;
                    width: 100%;
                }

                @keyframes countdown {
                    from { width: 100%; }
                    to { width: 0%; }
                }

                .report-confirmation {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 30px;
                    text-align: center;
                }

                .confirmation-icon {
                    font-size: 32px;
                    animation: bounceIn 0.5s ease;
                }

                .confirmation-message {
                    font-size: 16px;
                    font-weight: 600;
                    color: #2e7d32;
                }

                .confirmation-detail {
                    font-size: 14px;
                    color: #666;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Setup retry strategies for different operations
     */
    setupRetryStrategies() {
        // Configure retry strategies based on operation type
        this.retryStrategies = {
            'ai-analysis': {
                maxRetries: 2,
                baseDelay: 3000,
                backoffMultiplier: 2
            },
            'audio-generation': {
                maxRetries: 2,
                baseDelay: 2000,
                backoffMultiplier: 1.5
            },
            'network': {
                maxRetries: 3,
                baseDelay: 2000,
                backoffMultiplier: 2
            }
        };
    }
}

// Initialize professional error handler
document.addEventListener('DOMContentLoaded', () => {
    new ProfessionalErrorHandler();
});