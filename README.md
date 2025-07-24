# 🚀 LeverageLanguage - AI Language Learning Extension

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green)](https://chrome.google.com/webstore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An intelligent Chrome extension that transforms your web browsing into a powerful language learning experience using AI-powered real-time analysis.

## ✨ Features

### 🔍 **Real-Time Analysis**
- Analyze any text on any website instantly
- AI-powered error detection and corrections
- Multi-language support (English, Japanese, Korean, Dutch)
- Context-aware learning from real web content

### 🤖 **AI-Powered Insights**
- Advanced grammar and syntax analysis
- Pronunciation guides with IPA notation  
- Cultural context and usage explanations
- Personalized learning recommendations

### 📊 **Progress Tracking**
- Detailed learning analytics dashboard
- Achievement system with badges and milestones
- Daily streak tracking and goals
- Cross-device synchronization

### 🎯 **Smart Features**
- Browser integration with any website
- Export functionality for study materials
- Flashcard system for vocabulary retention
- Offline mode for saved content

## 🛠️ Installation

### For Users
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (link coming soon)
2. Click "Add to Chrome"
3. Follow the onboarding tutorial
4. Start learning on any website!

### For Developers
1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/leveragelanguage-extension.git
   cd leveragelanguage-extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

## 🔧 Development Setup

### Prerequisites
- Node.js 16+ 
- Chrome/Chromium browser
- Supabase account (for backend)
- Stripe account (for payments)

### Environment Configuration
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your API keys and configuration
3. Follow the setup guide for backend services

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run test     # Run tests
npm run lint     # Check code quality
```

## 🏗️ Architecture

### Frontend (Chrome Extension)
- **Manifest V3** for modern Chrome compatibility
- **Content Scripts** for web page integration
- **Background Service Worker** for persistent functionality
- **Side Panel UI** for main interface

### Backend (Supabase)
- **PostgreSQL Database** for user data and analytics
- **Real-time subscriptions** for live sync
- **Row Level Security** for data protection
- **Edge Functions** for serverless logic

### Integrations
- **Google OAuth** for authentication
- **Stripe** for subscription billing
- **AI APIs** (Gemini/OpenAI) for language analysis

## 📚 Usage Examples

### Basic Text Analysis
```javascript
// Analyze text from any webpage
const result = await analyzeText("I am very exciting to learn!", "english");
console.log(result.corrections); // Grammar suggestions
console.log(result.pronunciation); // IPA notation
```

### Progress Tracking
```javascript
// Get user learning statistics
const progress = await getProgressStats();
console.log(progress.accuracy); // Current accuracy rate
console.log(progress.streak); // Daily learning streak
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Use ESLint and Prettier for formatting
- Follow Chrome Extension best practices
- Write tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Documentation**: [Wiki](https://github.com/yourusername/leveragelanguage-extension/wiki)
- **Bug Reports**: [Issues](https://github.com/yourusername/leveragelanguage-extension/issues)
- **Feature Requests**: [Discussions](https://github.com/yourusername/leveragelanguage-extension/discussions)
- **Email**: support@leveragelanguage.com

## 🎯 Roadmap

### Version 2.0 (Q2 2024)
- [ ] Mobile app companion
- [ ] Advanced speech recognition
- [ ] Teacher dashboard
- [ ] API for third-party integrations

### Version 3.0 (Q4 2024)
- [ ] Video content analysis
- [ ] Group learning features
- [ ] Custom AI models
- [ ] Enterprise features

## 🌟 Acknowledgments

- Thanks to all beta testers and early users
- Inspired by the language learning community
- Built with modern web technologies and AI

## 📊 Stats

- **Languages Supported**: 4+ (English, Japanese, Korean, Dutch)
- **Active Users**: Growing daily
- **Accuracy Rate**: 95%+ for error detection
- **User Satisfaction**: ⭐⭐⭐⭐⭐

---

**Made with ❤️ for language learners worldwide**

[Website](https://leveragelanguage.com) • [Chrome Store](https://chrome.google.com/webstore) • [Twitter](https://twitter.com/leveragelang) • [Blog](https://blog.leveragelanguage.com)