// Export Templates for Different Note-Taking Applications
class ExportTemplates {
  
  // Standard Markdown format - works with most apps
  static generateMarkdown(reports) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    let markdown = `# YouGlish Learning Export\n\n`;
    markdown += `**Export Date:** ${dateStr}\n`;
    markdown += `**Total Words:** ${reports.length}\n\n`;
    
    // Group by language
    const byLanguage = this.groupByLanguage(reports);
    
    Object.entries(byLanguage).forEach(([language, langReports]) => {
      const languageName = this.getLanguageName(language);
      markdown += `## ${languageName} (${langReports.length} words)\n\n`;
      
      // Sort by favorites first, then by date
      langReports.sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      langReports.forEach(report => {
        markdown += this.generateWordCard(report);
      });
      
      markdown += `\n---\n\n`;
    });
    
    return markdown;
  }
  
  // Heptabase format - Markdown with whiteboard structure
  static generateHeptabase(reports) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Create main whiteboard with all vocabulary cards
    let heptabase = `# YouGlish Vocabulary Whiteboard\n\n`;
    heptabase += `*Generated: ${dateStr}*\n\n`;
    
    // Add summary card
    heptabase += `## 📊 Summary Card\n\n`;
    heptabase += `**Total Vocabulary:** ${reports.length} words\n`;
    heptabase += `**Languages:** ${[...new Set(reports.map(r => r.language))].map(lang => this.getLanguageName(lang)).join(', ')}\n`;
    heptabase += `**Favorites:** ${reports.filter(r => r.favorite).length}\n`;
    heptabase += `**Export Date:** ${dateStr}\n\n`;
    
    heptabase += `---\n\n`;
    
    // Group by language for better organization
    const byLanguage = this.groupByLanguage(reports);
    
    Object.entries(byLanguage).forEach(([language, langReports]) => {
      const languageName = this.getLanguageName(language);
      heptabase += `## 🌍 ${languageName} Section\n\n`;
      
      // Sort favorites first
      langReports.sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      langReports.forEach(report => {
        heptabase += this.generateHeptabaseCard(report);
      });
      
      heptabase += `\n---\n\n`;
    });
    
    // Add instructions for Heptabase import
    heptabase += `## 💡 Import Instructions\n\n`;
    heptabase += `1. Copy this entire content\n`;
    heptabase += `2. Create a new whiteboard in Heptabase\n`;
    heptabase += `3. Paste content and it will create individual cards\n`;
    heptabase += `4. Arrange cards as desired on your whiteboard\n`;
    heptabase += `5. Use tags to connect related concepts\n\n`;
    
    return heptabase;
  }
  
  // Obsidian format - with backlinks and tags
  static generateObsidian(reports) {
    const files = [];
    
    // Create main index file
    const indexContent = this.generateObsidianIndex(reports);
    files.push({
      filename: "YouGlish Vocabulary Index.md",
      content: indexContent
    });
    
    // Create individual word files
    reports.forEach(report => {
      const filename = `${report.searchText.replace(/[^\w\s-]/g, '').trim()}-${report.language}.md`;
      const content = this.generateObsidianWordFile(report);
      files.push({
        filename: filename,
        content: content
      });
    });
    
    return files;
  }
  
  // Notion format - structured for databases
  static generateNotion(reports) {
    return {
      format: "notion",
      database: {
        title: "YouGlish Vocabulary",
        properties: {
          "Word": { type: "title" },
          "Language": { type: "select" },
          "Favorite": { type: "checkbox" },
          "Date Added": { type: "date" },
          "Tags": { type: "multi_select" },
          "Analysis": { type: "rich_text" },
          "Has Audio": { type: "checkbox" }
        }
      },
      rows: reports.map(report => ({
        "Word": report.searchText,
        "Language": this.getLanguageName(report.language),
        "Favorite": report.favorite || false,
        "Date Added": new Date(report.timestamp).toISOString().split('T')[0],
        "Tags": report.tags || [],
        "Analysis": this.formatAnalysisForNotion(report.analysisData),
        "Has Audio": !!report.audioData
      }))
    };
  }
  
  // Email format - clean and readable
  static generateEmail(reports, filterInfo = '全部報告') {
    // First, let's validate and clean the reports data
    if (!Array.isArray(reports)) {
      throw new Error('Reports must be an array');
    }
    
    // Clean and validate each report
    const cleanReports = reports.map(report => {
      if (!report) {
        console.warn('Skipping null/undefined report');
        return null;
      }
      
      return {
        ...report,
        searchText: report.searchText || 'Unknown',
        language: report.language || 'unknown',
        timestamp: report.timestamp || Date.now(),
        tags: Array.isArray(report.tags) ? report.tags : [],
        favorite: Boolean(report.favorite),
        audioData: report.audioData || null,
        analysisData: report.analysisData || null
      };
    }).filter(report => report !== null);
    
    console.log(`Processing ${cleanReports.length} clean reports for email export`);
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const subject = `YouGlish Vocabulary Export - ${cleanReports.length} words (${dateStr})`;
    
    let body = `Hello!\n\n`;
    body += `Here is your YouGlish vocabulary export from ${dateStr}.\n\n`;
    body += `📊 SUMMARY:\n`;
    body += `• Total Words: ${cleanReports.length}\n`;
    body += `• Favorite Words: ${cleanReports.filter(r => r.favorite).length}\n`;
    body += `• Languages: ${[...new Set(cleanReports.map(r => r.language))].map(lang => this.getLanguageName(lang)).join(', ')}\n`;
    body += `• Filter Applied: ${filterInfo}\n\n`;
    
    body += `═══════════════════════════════════════\n\n`;
    
    // Group by language
    const byLanguage = this.groupByLanguage(cleanReports);
    
    Object.entries(byLanguage).forEach(([language, langReports]) => {
      const languageName = this.getLanguageName(language);
      body += `🌍 ${languageName.toUpperCase()} (${langReports.length} words)\n`;
      body += `${'─'.repeat(40)}\n\n`;
      
      // Sort favorites first
      langReports.sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      langReports.forEach((report, index) => {
        body += `${index + 1}. ${report.searchText}`;
        if (report.favorite) body += ` ⭐`;
        if (report.audioData) body += ` 🔊`;
        body += `\n`;
        
        body += `   Date: ${new Date(report.timestamp).toLocaleDateString()}\n`;
        
        if (report.tags && report.tags.length > 0) {
          body += `   Tags: ${report.tags.map(tag => `#${tag}`).join(' ')}\n`;
        }
        
        // Add complete analysis without markdown formatting
        try {
          console.log('Processing analysis for:', report.searchText);
          console.log('Report analysisData:', report.analysisData);
          console.log('Type of analysisData:', typeof report.analysisData);
          
          const analysis = this.formatAnalysis(report.analysisData);
          console.log('Formatted analysis:', analysis);
          
          if (analysis && analysis.trim().length > 0 && analysis !== 'No analysis available') {
            const plainTextAnalysis = this.convertMarkdownToPlainText(analysis);
            body += `\n   ANALYSIS:\n`;
            // Indent each line of analysis for better readability
            const indentedAnalysis = plainTextAnalysis.split('\n').map(line => 
              line.trim() ? `   ${line.trim()}` : ''
            ).join('\n');
            body += `${indentedAnalysis}\n`;
          } else {
            body += `\n   ANALYSIS: No analysis data available\n`;
          }
        } catch (analysisError) {
          console.error('Error processing analysis for', report.searchText, analysisError);
          console.error('Full error stack:', analysisError.stack);
          console.error('Report object:', JSON.stringify(report, null, 2));
          body += `\n   ANALYSIS: Error processing analysis data (${analysisError.message})\n`;
        }
        
        body += `\n${'─'.repeat(60)}\n\n`;
      });
      
      body += `\n`;
    });
    
    body += `═══════════════════════════════════════\n\n`;
    body += `This export was generated by YouGlish Extension.\n`;
    body += `You can copy this content into note-taking apps like Notion, Obsidian, or Heptabase.\n\n`;
    body += `Happy learning! 📚\n`;
    
    return {
      subject: subject,
      body: body
    };
  }
  
  // Notion API format - ready for direct upload
  static generateNotionAPI(reports) {
    return {
      format: "notion-api",
      database: {
        title: "YouGlish Vocabulary Collection",
        properties: {
          "Word": { 
            type: "title",
            title: {}
          },
          "Language": { 
            type: "select",
            select: {
              options: [...new Set(reports.map(r => r.language))].map(lang => ({
                name: this.getLanguageName(lang),
                color: this.getLanguageColor(lang)
              }))
            }
          },
          "Favorite": { 
            type: "checkbox",
            checkbox: {}
          },
          "Date Added": { 
            type: "date",
            date: {}
          },
          "Tags": { 
            type: "multi_select",
            multi_select: {
              options: this.getAllUniqueTags(reports).map(tag => ({
                name: tag,
                color: "default"
              }))
            }
          },
          "Analysis": { 
            type: "rich_text",
            rich_text: {}
          },
          "Has Audio": { 
            type: "checkbox",
            checkbox: {}
          },
          "YouGlish URL": {
            type: "url",
            url: {}
          }
        }
      },
      pages: reports.map(report => this.generateNotionPage(report))
    };
  }
  
  // Helper methods
  static generateWordCard(report) {
    const date = new Date(report.timestamp).toLocaleDateString();
    const favorite = report.favorite ? " ⭐" : "";
    const audio = report.audioData ? " 🔊" : "";
    
    let card = `### ${report.searchText}${favorite}${audio}\n\n`;
    card += `**Language:** ${this.getLanguageName(report.language)}\n`;
    card += `**Date:** ${date}\n`;
    
    if (report.tags && report.tags.length > 0) {
      card += `**Tags:** ${report.tags.map(tag => `#${tag}`).join(' ')}\n`;
    }
    
    card += `\n#### Analysis\n\n`;
    card += this.formatAnalysis(report.analysisData);
    card += `\n\n`;
    
    return card;
  }
  
  static generateHeptabaseIndex(reports) {
    const byLanguage = this.groupByLanguage(reports);
    const favorites = reports.filter(r => r.favorite);
    
    let content = `# YouGlish Vocabulary Collection\n\n`;
    content += `This is your personal vocabulary collection from YouGlish learning sessions.\n\n`;
    content += `## 📊 Statistics\n\n`;
    content += `- **Total Words:** ${reports.length}\n`;
    content += `- **Favorite Words:** ${favorites.length}\n`;
    content += `- **Languages:** ${Object.keys(byLanguage).length}\n\n`;
    
    content += `## 🌍 By Language\n\n`;
    Object.entries(byLanguage).forEach(([lang, langReports]) => {
      content += `- **${this.getLanguageName(lang)}:** ${langReports.length} words\n`;
    });
    
    content += `\n## ⭐ Favorite Words\n\n`;
    favorites.forEach(report => {
      content += `- [[${report.searchText} (${this.getLanguageName(report.language)})]]\n`;
    });
    
    return content;
  }
  
  static generateHeptabaseWordCard(report) {
    let content = `# ${report.searchText}\n\n`;
    content += `**Language:** ${this.getLanguageName(report.language)}\n`;
    content += `**Date Added:** ${new Date(report.timestamp).toLocaleDateString()}\n`;
    
    if (report.favorite) {
      content += `**Status:** ⭐ Favorite\n`;
    }
    
    if (report.audioData) {
      content += `**Audio:** 🔊 Available\n`;
    }
    
    content += `\n## AI Analysis\n\n`;
    content += this.formatAnalysis(report.analysisData);
    
    content += `\n## Related\n\n`;
    content += `- Back to [[YouGlish Vocabulary Learning]]\n`;
    
    if (report.tags && report.tags.length > 0) {
      content += `- Tags: ${report.tags.map(tag => `[[${tag}]]`).join(', ')}\n`;
    }
    
    return content;
  }
  
  // Generate individual Heptabase card format
  static generateHeptabaseCard(report) {
    const favorite = report.favorite ? " ⭐" : "";
    const audio = report.audioData ? " 🔊" : "";
    
    let card = `### 💡 ${report.searchText}${favorite}${audio}\n\n`;
    card += `**🌍 Language:** ${this.getLanguageName(report.language)}\n`;
    card += `**📅 Added:** ${new Date(report.timestamp).toLocaleDateString()}\n`;
    
    if (report.tags && report.tags.length > 0) {
      card += `**🏷️ Tags:** ${report.tags.map(tag => `#${tag}`).join(' ')}\n`;
    }
    
    card += `\n**🤖 AI Analysis:**\n`;
    const analysis = this.formatAnalysis(report.analysisData);
    // Format for better readability in Heptabase cards
    const formattedAnalysis = analysis.split('\n').map(line => 
      line.trim() ? `> ${line.trim()}` : ''
    ).join('\n');
    
    card += `${formattedAnalysis}\n\n`;
    
    if (report.audioData) {
      card += `🎵 *Audio pronunciation available*\n\n`;
    }
    
    return card;
  }
  
  static generateHeptabaseTags(report) {
    const tags = [
      "vocabulary",
      `lang-${report.language}`,
      "youglish"
    ];
    
    if (report.favorite) {
      tags.push("favorite");
    }
    
    if (report.audioData) {
      tags.push("audio");
    }
    
    if (report.tags) {
      tags.push(...report.tags);
    }
    
    return tags;
  }
  
  static generateObsidianIndex(reports) {
    const byLanguage = this.groupByLanguage(reports);
    
    let content = `# YouGlish Vocabulary Index\n\n`;
    content += `#vocabulary #language-learning #youglish\n\n`;
    content += `## Overview\n\n`;
    content += `This is your YouGlish vocabulary collection with ${reports.length} words across ${Object.keys(byLanguage).length} languages.\n\n`;
    
    Object.entries(byLanguage).forEach(([lang, langReports]) => {
      content += `## ${this.getLanguageName(lang)}\n\n`;
      langReports.forEach(report => {
        const filename = `${report.searchText.replace(/[^\w\s-]/g, '').trim()}-${report.language}`;
        const favorite = report.favorite ? " ⭐" : "";
        const audio = report.audioData ? " 🔊" : "";
        content += `- [[${filename}|${report.searchText}]]${favorite}${audio}\n`;
      });
      content += `\n`;
    });
    
    return content;
  }
  
  static generateObsidianWordFile(report) {
    let content = `# ${report.searchText}\n\n`;
    content += `#vocabulary #${report.language} #youglish`;
    
    if (report.favorite) {
      content += ` #favorite`;
    }
    
    if (report.tags && report.tags.length > 0) {
      content += ` ${report.tags.map(tag => `#${tag}`).join(' ')}`;
    }
    
    content += `\n\n`;
    content += `**Language:** ${this.getLanguageName(report.language)}\n`;
    content += `**Date Added:** ${new Date(report.timestamp).toLocaleDateString()}\n`;
    
    if (report.audioData) {
      content += `**Audio:** Available 🔊\n`;
    }
    
    content += `\n## Analysis\n\n`;
    content += this.formatAnalysis(report.analysisData);
    
    content += `\n\n---\n*Generated from [[YouGlish Vocabulary Index]]*`;
    
    return content;
  }
  
  static formatAnalysis(analysisData) {
    console.log('formatAnalysis called with:', analysisData);
    console.log('Type:', typeof analysisData);
    
    // Handle null, undefined, or falsy values
    if (!analysisData) {
      console.log('Analysis data is falsy, returning default message');
      return 'No analysis available';
    }
    
    // Handle string type
    if (typeof analysisData === 'string') {
      console.log('Analysis data is string:', analysisData.substring(0, 100) + '...');
      return analysisData;
    }
    
    // Handle object type
    if (analysisData && typeof analysisData === 'object') {
      console.log('Analysis data is object, checking properties...');
      console.log('Available properties:', Object.keys(analysisData));
      
      // Try different possible properties with additional safety checks
      if (analysisData.content && typeof analysisData.content === 'string') {
        console.log('Found content property');
        return analysisData.content;
      } else if (analysisData.analysis && typeof analysisData.analysis === 'string') {
        console.log('Found analysis property');
        return analysisData.analysis;
      } else if (analysisData.text && typeof analysisData.text === 'string') {
        console.log('Found text property');
        return analysisData.text;
      } else if (analysisData.result && typeof analysisData.result === 'string') {
        console.log('Found result property');
        return analysisData.result;
      } else {
        console.log('No known string properties found, stringifying object');
        try {
          return JSON.stringify(analysisData, null, 2);
        } catch (stringifyError) {
          console.error('Failed to stringify analysis data:', stringifyError);
          return 'Analysis data format error';
        }
      }
    }
    
    console.log('Unknown analysis data type, returning default message');
    return 'No analysis available';
  }
  
  static formatAnalysisForNotion(analysisData) {
    const formatted = this.formatAnalysis(analysisData);
    // Notion has character limits, so truncate if too long
    return formatted.length > 2000 ? formatted.substring(0, 1997) + '...' : formatted;
  }
  
  static convertMarkdownToPlainText(markdown) {
    if (!markdown) return '';
    
    // Ensure markdown is a string
    if (typeof markdown !== 'string') {
      console.warn('convertMarkdownToPlainText received non-string:', typeof markdown, markdown);
      return String(markdown);
    }
    
    try {
      return markdown
        // Remove markdown headers (## Header -> Header)
        .replace(/^#{1,6}\s+(.*)$/gm, '$1')
        // Remove bold/italic formatting (**text** -> text, *text* -> text)
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        // Convert markdown lists (- item -> • item)
        .replace(/^-\s+(.*)$/gm, '• $1')
        // Remove excessive line breaks
        .replace(/\n{3,}/g, '\n\n')
        // Clean up any remaining markdown artifacts
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links [text](url) -> text
        .replace(/`([^`]+)`/g, '$1') // Inline code
        .trim();
    } catch (error) {
      console.error('Error converting markdown to plain text:', error);
      return String(markdown);
    }
  }
  
  static groupByLanguage(reports) {
    return reports.reduce((groups, report) => {
      const lang = report.language;
      if (!groups[lang]) {
        groups[lang] = [];
      }
      groups[lang].push(report);
      return groups;
    }, {});
  }
  
  static getLanguageName(languageCode) {
    const languageNames = {
      'english': 'English',
      'japanese': 'Japanese',
      'korean': 'Korean',
      'dutch': 'Dutch',
      'chinese': 'Chinese',
      'spanish': 'Spanish',
      'french': 'French',
      'german': 'German'
    };
    
    return languageNames[languageCode] || languageCode.charAt(0).toUpperCase() + languageCode.slice(1);
  }
  
  static getLanguageColor(languageCode) {
    const colorMap = {
      'english': 'blue',
      'japanese': 'red',
      'korean': 'green',
      'dutch': 'orange',
      'chinese': 'yellow',
      'spanish': 'purple',
      'french': 'pink',
      'german': 'gray'
    };
    return colorMap[languageCode] || 'default';
  }
  
  static getAllUniqueTags(reports) {
    const tagSet = new Set();
    reports.forEach(report => {
      if (report.tags) {
        report.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  }
  
  static generateNotionPage(report) {
    return {
      properties: {
        "Word": {
          title: [
            {
              text: {
                content: report.searchText
              }
            }
          ]
        },
        "Language": {
          select: {
            name: this.getLanguageName(report.language)
          }
        },
        "Favorite": {
          checkbox: report.favorite || false
        },
        "Date Added": {
          date: {
            start: new Date(report.timestamp).toISOString().split('T')[0]
          }
        },
        "Tags": {
          multi_select: (report.tags || []).map(tag => ({ name: tag }))
        },
        "Analysis": {
          rich_text: [
            {
              text: {
                content: this.formatAnalysisForNotion(report.analysisData)
              }
            }
          ]
        },
        "Has Audio": {
          checkbox: !!report.audioData
        },
        "YouGlish URL": {
          url: `https://youglish.com/pronounce/${encodeURIComponent(report.searchText)}/${report.language}`
        }
      }
    };
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportTemplates;
} else if (typeof self !== 'undefined') {
  self.ExportTemplates = ExportTemplates;
} else {
  this.ExportTemplates = ExportTemplates;
}