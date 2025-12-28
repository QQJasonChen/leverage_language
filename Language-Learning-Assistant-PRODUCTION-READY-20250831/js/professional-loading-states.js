/**
 * Professional Loading States Manager
 * Provides intelligent, contextual loading indicators like premium tools
 */

class ProfessionalLoadingManager {
    constructor() {
        this.activeLoadings = new Map();
        this.loadingQueue = [];
        this.init();
    }

    init() {
        this.injectLoadingStyles();
        this.setupGlobalLoadingOverrides();
    }

    /**
     * Show intelligent loading state with context and progress
     * @param {string} containerId - Element to show loading in
     * @param {string} type - Type of operation (ai-analysis, audio-generation, etc.)
     * @param {Object} options - Configuration options
     */
    showIntelligentLoading(containerId, type, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const loadingConfig = this.getLoadingConfig(type);
        const loadingId = `loading_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store loading state
        this.activeLoadings.set(loadingId, {
            containerId,
            type,
            startTime: Date.now(),
            config: loadingConfig,
            options
        });

        // Create professional loading UI
        const loadingHTML = this.createLoadingHTML(loadingConfig, loadingId, options);
        
        // Show loading with smooth transition
        container.innerHTML = loadingHTML;
        
        // Start progress simulation
        this.startProgressSimulation(loadingId);
        
        return loadingId;
    }

    /**
     * Update loading progress with contextual messages
     */
    updateLoadingProgress(loadingId, progress, message) {
        const loading = this.activeLoadings.get(loadingId);
        if (!loading) return;

        const progressBar = document.querySelector(`[data-loading-id="${loadingId}"] .progress-bar-fill`);
        const statusText = document.querySelector(`[data-loading-id="${loadingId}"] .loading-status-text`);
        const stepIndicator = document.querySelector(`[data-loading-id="${loadingId}"] .loading-steps`);

        if (progressBar) {
            progressBar.style.width = `${Math.min(progress, 100)}%`;
        }

        if (statusText && message) {
            statusText.textContent = message;
            statusText.classList.add('status-update-animation');
            setTimeout(() => statusText.classList.remove('status-update-animation'), 300);
        }

        // Update step indicators
        if (stepIndicator && loading.config.steps) {
            const currentStep = Math.floor((progress / 100) * loading.config.steps.length);
            this.updateStepIndicators(stepIndicator, currentStep, loading.config.steps);
        }
    }

    /**
     * Hide loading with success/error state
     */
    hideLoading(loadingId, result = 'success', finalMessage = null) {
        const loading = this.activeLoadings.get(loadingId);
        if (!loading) return;

        const container = document.getElementById(loading.containerId);
        if (!container) return;

        if (result === 'success') {
            this.showSuccessTransition(container, finalMessage || 'Complete!');
        } else if (result === 'error') {
            this.showErrorState(container, finalMessage || 'Something went wrong');
        }

        // Clean up
        setTimeout(() => {
            this.activeLoadings.delete(loadingId);
        }, 1000);
    }

    /**
     * Get loading configuration for different operation types
     */
    getLoadingConfig(type) {
        const configs = {
            'ai-analysis': {
                title: 'AI Analysis in Progress',
                steps: [
                    'Analyzing text structure...',
                    'Checking grammar rules...',
                    'Evaluating pronunciation...',
                    'Generating insights...',
                    'Finalizing results...'
                ],
                estimatedTime: 8000,
                color: '#1976d2',
                icon: '🧠'
            },
            'audio-generation': {
                title: 'Generating Audio',
                steps: [
                    'Processing text...',
                    'Selecting voice model...',
                    'Synthesizing speech...',
                    'Optimizing quality...',
                    'Preparing download...'
                ],
                estimatedTime: 5000,
                color: '#2e7d32',
                icon: '🎵'
            },
            'data-export': {
                title: 'Preparing Export',
                steps: [
                    'Collecting data...',
                    'Formatting content...',
                    'Generating file...',
                    'Finalizing export...'
                ],
                estimatedTime: 3000,
                color: '#1976d2',
                icon: '📊'
            },
            'sync-operation': {
                title: 'Syncing Data',
                steps: [
                    'Connecting to server...',
                    'Uploading changes...',
                    'Processing updates...',
                    'Confirming sync...'
                ],
                estimatedTime: 4000,
                color: '#7b1fa2',
                icon: '🔄'
            },
            'default': {
                title: 'Processing',
                steps: [
                    'Initializing...',
                    'Processing...',
                    'Finalizing...'
                ],
                estimatedTime: 3000,
                color: '#1976d2',
                icon: '⚡'
            }
        };

        return configs[type] || configs['default'];
    }

    /**
     * Create professional loading HTML
     */
    createLoadingHTML(config, loadingId, options) {
        const showSteps = options.showSteps !== false;
        const showProgress = options.showProgress !== false;
        const showTime = options.showTime !== false;

        return `
            <div class="professional-loading" data-loading-id="${loadingId}">
                <div class="loading-container">
                    <div class="loading-header">
                        <div class="loading-icon">${config.icon}</div>
                        <div class="loading-title">${config.title}</div>
                        ${showTime ? `<div class="loading-time">~${Math.ceil(config.estimatedTime / 1000)}s</div>` : ''}
                    </div>
                    
                    ${showProgress ? `
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="background-color: ${config.color}"></div>
                        </div>
                    ` : ''}
                    
                    <div class="loading-status">
                        <div class="loading-status-text">${config.steps[0]}</div>
                    </div>
                    
                    ${showSteps && config.steps ? `
                        <div class="loading-steps">
                            ${config.steps.map((step, index) => `
                                <div class="step-indicator ${index === 0 ? 'active' : ''}" data-step="${index}">
                                    <div class="step-dot"></div>
                                    <div class="step-text">${step}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Start intelligent progress simulation
     */
    startProgressSimulation(loadingId) {
        const loading = this.activeLoadings.get(loadingId);
        if (!loading) return;

        const { config } = loading;
        const startTime = Date.now();
        let currentStep = 0;
        let progress = 0;

        const updateProgress = () => {
            const elapsed = Date.now() - startTime;
            const totalTime = config.estimatedTime;
            
            // Smart progress calculation (fast start, slower middle, fast finish)
            const rawProgress = elapsed / totalTime;
            progress = this.calculateSmartProgress(rawProgress) * 100;

            // Update step based on progress
            const newStep = Math.floor((progress / 100) * config.steps.length);
            if (newStep !== currentStep && newStep < config.steps.length) {
                currentStep = newStep;
                this.updateLoadingProgress(loadingId, progress, config.steps[currentStep]);
            } else {
                this.updateLoadingProgress(loadingId, progress);
            }

            // Continue if not complete and loading still active
            if (progress < 95 && this.activeLoadings.has(loadingId)) {
                setTimeout(updateProgress, 100 + Math.random() * 200); // Variable timing
            }
        };

        updateProgress();
    }

    /**
     * Calculate smart progress (non-linear for better UX)
     */
    calculateSmartProgress(rawProgress) {
        // Ease-out-in curve for natural feeling progress
        if (rawProgress < 0.5) {
            return 2 * rawProgress * rawProgress;
        } else {
            return 1 - 2 * (1 - rawProgress) * (1 - rawProgress);
        }
    }

    /**
     * Update step indicators
     */
    updateStepIndicators(container, currentStep, steps) {
        const indicators = container.querySelectorAll('.step-indicator');
        indicators.forEach((indicator, index) => {
            indicator.classList.remove('active', 'completed');
            if (index < currentStep) {
                indicator.classList.add('completed');
            } else if (index === currentStep) {
                indicator.classList.add('active');
            }
        });
    }

    /**
     * Show success transition
     */
    showSuccessTransition(container, message) {
        const successHTML = `
            <div class="loading-success">
                <div class="success-icon">✅</div>
                <div class="success-message">${message}</div>
            </div>
        `;
        
        container.innerHTML = successHTML;
        
        // Auto-hide success message
        setTimeout(() => {
            const successElement = container.querySelector('.loading-success');
            if (successElement) {
                successElement.style.opacity = '0';
                successElement.style.transform = 'translateY(-10px)';
            }
        }, 1500);
    }

    /**
     * Show error state with retry option
     */
    showErrorState(container, message) {
        const errorHTML = `
            <div class="loading-error">
                <div class="error-icon">⚠️</div>
                <div class="error-message">${message}</div>
                <button class="retry-button" onclick="window.professionalLoading.retryLastOperation()">
                    Try Again
                </button>
            </div>
        `;
        
        container.innerHTML = errorHTML;
    }

    /**
     * Inject professional loading styles
     */
    injectLoadingStyles() {
        if (document.getElementById('professional-loading-styles')) return;

        const styles = `
            <style id="professional-loading-styles">
                .professional-loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    min-height: 200px;
                }

                .loading-container {
                    max-width: 400px;
                    width: 100%;
                    text-align: center;
                }

                .loading-header {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .loading-icon {
                    font-size: 24px;
                    animation: pulse 2s infinite;
                }

                .loading-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #1976d2;
                }

                .loading-time {
                    font-size: 12px;
                    color: #666;
                    background: #f5f5f5;
                    padding: 2px 8px;
                    border-radius: 12px;
                }

                .progress-bar {
                    width: 100%;
                    height: 4px;
                    background: #e0e0e0;
                    border-radius: 2px;
                    overflow: hidden;
                    margin: 16px 0;
                }

                .progress-bar-fill {
                    height: 100%;
                    width: 0%;
                    background: #1976d2;
                    transition: width 0.3s ease;
                    border-radius: 2px;
                }

                .loading-status {
                    margin: 16px 0;
                }

                .loading-status-text {
                    font-size: 14px;
                    color: #666;
                    transition: all 0.3s ease;
                }

                .status-update-animation {
                    transform: translateY(-2px);
                    color: #1976d2 !important;
                }

                .loading-steps {
                    text-align: left;
                    margin-top: 24px;
                }

                .step-indicator {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 0;
                    opacity: 0.4;
                    transition: all 0.3s ease;
                }

                .step-indicator.active {
                    opacity: 1;
                    color: #1976d2;
                }

                .step-indicator.completed {
                    opacity: 0.8;
                    color: #2e7d32;
                }

                .step-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #e0e0e0;
                    transition: all 0.3s ease;
                }

                .step-indicator.active .step-dot {
                    background: #1976d2;
                    animation: pulse 1.5s infinite;
                }

                .step-indicator.completed .step-dot {
                    background: #2e7d32;
                }

                .step-text {
                    font-size: 13px;
                }

                .loading-success, .loading-error {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    padding: 30px;
                    transition: all 0.3s ease;
                }

                .success-icon, .error-icon {
                    font-size: 32px;
                    animation: bounceIn 0.5s ease;
                }

                .success-message, .error-message {
                    font-size: 16px;
                    font-weight: 500;
                }

                .success-message {
                    color: #2e7d32;
                }

                .error-message {
                    color: #d32f2f;
                }

                .retry-button {
                    background: #1976d2;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }

                .retry-button:hover {
                    background: #1565c0;
                    transform: translateY(-1px);
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                @keyframes bounceIn {
                    0% { transform: scale(0.3); opacity: 0; }
                    50% { transform: scale(1.05); }
                    70% { transform: scale(0.9); }
                    100% { transform: scale(1); opacity: 1; }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Override existing loading functions to use professional states
     */
    setupGlobalLoadingOverrides() {
        // Store reference to this instance
        window.professionalLoading = this;

        // Override common loading patterns
        this.overrideAIAnalysisLoading();
        this.overrideAudioGenerationLoading();
    }

    /**
     * Override AI analysis loading
     */
    overrideAIAnalysisLoading() {
        // Find and override the AI analysis button click
        const observeAIButton = () => {
            const aiButton = document.getElementById('generateAiAnalysisBtn');
            if (aiButton && !aiButton.dataset.professionalOverride) {
                const originalClick = aiButton.onclick;
                aiButton.dataset.professionalOverride = 'true';
                
                aiButton.onclick = (e) => {
                    // Show professional loading
                    const loadingId = this.showIntelligentLoading('ai-analysis-result', 'ai-analysis', {
                        showSteps: true,
                        showProgress: true,
                        showTime: true
                    });

                    // Store loading ID for potential cleanup
                    aiButton.dataset.currentLoading = loadingId;

                    // Call original function
                    if (originalClick) {
                        originalClick.call(aiButton, e);
                    }
                };
            }
        };

        // Observe for AI button
        const observer = new MutationObserver(observeAIButton);
        observer.observe(document.body, { childList: true, subtree: true });
        observeAIButton(); // Check immediately
    }

    /**
     * Override audio generation loading
     */
    overrideAudioGenerationLoading() {
        const observeAudioButton = () => {
            const audioButton = document.getElementById('generateAudioBtn');
            if (audioButton && !audioButton.dataset.professionalOverride) {
                const originalClick = audioButton.onclick;
                audioButton.dataset.professionalOverride = 'true';
                
                audioButton.onclick = (e) => {
                    const loadingId = this.showIntelligentLoading('audio-result', 'audio-generation', {
                        showSteps: true,
                        showProgress: true
                    });

                    audioButton.dataset.currentLoading = loadingId;

                    if (originalClick) {
                        originalClick.call(audioButton, e);
                    }
                };
            }
        };

        const observer = new MutationObserver(observeAudioButton);
        observer.observe(document.body, { childList: true, subtree: true });
        observeAudioButton();
    }
}

// Initialize professional loading manager
document.addEventListener('DOMContentLoaded', () => {
    new ProfessionalLoadingManager();
});