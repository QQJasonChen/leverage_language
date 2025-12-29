# AI Service Migration Plan

## Current State
- 6 separate AI service files (8,290 total lines)
- Duplicated code and functionality
- Different API modes scattered across files

## Files to Consolidate
1. `ai-service.js` (2,306 lines) - Main service ✅ **KEEP AS REFERENCE**
2. `ai-service-hybrid.js` (2,877 lines) - Hybrid mode with rate limiting
3. `ai-service-gpt5-version.js` (1,943 lines) - GPT-5 specific features  
4. `ai-service-secure.js` (524 lines) - Security features
5. `ai-service-prompts.js` (271 lines) - Basic prompts
6. `ai-service-prompts-optimized.js` (369 lines) - Optimized prompts

## New Unified Structure
- `ai-service-unified.js` - Single consolidated service
- Mode-based functionality: free, personal, secure, hybrid
- Built-in caching, rate limiting, and error handling
- Production logger integration

## Migration Steps
1. ✅ Create unified service class
2. ⏳ Extract unique features from each file
3. ⏳ Update background.js to use unified service  
4. ⏳ Test functionality with each mode
5. ⏳ Move old files to deprecated/ folder
6. ✅ Update manifest if needed

## Expected Benefits
- 🗜️ Reduce code size by ~60% (from 8,290 to ~3,000 lines)
- 🚀 Better performance with unified caching
- 🔧 Easier maintenance with single service
- 🛡️ Consistent error handling and logging

## Risk Mitigation
- Keep original files as backup
- Gradual migration with fallback support
- Extensive testing of each mode